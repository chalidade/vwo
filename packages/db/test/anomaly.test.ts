// Random anomalies: the schedule and signed tokens, and claims through the coin ledger (what the
// /api/jobfair/anomaly route does after its session and rate-limit checks).
import {
  ANOMALY_CAP_MAX,
  ANOMALY_GRACE_MS,
  ANOMALY_INFO,
  ANOMALY_KINDS,
  ANOMALY_LIVE_MS,
  ANOMALY_RARE_COINS,
  ANOMALY_SLOT_MS,
  type AnomalyKind,
  anomalyDay,
  anomalyOutAt,
  anomalySettings,
  dayPhase,
  wibHour,
} from "@vwo/shared";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anomalyAt, anomalyCollection, anomalyOfSlot, anomalyReward, checkAnomalyClaim, claimAnomaly, coinBalance, createDb, grantCoins, hasCoinKey } from "../src";
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
/** `n` slots from `from` on whose anomalies are all different kinds (each kind pays once). */
const distinctSlots = (from: number, n: number, to = from + 240) => {
  const kinds = new Set<AnomalyKind>();
  const out: number[] = [];
  for (let slot = from; slot < to && out.length < n; slot++) {
    const k = anomalyOfSlot(SECRET, slot).kind;
    if (!kinds.has(k)) (kinds.add(k), out.push(slot));
  }
  expect(out).toHaveLength(n);
  return out;
};
/** The first slot from `from` on with an anomaly of this kind. */
const slotOf = (kind: AnomalyKind, from: number) => {
  for (let slot = from; slot < from + 100_000; slot++) if (anomalyOfSlot(SECRET, slot).kind === kind) return slot;
  throw new Error(`no ${kind}`);
};
let n = 0;
const newSeeker = async () => {
  const [u] = await db
    .insert(users)
    .values({ email: `s${++n}-${Date.now()}@seeker.example`, displayName: "S" })
    .returning({ id: users.id });
  return u!.id;
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
    expect(anomalyReward(SECRET, "a1", seeker, "cat", 5)).toEqual(anomalyReward(SECRET, "a1", seeker, "cat", 5));
    const all = Array.from({ length: 400 }, (_, i) => anomalyReward(SECRET, `a${i}`, seeker, "cat", 5));
    expect(all.some((r) => r.kind === "voucher")).toBe(true);
    expect(all.some((r) => r.kind === "coins")).toBe(true);
    for (const r of all) {
      if (r.kind === "voucher") expect(r.coins).toBe(5);
      else (expect(r.coins).toBeGreaterThanOrEqual(2), expect(r.coins).toBeLessThanOrEqual(4));
    }
  });

  it("pays more for a rare one, but never past its cap", () => {
    for (const kind of ["goldcat", "dragon"] as const) {
      const all = Array.from({ length: 300 }, (_, i) => anomalyReward(SECRET, `a${i}`, seeker, kind, 5));
      for (const r of all) expect(r.kind === "coins" && r.coins >= ANOMALY_RARE_COINS[0] && r.coins <= ANOMALY_RARE_COINS[1]).toBe(true);
      expect(new Set(all.map((r) => r.coins)).size).toBeGreaterThan(3);
    }
    // Even an organiser's huge application price never makes a common one pay past it.
    for (const k of ANOMALY_KINDS) for (let i = 0; i < 50; i++) expect(anomalyReward(SECRET, `a${i}`, seeker, k, 5).coins).toBeLessThanOrEqual(ANOMALY_RARE_COINS[1]);
  });
});

