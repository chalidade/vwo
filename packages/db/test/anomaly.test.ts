// Random anomalies: the schedule and signed tokens, and claims through the coin ledger (what the
// /api/jobfair/anomaly route does after its session and rate-limit checks).
import { ANOMALY_CAP_MAX, ANOMALY_GRACE_MS, ANOMALY_LIVE_MS, ANOMALY_SLOT_MS, anomalyDay, anomalySettings } from "@vwo/shared";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anomalyAt, anomalyOfSlot, anomalyReward, checkAnomalyClaim, claimAnomaly, coinBalance, createDb, hasCoinKey } from "../src";
import { users } from "../src/schema";

const SECRET = "test-secret";
const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let seeker: string;
let other: string;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  [{ id: seeker }, { id: other }] = (await db
    .insert(users)
    .values([
      { email: "a@seeker.example", displayName: "A" },
      { email: "b@seeker.example", displayName: "B" },
    ])
    .returning({ id: users.id })) as [{ id: string }, { id: string }];
});

afterAll(async () => {
  await close();
});

const claimOf = (s: { id: string; floor: number; expiresAt: number; token: string }) => ({ id: s.id, floor: s.floor, exp: s.expiresAt, token: s.token });
/** A slot's anomaly while it is out. */
const live = (slot: number) => {
  const s = anomalyOfSlot(SECRET, slot);
  return { s, at: s.startsAt + 1000 };
};

describe("anomaly schedule", () => {
  it("is the same for everyone and stays inside its slot", () => {
    for (let slot = 1000; slot < 1050; slot++) {
      const s = anomalyOfSlot(SECRET, slot);
      expect(anomalyOfSlot(SECRET, slot)).toEqual(s);
      expect(s.startsAt).toBeGreaterThanOrEqual(slot * ANOMALY_SLOT_MS);
      expect(s.expiresAt).toBe(s.startsAt + ANOMALY_LIVE_MS);
      expect(s.expiresAt).toBeLessThanOrEqual((slot + 1) * ANOMALY_SLOT_MS);
    }
  });

  it("differs with the secret, so nobody can work it out ahead", () => {
    const a = anomalyOfSlot(SECRET, 5000);
    const b = anomalyOfSlot("another", 5000);
    expect(a.token).not.toBe(b.token);
    expect([a.startsAt, a.floor, a.seed]).not.toEqual([b.startsAt, b.floor, b.seed]);
  });

  it("shows the anomaly only while it is out, and says when to ask again", () => {
    const s = anomalyOfSlot(SECRET, 7000);
    expect(anomalyAt(SECRET, s.startsAt).spawn?.id).toBe(s.id);
    expect(anomalyAt(SECRET, s.startsAt).next).toBe(s.expiresAt);
    expect(anomalyAt(SECRET, s.expiresAt).spawn).toBeNull();
    expect(anomalyAt(SECRET, s.expiresAt).next).toBe(anomalyOfSlot(SECRET, 7001).startsAt);
    if (s.startsAt > 7000 * ANOMALY_SLOT_MS) expect(anomalyAt(SECRET, s.startsAt - 1)).toEqual({ spawn: null, next: s.startsAt });
  });

  it("takes the organiser's settings with safe defaults", () => {
    expect(anomalySettings(null)).toEqual({ on: true, cap: 3 });
    expect(anomalySettings({ anomalies: { on: false, cap: 5 } })).toEqual({ on: false, cap: 5 });
    expect(anomalySettings({ anomalies: { cap: 999 } }).cap).toBe(ANOMALY_CAP_MAX);
    expect(anomalySettings({ anomalies: { cap: -2 } }).cap).toBe(1);
    expect(anomalySettings({ anomalies: { cap: "9" } }).cap).toBe(3);
  });

  it("pays a fixed reward per account and anomaly: coins, or a voucher worth one application", () => {
    expect(anomalyReward(SECRET, "a1", seeker, 5)).toEqual(anomalyReward(SECRET, "a1", seeker, 5));
    const all = Array.from({ length: 400 }, (_, i) => anomalyReward(SECRET, `a${i}`, seeker, 5));
    expect(all.some((r) => r.kind === "voucher")).toBe(true);
    expect(all.some((r) => r.kind === "coins")).toBe(true);
    for (const r of all) {
      if (r.kind === "voucher") expect(r.coins).toBe(5);
      else (expect(r.coins).toBeGreaterThanOrEqual(2), expect(r.coins).toBeLessThanOrEqual(4));
    }
  });
});

