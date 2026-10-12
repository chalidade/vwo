// Booth and stall requests under the lock: an account can't pass its open limit by sending at once,
// a request is finished only once, and contact details never reach the public setup.
import { boothLeadInput, type Lead, newLead, stallLeadInput } from "@vwo/shared";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createLead,
  editLead,
  finishLead,
  hasVerifiedRegistration,
  leadById,
  leadsOf,
  listLeads,
  myRegistrations,
  readFairState,
  recordLeadRegistration,
  writeFairState,
} from "../src";
import { companyRegistrations, fairState } from "../src/jobfair-schema";
import { users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
const ids: string[] = [];
const booth = { company: "PT Contoh Maju", industry: "Teknologi", city: "Jakarta", contactName: "Rina", contactRole: "HR", email: "hr@contoh.co.id", phone: "0812 3456 7890" };
const boothLead = (userId: string) => newLead(randomUUID(), userId, { kind: "booth", data: boothLeadInput.parse(booth) }, Date.now());
const stallLead = (userId: string) =>
  newLead(
    randomUUID(),
    userId,
    { kind: "stall", data: stallLeadInput.parse({ business: "Warung Rina", sells: "Nasi uduk", contactName: "Rina", email: "r@x.id", phone: "081234567890" }) },
    Date.now(),
  );

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  for (let i = 0; i < 3; i++) {
    const [u] = await db
      .insert(users)
      .values({ email: `lead${i}@jobfair.example`, displayName: `L${i}` })
      .returning({ id: users.id });
    ids.push(u!.id);
  }
});

beforeEach(async () => {
  await db.delete(fairState);
  await db.delete(companyRegistrations);
});

afterAll(async () => {
  await close();
});

describe("booth and stall requests", () => {
  it("keeps one account to three open requests per kind, even when they arrive at once", async () => {
    const [a] = ids as [string];
    const out = await Promise.all(Array.from({ length: 5 }, () => createLead(db, boothLead(a))));
    expect(out.filter((r) => "error" in r)).toEqual([{ error: "too_many_open" }, { error: "too_many_open" }]);
    expect("result" in (await createLead(db, stallLead(a)))).toBe(true);
    expect((await leadsOf(db, a)).length).toBe(4);
  });

  it("never puts a request in the public setup", async () => {
    const [a] = ids as [string];
    await writeFairState(db, { key: "org", data: { removed: [], added: [] }, userId: a });
    await createLead(db, boothLead(a));
    const rows = await readFairState(db);
    expect(rows.map((r) => r.key)).toEqual(["org"]);
    expect(JSON.stringify(rows)).not.toContain("hr@contoh.co.id");
    expect((await listLeads(db)).length).toBe(1);
  });

  it("finishes a request only once when two organisers fulfil it at the same time", async () => {
    const [a, admin, admin2] = ids as [string, string, string];
    const lead = boothLead(a);
    await createLead(db, lead);
    const both = await Promise.all([finishLead(db, lead.id, admin, { boothId: "pt-a", pin: "111111" }), finishLead(db, lead.id, admin2, { boothId: "pt-b", pin: "222222" })]);
    expect(both.filter((r) => "error" in r)).toEqual([{ error: "not_open" }]);
    const stored = (await leadById(db, lead.id)) as Lead;
    expect(stored.status).toBe("done");
    expect(["pt-a", "pt-b"]).toContain(stored.result?.boothId);
    expect(await editLead(db, lead.id, admin, { status: "new" })).toEqual({ error: "fulfilled" });
    expect(await finishLead(db, randomUUID(), admin, { boothId: "x" })).toEqual({ error: "not_found" });
  });

  it("records the opened booth as a verified, unpaid registration of the account that asked", async () => {
    const [a, admin] = ids as [string, string];
    const lead = boothLead(a);
    expect(await hasVerifiedRegistration(db, a)).toBe(false);
    await recordLeadRegistration(db, lead, admin, "pt-contoh-maju", "123456", "regular", "#2563eb");
    expect(await hasVerifiedRegistration(db, a)).toBe(true);
    const [reg] = await myRegistrations(db, a);
    expect(reg).toMatchObject({ status: "verified", price: 0, method: "Formulir", boothKey: "pt-contoh-maju", pin: "123456", city: "Jakarta" });
  });
});
