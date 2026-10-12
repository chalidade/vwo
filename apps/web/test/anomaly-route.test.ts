// The random anomaly route against a real database: only a signed-in seeker with the server's own
// token gets paid, once per anomaly, never after it left, and no more than the organiser's daily cap.
import { addBoothMember, anomalyOfSlot, coinBalance, createDb, writeFairState } from "@vwo/db";
import { users } from "@vwo/db/schema";
import { ANOMALY_GRACE_MS, ANOMALY_SLOT_MS } from "@vwo/shared";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "route-test-secret";
const test = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
  return { url, user: null as null | { id: string; email: string; role: string } };
});
const conn = createDb(test.url);

vi.mock("@/lib/session", () => ({ currentUser: async () => test.user }));
vi.mock("@/lib/db", () => ({ db: conn.db }));

const { GET, POST } = await import("../app/api/jobfair/anomaly/route");

let seeker: string;
let company: string;
// A day of slots well in the future, so nothing else in the database counts toward it.
const DAY_SLOT = Math.ceil(9_000_000 / 240) * 240;

beforeAll(async () => {
  process.env.PREVIEW_SECRET = SECRET;
  const db = conn.db;
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url)) });
  [{ id: seeker }, { id: company }] = (await db
    .insert(users)
    .values([
      { email: "seeker@example.com", displayName: "Seeker" },
      { email: "hr@pt.example", displayName: "HR" },
    ])
    .returning({ id: users.id })) as [{ id: string }, { id: string }];
  await addBoothMember(db, "pt-a", company);
  await writeFairState(db, { key: "org", data: { removed: [], added: [], anomalies: { on: true, cap: 2 } }, userId: company });
});

afterAll(async () => {
  vi.useRealTimers();
  await conn.close();
});

beforeEach(() => {
  test.user = { id: seeker, email: "seeker@example.com", role: "user" };
});

/** Set the clock to while the slot's anomaly is out, and return what GET hands out then. */
async function liveAt(slot: number) {
  const s = anomalyOfSlot(SECRET, slot);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(s.startsAt + 1000);
  const d = (await (await GET(new Request("https://jobfair.co.id/api/jobfair/anomaly"))).json()) as { spawn: typeof s | null };
  expect(d.spawn).toEqual(s);
  return s;
}

