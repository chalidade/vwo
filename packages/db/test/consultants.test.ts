// Lounge consultant desks under the lock: two approvals or paid slots at once never share a desk,
// one account never gets two, and applications (contact details) stay out of the public setup.
import { BOT_CONSULTANTS, type ConsultantProfile } from "@vwo/shared";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyConsultant, approveConsultant, createDb, placePaidConsultant, readConsultants, readFairState, removeConsultant, setBotsOff } from "../src";
import { fairState } from "../src/jobfair-schema";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
const ids: string[] = [];
const profile: ConsultantProfile = { name: "Kak Rani", role: "Konsultan karier", topics: ["Review CV"], emoji: "🧭", color: "#2563eb" };

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  for (let i = 0; i < 6; i++) {
    const [u] = await db
      .insert(users)
      .values({ email: `k${i}@jobfair.example`, displayName: `K${i}` })
      .returning({ id: users.id });
    ids.push(u!.id);
  }
});

beforeEach(async () => {
  await db.delete(fairState);
});

afterAll(async () => {
  await close();
});

describe("consultant desks", () => {
  it("lets only one of two approvals at once take the same desk", async () => {
    const [admin, a, b] = ids as [string, string, string];
    await setBotsOff(
      db,
      admin,
      BOT_CONSULTANTS.map((x) => x.id),
    );
    await applyConsultant(db, { userId: a, email: "a@x.id", phone: "0812345678", profile });
    await applyConsultant(db, { userId: b, email: "b@x.id", phone: "0812345679", profile });
    const both = await Promise.all([approveConsultant(db, admin, a, 1), approveConsultant(db, admin, b, 1)]);
    expect(both.filter((r) => "error" in r)).toEqual([{ error: "desk_taken" }]);
    const s = await readConsultants(db);
    expect(s.placed.map((p) => p.desk)).toEqual([1]);
  });

  it("seats paid slots on different desks when they race for one, once per payment and per account", async () => {
    const [admin, a, b, c] = ids as [string, string, string, string];
    await setBotsOff(db, admin, [BOT_CONSULTANTS[0]!.id, BOT_CONSULTANTS[1]!.id]);
    const pay = (id: string, userId: string, desk: number) => placePaidConsultant(db, { id, userId, meta: { desk, profile, email: "x@x.id", phone: "0812345678" } });
    const [one, two] = await Promise.all([pay("p1", a, 0), pay("p2", b, 0)]);
    expect([one!.desk, two!.desk].sort()).toEqual([0, 1]);
    // The same payment delivered again (webhook and coin path) is not seated twice.
    expect((await pay("p1", a, 0))!.id).toBe(one!.id);
    // An account with a desk can't buy a second one, and a full lounge refuses.
    expect(await pay("p3", a, 1)).toBeNull();
    expect(await pay("p4", c, 0)).toBeNull();
    expect((await readConsultants(db)).placed).toHaveLength(2);
    // Removing one frees its desk.
    await removeConsultant(db, admin, one!.id);
    expect((await pay("p5", c, one!.desk))!.desk).toBe(one!.desk);
  });

  it("keeps applications out of the public setup read", async () => {
    const [admin, a] = ids as [string, string];
    await applyConsultant(db, { userId: a, email: "secret@x.id", phone: "0812345678", profile });
    await setBotsOff(db, admin, []);
    const rows = await readFairState(db);
    expect(rows.map((r) => r.key)).toEqual(["consultcfg"]);
    expect(JSON.stringify(rows)).not.toContain("secret@x.id");
  });
});