describe("anomaly kinds", () => {
  // Two weeks of slots.
  const slots = Array.from({ length: 240 * 14 }, (_, i) => 30_000 + i);
  const spawns = slots.map((slot) => anomalyOfSlot(SECRET, slot));

  it("brings every kind out, the same kind for the same slot", () => {
    expect(new Set(spawns.map((s) => s.kind))).toEqual(new Set(ANOMALY_KINDS));
    for (const s of spawns.slice(0, 50)) expect(anomalyOfSlot(SECRET, Number(s.id.slice(1))).kind).toBe(s.kind);
  });

  it("keeps the rare ones rare", () => {
    const rare = spawns.filter((s) => ANOMALY_INFO[s.kind].rare).length / spawns.length;
    expect(rare).toBeGreaterThan(0.002);
    expect(rare).toBeLessThan(0.04);
    const cats = spawns.filter((s) => s.kind === "cat").length;
    expect(spawns.filter((s) => s.kind === "goldcat").length * 4).toBeLessThan(cats);
  });

  it("sends each kind out only at its hours (Jakarta time)", () => {
    for (const s of spawns) expect(anomalyOutAt(s.kind, s.startsAt), `${s.kind} at ${wibHour(s.startsAt)}`).toBe(true);
    const hoursOf = (k: AnomalyKind) => new Set(spawns.filter((s) => s.kind === k).map((s) => wibHour(s.startsAt)));
    for (const h of hoursOf("ghost")) expect(h >= 18 || h < 5).toBe(true);
    for (const h of hoursOf("rooster")) expect(h >= 5 && h < 10).toBe(true);
    for (const h of hoursOf("ufo")) expect(h >= 19 || h < 4).toBe(true);
    expect(hoursOf("ghost").size).toBeGreaterThan(5);
  });

  it("keeps the park's day ones to the day and its night ones (the ghosts) to the night, for their whole stay", () => {
    const park = ANOMALY_KINDS.filter((k) => ANOMALY_INFO[k].place === "park");
    expect(park.length).toBeGreaterThanOrEqual(7);
    expect(park.filter((k) => ANOMALY_INFO[k].phase === "night")).toEqual(expect.arrayContaining(["kunti", "pocong", "lamp", "eyes"]));
    for (const s of spawns) {
      const phase = ANOMALY_INFO[s.kind].phase;
      if (!phase) continue;
      expect(dayPhase(s.startsAt), `${s.kind} starts`).toBe(phase);
      expect(dayPhase(s.expiresAt), `${s.kind} leaves`).toBe(phase);
    }
    for (const k of park)
      expect(
        spawns.some((s) => s.kind === k),
        k,
      ).toBe(true);
  });

  it("refuses a night one claimed in the day, even inside the grace seconds", () => {
    // Look for a ghost that came out just after 18.30 WIB (night), claimed a moment early at dusk.
    let found = false;
    for (let n = 0; n < 400 && !found; n++) {
      const secret = `phase-${n}`;
      for (let day = 0; day < 60 && !found; day++) {
        const nightFall = Date.UTC(2026, 9, 1 + day, 11, 30); // 18.30 WIB
        const s = anomalyOfSlot(secret, Math.floor(nightFall / ANOMALY_SLOT_MS));
        if (ANOMALY_INFO[s.kind].phase !== "night" || s.startsAt - nightFall > ANOMALY_GRACE_MS - 2000) continue;
        found = true;
        expect(checkAnomalyClaim(secret, claimOf(s), nightFall - 1000)).toEqual({ ok: false, error: "not_now" });
        expect(checkAnomalyClaim(secret, claimOf(s), s.startsAt + 1000)).toMatchObject({ ok: true });
      }
    }
    expect(found).toBe(true);
  });

  it("names a room for the room ones", () => {
    expect(ANOMALY_INFO.duck.place).toBe("foodcourt");
    expect(ANOMALY_INFO.mascot.place).toBe("aula");
    expect(ANOMALY_KINDS.filter((k) => ANOMALY_INFO[k].rare)).toEqual(["goldcat", "dragon"]);
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
    const seeker = await newSeeker();
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

  it("pays a kind only the first time: the next one of that kind is already in the collection", async () => {
    const seeker = await newSeeker();
    const first = live(slotOf("dog", 50_000));
    const second = live(slotOf("dog", Number(first.s.id.slice(1)) + 241));
    expect(anomalyDay(Number(second.s.id.slice(1)))).not.toBe(anomalyDay(Number(first.s.id.slice(1))));
    const r = await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(first.s), cap: 3, applyCoins: 5, now: first.at });
    expect(r.ok).toBe(true);
    const paid = await coinBalance(db, seeker);
    expect(await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(second.s), cap: 3, applyCoins: 5, now: second.at })).toEqual({
      ok: false,
      error: "already_collected",
      kind: "dog",
    });
    expect(await coinBalance(db, seeker)).toBe(paid);
    expect((await anomalyCollection(db, seeker)).map((c) => c.kind)).toEqual(["dog"]);
  });

  it("counts kinds caught before kinds paid once (old ledger lines) as collected", async () => {
    const seeker = await newSeeker();
    // How the old per-day claims were booked: no kind of their own, only the name in the line.
    await grantCoins(db, { userId: seeker, amount: 3, reason: "Kejutan: Kucing oren", key: `anomaly:${seeker}:2026-01-02:a1` });
    await grantCoins(db, { userId: seeker, amount: 5, reason: "Voucher lamar dari burung merpati", key: `anomaly:${seeker}:2026-01-03:a2` });
    // Not an anomaly: never counts.
    await grantCoins(db, { userId: seeker, amount: 3, reason: "Kejutan: Anak anjing", key: `mission:${seeker}:x` });
    expect((await anomalyCollection(db, seeker)).map((c) => c.kind)).toEqual(["cat", "pigeon"]);
    const cat = live(slotOf("cat", 60_000));
    const before = await coinBalance(db, seeker);
    expect(await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(cat.s), cap: 3, applyCoins: 5, now: cat.at })).toMatchObject({
      ok: false,
      error: "already_collected",
    });
    const dog = live(slotOf("dog", 60_000));
    expect((await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(dog.s), cap: 3, applyCoins: 5, now: dog.at })).ok).toBe(true);
    expect(await coinBalance(db, seeker)).toBeGreaterThan(before);
  });

  it("decides the kind and its reward itself: a rare one pays its rare amount whatever the browser says", async () => {
    const seeker = await newSeeker();
    const gold = live(slotOf("goldcat", 70_000));
    // Extra fields (a claimed kind, coins) are not part of a claim; the slot alone says what it was.
    const forged = { ...claimOf(gold.s), kind: "dragon", coins: 999 } as ReturnType<typeof claimOf>;
    const r = await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: forged, cap: 3, applyCoins: 5, now: gold.at });
    expect(r).toMatchObject({ ok: true, spawn: { kind: "goldcat" } });
    if (r.ok) expect(r.reward.coins).toBeLessThanOrEqual(ANOMALY_RARE_COINS[1]);
    // A rare one that isn't out now (a later slot's token, made up) doesn't pay.
    const later = anomalyOfSlot(SECRET, slotOf("dragon", 70_000));
    expect(await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: { ...claimOf(later), token: gold.s.token }, cap: 3, applyCoins: 5, now: gold.at })).toEqual({
      ok: false,
      error: "bad_token",
    });
  });

  it("refuses an expired anomaly without paying", async () => {
    const seeker = await newSeeker();
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
    const seeker = await newSeeker();
    const day = Math.ceil(40_000 / 240) * 240;
    const slots = distinctSlots(day, 6);
    const results = await Promise.all(
      slots.map((slot) => claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(live(slot).s), cap: 3, applyCoins: 5, now: live(slot).at })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(["daily_cap", "daily_cap", "daily_cap"]);
    // The next day, a kind not among those.
    const kinds = new Set(slots.map((sl) => anomalyOfSlot(SECRET, sl).kind));
    let nextSlot = day + 240;
    while (kinds.has(anomalyOfSlot(SECRET, nextSlot).kind)) nextSlot++;
    const next = live(nextSlot);
    expect(anomalyDay(nextSlot)).not.toBe(anomalyDay(day));
    expect((await claimAnomaly(db, { secret: SECRET, userId: seeker, claim: claimOf(next.s), cap: 3, applyCoins: 5, now: next.at })).ok).toBe(true);
  });
});