const claim = (body: unknown, origin = "https://jobfair.co.id") =>
  POST(
    new Request("https://jobfair.co.id/api/jobfair/anomaly", {
      method: "POST",
      headers: { origin, host: "jobfair.co.id", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const bodyOf = (s: { id: string; floor: number; expiresAt: number; token: string }) => ({ id: s.id, floor: s.floor, exp: s.expiresAt, token: s.token });
const kindOf = (slot: number) => anomalyOfSlot(SECRET, slot).kind;
/** The next slot from `from` on whose kind is none of `not` (each kind pays once). */
const slotNotOf = (from: number, not: Set<string>) => {
  let slot = from;
  while (not.has(kindOf(slot))) slot++;
  return slot;
};

describe("/api/jobfair/anomaly", () => {
  it("hands out the same anomaly as the schedule, and nothing between them", async () => {
    const s = await liveAt(DAY_SLOT - 10);
    vi.setSystemTime(s.expiresAt + 1);
    expect(((await (await GET(new Request("https://jobfair.co.id/api/jobfair/anomaly"))).json()) as { spawn: unknown }).spawn).toBeNull();
  });

  it("asks for a signed-in seeker from this site", async () => {
    const s = await liveAt(DAY_SLOT - 9);
    test.user = null;
    expect((await claim(bodyOf(s))).status).toBe(401);
    test.user = { id: seeker, email: "seeker@example.com", role: "user" };
    expect((await claim(bodyOf(s), "https://evil.example")).status).toBe(403);
    test.user = { id: company, email: "hr@pt.example", role: "user" };
    expect(await (await claim(bodyOf(s))).json()).toEqual({ error: "seekers_only" });
  });

  it("pays once and refuses the same token again", async () => {
    const s = await liveAt(DAY_SLOT - 8);
    const before = await coinBalance(conn.db, seeker);
    const r = await claim(bodyOf(s));
    expect(r.status).toBe(200);
    const d = (await r.json()) as { reward: { kind: string; coins: number }; balance: number };
    expect(["coins", "voucher"]).toContain(d.reward.kind);
    // The opening coins come with the first claim; the reward on top.
    expect(d.balance).toBeGreaterThan(before);
    expect(d.balance).toBe(await coinBalance(conn.db, seeker));
    const again = await claim(bodyOf(s));
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "already_claimed" });
    expect(await coinBalance(conn.db, seeker)).toBe(d.balance);
  });

  it("refuses a forged or changed token, and an anomaly that has left", async () => {
    const s = await liveAt(DAY_SLOT - 7);
    expect((await claim({ ...bodyOf(s), floor: s.floor ^ 1 })).status).toBe(400);
    expect((await claim({ ...bodyOf(s), token: "x".repeat(43) })).status).toBe(400);
    vi.setSystemTime(s.expiresAt + ANOMALY_GRACE_MS + 1);
    const late = await claim(bodyOf(s));
    expect(late.status).toBe(409);
    expect(await late.json()).toMatchObject({ error: "expired" });
  });

  it("pays a kind once: the same kind again is already in the collection, with no coins", async () => {
    const paidKind = kindOf(DAY_SLOT - 8);
    let slot = DAY_SLOT - 300;
    while (kindOf(slot) !== paidKind) slot--;
    const before = await coinBalance(conn.db, seeker);
    const r = await claim(bodyOf(await liveAt(slot)));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "already_collected", kind: paidKind });
    expect(await coinBalance(conn.db, seeker)).toBe(before);
  });

  it("lists the account's collection for the signed-in seeker only", async () => {
    const mine = (q = "?mine=1") => GET(new Request(`https://jobfair.co.id/api/jobfair/anomaly${q}`));
    const d = (await (await mine()).json()) as { caught: { kind: string; at: number }[] };
    expect(d.caught.map((c) => c.kind)).toEqual([kindOf(DAY_SLOT - 8)]);
    expect(typeof d.caught[0]!.at).toBe("number");
    test.user = null;
    expect((await mine()).status).toBe(401);
    // Without ?mine=1 it is the public schedule.
    expect(await (await mine("")).json()).toHaveProperty("spawn");
  });

  it("takes the kind from the server, not the browser", async () => {
    const taken = new Set([kindOf(DAY_SLOT - 8)]);
    const s = await liveAt(slotNotOf(DAY_SLOT - 200, taken));
    const r = await claim({ ...bodyOf(s), kind: "goldcat", coins: 500 });
    expect(r.status).toBe(200);
    const d = (await r.json()) as { kind: string; reward: { coins: number } };
    expect(d.kind).toBe(s.kind);
    expect(d.reward.coins).toBeLessThanOrEqual(15);
  });

  it("stops at the organiser's daily cap", async () => {
    // Kinds this seeker hasn't caught yet, so only the cap stops them.
    const taken = new Set((await (await GET(new Request("https://jobfair.co.id/api/jobfair/anomaly?mine=1"))).json()).caught.map((c: { kind: string }) => c.kind) as string[]);
    const pick = (from: number) => {
      const slot = slotNotOf(from, taken);
      taken.add(kindOf(slot));
      return slot;
    };
    const a = pick(DAY_SLOT);
    const b = pick(a + 1);
    const c = pick(b + 1);
    expect(c).toBeLessThan(DAY_SLOT + 240);
    const before = await coinBalance(conn.db, seeker);
    for (const slot of [a, b]) expect((await claim(bodyOf(await liveAt(slot)))).status).toBe(200);
    const paid = await coinBalance(conn.db, seeker);
    expect(paid).toBeGreaterThan(before);
    const third = await claim(bodyOf(await liveAt(c)));
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ error: "daily_cap", cap: 2 });
    expect(await coinBalance(conn.db, seeker)).toBe(paid);
    // The next day counts again.
    expect(new Date((DAY_SLOT + 240) * ANOMALY_SLOT_MS).getUTCHours()).toBe(0);
    expect((await claim(bodyOf(await liveAt(pick(DAY_SLOT + 240))))).status).toBe(200);
  });
});
