// Random anomalies on the server: when and where each one appears comes from the clock and a server
// secret (so every visitor sees the same cat on the same floor), each one carries a signed token,
// and a claim pays out through the coin ledger: once per account per kind, ever (the first catch of a
// kind fills that spot in the collection), and a few per day.
import {
  ANOMALY_GRACE_MS,
  ANOMALY_KINDS,
  ANOMALY_LIVE_MS,
  ANOMALY_SLOT_MS,
  type AnomalyKind,
  type AnomalyReward,
  type AnomalySpawn,
  anomalyDay,
  anomalyId,
  anomalyKindsIn,
  anomalyReason,
  anomalyRewardOf,
  anomalySlot,
  isAnomalyKind,
  pickAnomalyKind,
} from "@vwo/shared";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "./client";
import { coinLedger } from "./jobfair-schema";

const mac = (secret: string, msg: string) => createHmac("sha256", `vwo-anomaly:${secret}`).update(msg).digest();

/** The anomaly of a slot: a moment inside it, a kind, a floor and a spot, all from the secret. The kind
 *  is weighted (the rare ones seldom) among those out at that hour, Jakarta time. */
export function anomalyOfSlot(secret: string, slot: number): AnomalySpawn {
  const h = mac(secret, `spawn:${slot}`);
  const startsAt = slot * ANOMALY_SLOT_MS + (h.readUInt32BE(0) % (ANOMALY_SLOT_MS - ANOMALY_LIVE_MS));
  const expiresAt = startsAt + ANOMALY_LIVE_MS;
  const id = anomalyId(slot);
  const floor = h.readUInt32BE(4);
  const kind = pickAnomalyKind(h.readUInt16BE(8) / 0x10000, startsAt);
  return { id, kind, floor, seed: h.readUInt32BE(12), startsAt, expiresAt, token: anomalyToken(secret, id, floor, expiresAt) };
}

export const anomalyToken = (secret: string, id: string, floor: number, expiresAt: number) => mac(secret, `token:${id}.${floor}.${expiresAt}`).toString("base64url");

/** The anomaly out now, if any, and when to ask again (when it leaves, or when the next one comes). */
export function anomalyAt(secret: string, now: number): { spawn: AnomalySpawn | null; next: number } {
  const slot = Math.floor(now / ANOMALY_SLOT_MS);
  const cur = anomalyOfSlot(secret, slot);
  if (now >= cur.startsAt && now < cur.expiresAt) return { spawn: cur, next: cur.expiresAt };
  return { spawn: null, next: now < cur.startsAt ? cur.startsAt : anomalyOfSlot(secret, slot + 1).startsAt };
}

export interface AnomalyClaim {
  id: string;
  floor: number;
  exp: number;
  token: string;
}

/** Whether a claim names an anomaly this server handed out, and it is still around. */
export function checkAnomalyClaim(secret: string, c: AnomalyClaim, now: number): { ok: true; spawn: AnomalySpawn } | { ok: false; error: "bad_token" | "expired" | "not_yet" } {
  const slot = anomalySlot(c.id);
  if (slot === null) return { ok: false, error: "bad_token" };
  const spawn = anomalyOfSlot(secret, slot);
  const want = Buffer.from(spawn.token);
  const got = Buffer.from(c.token);
  if (spawn.floor !== c.floor || spawn.expiresAt !== c.exp || want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, error: "bad_token" };
  if (now > spawn.expiresAt + ANOMALY_GRACE_MS) return { ok: false, error: "expired" };
  if (now < spawn.startsAt - ANOMALY_GRACE_MS) return { ok: false, error: "not_yet" };
  return { ok: true, spawn };
}

/** What this account gets for this anomaly: usually a few coins, sometimes a voucher lamar, more for a
 *  rare one. Fixed per account and anomaly, so a retried claim can't roll again. */
