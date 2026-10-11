// The morning reminders' queries against a real Postgres.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allowAction, applicationsScheduledBetween, createDb, playersRemindedOn, reminderRecipients, submitFairApplication, updateFairApplicationShared, writeFairPlayer } from "../src";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let sari: string;
let budi: string;

// 11 October 2026 in WIB, as epoch ms.
const FROM = Date.UTC(2026, 9, 10, 17, 0);
const TO = FROM + 86_400_000 - 1;
const NINE = FROM + 9 * 3_600_000;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  [{ id: sari }, { id: budi }] = (await db
    .insert(users)
    .values([
      { email: "sari@mail.example", displayName: "Sari", emailVerifiedAt: new Date() },
      { email: "budi@mail.example", displayName: "Budi" },
    ])
    .returning({ id: users.id })) as [{ id: string }, { id: string }];
});

afterAll(async () => {
  await close();
});

const data = (company: string) => ({ boothId: "b", jobId: "j", company, jobTitle: "Kasir", name: "Sari", email: "lain@mail.example" });

describe("reminder queries", () => {
  it("finds applications with an interview or office visit in the window", async () => {
    const a = (await submitFairApplication(db, { userId: sari, boothKey: "toko", jobKey: "kasir", data: data("TokoKita") }))!;
    const b = (await submitFairApplication(db, { userId: sari, boothKey: "kopi", jobKey: "barista", data: data("Kopi Kita") }))!;
    const c = (await submitFairApplication(db, { userId: budi, boothKey: "toko", jobKey: "kasir", data: data("TokoKita") }))!;
    await submitFairApplication(db, { userId: budi, boothKey: "kopi", jobKey: "barista", data: data("Kopi Kita") });
    await updateFairApplicationShared(db, { id: a.id, as: "company", userId: sari, incoming: { interview: { at: NINE, mode: "Video call" } } });
    await updateFairApplicationShared(db, { id: b.id, as: "company", userId: sari, incoming: { visit: { at: TO, address: "Jl. Sudirman 1" }, interview: { at: FROM - 1, mode: "Telepon" } } });
    await updateFairApplicationShared(db, { id: c.id, as: "company", userId: budi, incoming: { interview: { at: TO + 1, mode: "Video call" } } });
    const rows = await applicationsScheduledBetween(db, FROM, TO);
    expect(rows.map((r) => r.company).sort()).toEqual(["Kopi Kita", "TokoKita"]);
    expect(rows.every((r) => r.userId === sari)).toBe(true);
    // Only what the reminder needs: not the form, with its photo and the email typed in it.
    expect(JSON.stringify(rows)).not.toContain("lain@mail.example");
  });

  it("finds players who asked to be reminded on the day, and no one else", async () => {
    await writeFairPlayer(db, { userId: sari, rev: 0, data: { player: { coins: 0, remind: { "2026-10-11": ["seminar"] } } } });
    await writeFairPlayer(db, { userId: budi, rev: 0, data: { player: { coins: 0, remind: { "2026-10-12": ["talk1"] } } } });
    const rows = await playersRemindedOn(db, "2026-10-11");
    expect(rows).toEqual([{ userId: sari, remind: { "2026-10-11": ["seminar"] } }]);
    expect(await playersRemindedOn(db, "2026-10-13")).toEqual([]);
  });

  it("gives the account's own address and whether it is verified", async () => {
    const rows = await reminderRecipients(db, [sari, budi]);
    expect(rows.map((r) => [r.name, r.email, r.verified]).sort()).toEqual([
      ["Budi", "budi@mail.example", false],
      ["Sari", "sari@mail.example", true],
    ]);
    expect(await reminderRecipients(db, [])).toEqual([]);
  });

  it("a day's mark lets each account through once", async () => {
    expect(await allowAction(db, `remind:2026-10-11:${sari}`, 1, 36 * 3_600_000)).toBe(true);
    expect(await allowAction(db, `remind:2026-10-11:${sari}`, 1, 36 * 3_600_000)).toBe(false);
    expect(await allowAction(db, `remind:2026-10-12:${sari}`, 1, 36 * 3_600_000)).toBe(true);
  });
});
