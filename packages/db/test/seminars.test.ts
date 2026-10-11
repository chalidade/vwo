// Seminar registrations against a real Postgres: seats under concurrency, privacy of the list.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, mySeminarRegs, readFairState, seminarRegCounts, seminarRegistrantIds, seminarRegistrants, setSeminarRegistration, writeFairState } from "../src";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
const ids: string[] = [];

const TEN = Date.UTC(2026, 9, 12, 3, 0);
const BEFORE = TEN - 86_400_000;
const slot = { id: "cv", startAt: TEN, minutes: 60, capacity: 3 };

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  const rows = await db
    .insert(users)
    .values(Array.from({ length: 6 }, (_, i) => ({ email: `s${i}@mail.example`, displayName: `Seeker ${i}` })))
    .returning({ id: users.id });
  ids.push(...rows.map((r) => r.id));
});

afterAll(async () => {
  await close();
});

describe("seminar registrations", () => {
  it("registers, ignores a second registration, and cancels", async () => {
    expect(await setSeminarRegistration(db, { slot, userId: ids[0]!, register: true, now: BEFORE })).toEqual({ ok: true, registered: true, count: 1 });
    expect(await setSeminarRegistration(db, { slot, userId: ids[0]!, register: true, now: BEFORE + 1 })).toEqual({ ok: true, registered: true, count: 1 });
    expect(await mySeminarRegs(db, ids[0]!)).toEqual(["cv"]);
    expect(await setSeminarRegistration(db, { slot, userId: ids[0]!, register: false, now: BEFORE })).toEqual({ ok: true, registered: false, count: 0 });
    expect(await mySeminarRegs(db, ids[0]!)).toEqual([]);
  });

  it("never gives out more seats than the session has, even all at once", async () => {
    const results = await Promise.all(ids.map((userId) => setSeminarRegistration(db, { slot, userId, register: true, now: BEFORE })));
    expect(results.filter((r) => r.ok).length).toBe(3);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)).toEqual(["full", "full", "full"]);
    expect((await seminarRegCounts(db)).cv).toBe(3);
    // A seat frees up when someone cancels.
    const inside = (await seminarRegistrantIds(db, ["cv"])).cv!;
    expect(inside).toHaveLength(3);
    await setSeminarRegistration(db, { slot, userId: inside[0]!, register: false, now: BEFORE });
    const outside = ids.find((id) => !inside.includes(id))!;
    expect((await setSeminarRegistration(db, { slot, userId: outside, register: true, now: BEFORE })).ok).toBe(true);
  });

  it("refuses sessions that are over or not scheduled", async () => {
    expect(await setSeminarRegistration(db, { slot: { id: "old", startAt: TEN, minutes: 60 }, userId: ids[0]!, register: true, now: TEN + 61 * 60_000 })).toEqual({
      ok: false,
      error: "ended",
      count: 0,
    });
    expect(await setSeminarRegistration(db, { slot: { id: "tbd", minutes: 60 }, userId: ids[0]!, register: true, now: BEFORE })).toEqual({
      ok: false,
      error: "unscheduled",
      count: 0,
    });
  });

  it("keeps the list out of the public setup, and gives the organiser names and emails", async () => {
    await writeFairState(db, { key: "org", data: { seminars: [] }, userId: ids[0]! });
    expect((await readFairState(db)).map((r) => r.key)).toEqual(["org"]);
    const list = await seminarRegistrants(db, "cv");
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ name: expect.stringMatching(/^Seeker \d$/), email: expect.stringMatching(/@mail\.example$/) });
    expect(await seminarRegistrants(db, "nobody")).toEqual([]);
  });
});