export function anomalyReward(secret: string, id: string, userId: string, kind: AnomalyKind, applyCoins: number): AnomalyReward {
  const h = mac(secret, `reward:${id}:${userId}`);
  return anomalyRewardOf(kind, h[0]!, h[1]!, applyCoins);
}

export const anomalyKey = (userId: string, spawnId: string, day: string) => `anomaly:${userId}:${day}:${spawnId}`;

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export type AnomalyClaimResult =
  | { ok: true; reward: AnomalyReward; spawn: AnomalySpawn }
  | { ok: false; error: "bad_token" | "expired" | "not_yet" | "already_claimed" | "already_collected" | "daily_cap"; kind?: AnomalyKind };

/** The kind a paid catch was: its `ref_id` since kinds pay once, or (catches from before that) the
 *  name in its ledger line. */
const kindOfRow = (r: { refId: string | null; reason: string }): AnomalyKind | undefined => (isAnomalyKind(r.refId) ? r.refId : anomalyKindsIn([r.reason])[0]);

/** The kinds an account has caught (and was paid for), each with when it first did. */
export async function anomalyCollection(db: Pick<Db, "select">, userId: string): Promise<{ kind: AnomalyKind; at: number }[]> {
  const rows = await db
    .select({ refId: coinLedger.refId, reason: coinLedger.reason, at: coinLedger.createdAt })
    .from(coinLedger)
    .where(and(eq(coinLedger.userId, userId), like(coinLedger.idempotencyKey, `${esc(`anomaly:${userId}:`)}%`)))
    .orderBy(asc(coinLedger.createdAt));
  const seen = new Map<AnomalyKind, number>();
  for (const r of rows) {
    const k = kindOfRow(r);
    if (k && !seen.has(k)) seen.set(k, r.at.getTime());
  }
  return ANOMALY_KINDS.filter((k) => seen.has(k)).map((kind) => ({ kind, at: seen.get(kind)! }));
}

/**
 * Claim an anomaly for an account: the token must be the server's, the anomaly still out, not
 * claimed by this account before, its kind not in the account's collection yet (each kind pays once,
 * ever), and the account under the day's cap. The checks and the payment happen under a per-account
 * lock, so parallel claims can't go past the cap or pay a kind twice.
 */
export async function claimAnomaly(
  db: Db,
  input: { secret: string; userId: string; claim: AnomalyClaim; cap: number; applyCoins: number; now?: number },
): Promise<AnomalyClaimResult> {
  const checked = checkAnomalyClaim(input.secret, input.claim, input.now ?? Date.now());
  if (!checked.ok) return checked;
  const { spawn } = checked;
  const u = input.userId;
  const day = anomalyDay(anomalySlot(spawn.id)!);
  const key = anomalyKey(u, spawn.id, day);
  // The kind is the server's own, from the slot: nothing the browser sends picks it.
  const reward = anomalyReward(input.secret, spawn.id, u, spawn.kind, input.applyCoins);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"anomaly:" + u}))`);
    const [done] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.idempotencyKey, key));
    if (done) return { ok: false, error: "already_claimed" } as const;
    if ((await anomalyCollection(tx, u)).some((c) => c.kind === spawn.kind)) return { ok: false, error: "already_collected", kind: spawn.kind } as const;
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(coinLedger)
      .where(and(eq(coinLedger.userId, u), like(coinLedger.idempotencyKey, `${esc(`anomaly:${u}:${day}:`)}%`)));
    if ((row?.n ?? 0) >= input.cap) return { ok: false, error: "daily_cap" } as const;
    const reason = anomalyReason(spawn.kind, reward);
    const added = await tx
      .insert(coinLedger)
      .values({ userId: u, delta: reward.coins, reason, refId: spawn.kind, idempotencyKey: key })
      .onConflictDoNothing({ target: coinLedger.idempotencyKey })
      .returning({ id: coinLedger.id });
    if (!added.length) return { ok: false, error: "already_claimed" } as const;
    return { ok: true, reward, spawn } as const;
  });
}
