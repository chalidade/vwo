import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campusBoard, claimReferral, coinBalance, createDb, createSession, referralCount, referredBy, register, sessionUser, writeFairPlayer } from "../src";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
const ids: Record<string, string> = {};
const tag = async (id: string) => (await sessionUser(db, (await createSession(db, id, "t")).token))!.fairTag;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  for (const n of ["Ani", "Budi", "Citra", "Dodi"]) ids[n] = (await register(db, { email: `${n.toLowerCase()}@mail.example`, password: "rahasia123", name: n })).userId;
});

afterAll(async () => {
  await close();
});

describe("referrals", () => {
  it("pays the newcomer and the inviter once", async () => {
    const code = await tag(ids.Ani!);
    expect(await claimReferral(db, { userId: ids.Budi!, code, reward: 10 })).toBe("ok");
    expect(await claimReferral(db, { userId: ids.Budi!, code, reward: 10 })).toBe("already");
    expect(await coinBalance(db, ids.Budi!)).toBe(10);
    expect(await coinBalance(db, ids.Ani!)).toBe(10);
    expect(await referredBy(db, ids.Budi!)).toBe(ids.Ani);
    expect(await referralCount(db, ids.Ani!)).toEqual({ friends: 1, coins: 10 });
  });

  it("refuses its own code, unknown codes and old accounts", async () => {
    expect(await claimReferral(db, { userId: ids.Citra!, code: await tag(ids.Citra!), reward: 10 })).toBe("self");
    expect(await claimReferral(db, { userId: ids.Citra!, code: "ffffffffffff", reward: 10 })).toBe("unknown_code");
    expect(await claimReferral(db, { userId: ids.Citra!, code: "'; drop table users; --", reward: 10 })).toBe("unknown_code");
    const later = new Date(Date.now() + 30 * 86_400_000);
    expect(await claimReferral(db, { userId: ids.Citra!, code: await tag(ids.Ani!), reward: 10, now: later })).toBe("too_old");
    expect(await coinBalance(db, ids.Citra!)).toBe(0);
  });
});

describe("campus leaderboard", () => {
  it("adds up XP per campus, however the name is typed", async () => {
    await writeFairPlayer(db, { userId: ids.Ani!, rev: 0, data: { player: { xp: 120 }, profile: { campus: "ITB" } } });
    await writeFairPlayer(db, { userId: ids.Budi!, rev: 0, data: { player: { xp: 80 }, profile: { campus: "itb " } } });
    await writeFairPlayer(db, { userId: ids.Citra!, rev: 0, data: { player: { xp: 150 }, profile: { campus: "Universitas Indonesia" } } });
    await writeFairPlayer(db, { userId: ids.Dodi!, rev: 0, data: { player: { xp: "lots" }, profile: { campus: "UGM" } } });
    const board = await campusBoard(db);
    expect(board.map((r) => [r.members, r.xp])).toEqual([
      [2, 200],
      [1, 150],
    ]);
    expect(board[0]!.campus.toLowerCase().trim()).toBe("itb");
    expect(JSON.stringify(board)).not.toContain("@");
  });
});
