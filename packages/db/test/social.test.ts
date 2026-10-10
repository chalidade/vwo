import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addFriend, createDb, friendsOf, leaderboard, register, removeFriend, sessionUser, createSession, submitScore } from "../src";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let ani: string;
let budi: string;
let citra: string;
const tag = async (id: string) => (await sessionUser(db, (await createSession(db, id, "t")).token))!.fairTag;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  ani = (await register(db, { email: "ani@mail.example", password: "rahasia123", name: "Ani" })).userId;
  budi = (await register(db, { email: "budi@mail.example", password: "rahasia123", name: "Budi" })).userId;
  citra = (await register(db, { email: "citra@mail.example", password: "rahasia123", name: "Citra" })).userId;
});

afterAll(async () => {
  await close();
});

describe("weekly leaderboard", () => {
  it("keeps each player's best of the week and ranks them", async () => {
    expect(await submitScore(db, { userId: ani, week: "2026-W41", game: "2048", score: 900 })).toBe(900);
    expect(await submitScore(db, { userId: ani, week: "2026-W41", game: "2048", score: 300 })).toBe(900);
    await submitScore(db, { userId: budi, week: "2026-W41", game: "2048", score: 1500 });
    await submitScore(db, { userId: citra, week: "2026-W40", game: "2048", score: 9999 });
    const b = await leaderboard(db, { week: "2026-W41", game: "2048", userId: ani });
    expect(b.top.map((r) => [r.name, r.best])).toEqual([
      ["Budi", 1500],
      ["Ani", 900],
    ]);
    expect(b.me).toEqual({ best: 900, rank: 2 });
    expect(JSON.stringify(b)).not.toContain("@");
  });

  it("ranks memory by the fewest moves", async () => {
    await submitScore(db, { userId: ani, week: "2026-W41", game: "memory", score: 14 });
    expect(await submitScore(db, { userId: ani, week: "2026-W41", game: "memory", score: 9 })).toBe(9);
    await submitScore(db, { userId: budi, week: "2026-W41", game: "memory", score: 12 });
    const b = await leaderboard(db, { week: "2026-W41", game: "memory", userId: budi });
    expect(b.top.map((r) => r.best)).toEqual([9, 12]);
    expect(b.me?.rank).toBe(2);
  });
});

describe("friends", () => {
  it("becomes mutual once both say yes, and either side can end it", async () => {
    const [ta, tb] = [await tag(ani), await tag(budi)];
    expect(ta).toMatch(/^[0-9a-f]{12}$/);
    expect(ta).not.toBe(tb);
    expect(await addFriend(db, ani, tb)).toBe("sent");
    expect(await addFriend(db, ani, tb)).toBe("sent");
    expect(await friendsOf(db, budi)).toEqual([{ tag: ta, name: "Ani", state: "received" }]);
    expect(await addFriend(db, budi, ta)).toBe("friend");
    expect(await friendsOf(db, ani)).toEqual([{ tag: tb, name: "Budi", state: "friend" }]);
    expect(await addFriend(db, ani, ta)).toBe("self");
    expect(await addFriend(db, ani, "000000000000")).toBe("not_found");
    expect(await removeFriend(db, budi, ta)).toBe(true);
    expect(await friendsOf(db, ani)).toEqual([]);
  });
});