describe("anomaly token", () => {
  const { s, at } = live(9000);

  it("accepts the server's own anomaly while it is out", () => {
    expect(checkAnomalyClaim(SECRET, claimOf(s), at)).toMatchObject({ ok: true, spawn: { id: s.id } });
  });

  it("refuses a changed floor, expiry, id or token", () => {
    expect(checkAnomalyClaim(SECRET, { ...claimOf(s), floor: s.floor + 1 }, at)).toEqual({ ok: false, error: "bad_token" });
    expect(checkAnomalyClaim(SECRET, { ...claimOf(s), exp: s.expiresAt + 60_000 }, at)).toEqual({ ok: false, error: "bad_token" });
    expect(checkAnomalyClaim(SECRET, { ...claimOf(s), id: "a9001" }, at)).toEqual({ ok: false, error: "bad_token" });
    expect(checkAnomalyClaim(SECRET, { ...claimOf(s), token: s.token.slice(0, -2) + "AA" }, at)).toEqual({ ok: false, error: "bad_token" });
    expect(checkAnomalyClaim(SECRET, { ...claimOf(s), id: "x1" }, at)).toEqual({ ok: false, error: "bad_token" });
    expect(checkAnomalyClaim("forged", claimOf(s), at)).toEqual({ ok: false, error: "bad_token" });
  });

  it("refuses an anomaly that has left, or not come yet", () => {
    expect(checkAnomalyClaim(SECRET, claimOf(s), s.expiresAt + ANOMALY_GRACE_MS - 1).ok).toBe(true);
    expect(checkAnomalyClaim(SECRET, claimOf(s), s.expiresAt + ANOMALY_GRACE_MS + 1)).toEqual({ ok: false, error: "expired" });
    expect(checkAnomalyClaim(SECRET, claimOf(s), s.startsAt - ANOMALY_GRACE_MS - 1)).toEqual({ ok: false, error: "not_yet" });
  });
});

describe("claiming an anomaly", () => {
  it("pays once into the ledger and refuses the same token again", async () => {
    const { s, at } = live(20_000);
    const before = await coinBalance(db, seeker);
    const r = await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(s), cap: 3, applyCoins: 5, now: at });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await coinBalance(db, seeker)).toBe(before + r.reward.coins);
    expect(await hasCoinKey(db, `anomaly:${seeker}:${anomalyDay(20_000)}:${s.id}`)).toBe(true);
    const again = await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(s), cap: 3, applyCoins: 5, now: at });
    expect(again).toEqual({ ok: false, error: "already_claimed" });
    expect(await coinBalance(db, seeker)).toBe(before + r.reward.coins);
    // Another account may still have it.
    expect((await claimAnomaly(db, { secret: SECRET, userId: other, claim: claimOf(s), cap: 3, applyCoins: 5, now: at })).ok).toBe(true);
  });

  it("refuses an expired anomaly without paying", async () => {
    const { s } = live(20_010);
    const before = await coinBalance(db, seeker);
    expect(await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(s), cap: 3, applyCoins: 5, now: s.expiresAt + ANOMALY_GRACE_MS + 1 })).toEqual({
      ok: false,
      error: "expired",
    });
    expect(await coinBalance(db, seeker)).toBe(before);
  });

  it("stops at the daily cap, also for claims sent at once, and starts again the next day", async () => {
    // 240 slots a day: slots 40_000.. are all on one day, 40_240 is the next.
    const day = Math.ceil(40_000 / 240) * 240;
    const slots = Array.from({ length: 6 }, (_, i) => day + i * 5);
    const results = await Promise.all(
      slots.map((slot) => claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(live(slot).s), cap: 3, applyCoins: 5, now: live(slot).at })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(["daily_cap", "daily_cap", "daily_cap"]);
    const next = live(day + 240);
    expect(anomalyDay(day + 240)).not.toBe(anomalyDay(day));
    expect((await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(next.s), cap: 3, applyCoins: 5, now: next.at })).ok).toBe(true);
  });
});
