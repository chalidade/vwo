import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addBoothMember,
  addStats,
  boothReportById,
  boothReportList,
  buildBoothReport,
  closedEvents,
  createDb,
  createPayment,
  createRegistration,
  freezeBoothReports,
  markPaid,
  payRegistration,
  register,
  ReportNameTakenError,
  reportBoothKeys,
  reviewBooth,
  setFairApplicationStatus,
  submitFairApplication,
  writeFairPlayer,
} from "../src";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
const ids: Record<string, string> = {};
const today = new Date().toISOString().slice(0, 10);

const apply = (who: string, boothKey: string, jobKey: string, data: Record<string, unknown> = {}) =>
  submitFairApplication(db, {
    userId: ids[who]!,
    boothKey,
    jobKey,
    data: { jobTitle: jobKey === "be" ? "Backend Engineer" : "Data Analyst", name: who, email: `${who}@mail.example`, ...data },
  });

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  for (const n of ["hr", "ani", "budi", "citra", "org"]) ids[n] = (await register(db, { email: `${n}@mail.example`, password: "rahasia123", name: n })).userId;
  await addBoothMember(db, "nusa", ids.hr!);

  // Reach: Ani visits twice, Budi once; another booth's visits don't count.
  await addStats(db, ids.ani!, today, [{ key: "visit:nusa", what: "view" }]);
  await addStats(db, ids.ani!, today, [{ key: "visit:nusa", what: "view" }]);
  await addStats(db, ids.budi!, today, [
    { key: "visit:nusa", what: "view" },
    { key: "visit:other", what: "view" },
    { key: "promo:co-nusa", what: "click" },
  ]);

  await writeFairPlayer(db, { userId: ids.ani!, rev: 0, data: { profile: { campus: "ITS", city: "Surabaya" } } });
  const a = await apply("ani", "nusa", "be", { education: "S1 Teknik Informatika", headline: "Fresh graduate" });
  await apply("ani", "nusa", "da", { city: "Surabaya" });
  await apply("budi", "nusa", "be", { city: "Jakarta", education: "SMK Negeri 1", verified: true });
  await apply("citra", "other", "be");
  await setFairApplicationStatus(db, { id: a.id, boothKey: "nusa", status: "Diterima" });
  await reviewBooth(db, { userId: ids.ani!, boothKey: "nusa", stars: 4 });

  // Spend: the registration, a bill paid with coins (counted at its rupiah price), a stand rented by
  // the team, and payments that are someone else's or never paid.
  const reg = await createRegistration(db, {
    userId: ids.hr!,
    company: "Nusa",
    industry: "IT",
    color: "#000000",
    city: "Jakarta",
    contactName: "HR",
    contactRole: "HR",
    email: "hr@mail.example",
    phone: "0812",
    tier: "regular",
    price: 7_500_000,
  });
  await payRegistration(db, reg.id, ids.hr!, "Koin");
  await db.execute(sql`update company_registrations set booth_key = 'nusa', status = 'verified' where id = ${reg.id}`);
  const paid = async (input: Parameters<typeof createPayment>[1]) => markPaid(db, (await createPayment(db, input)).id, "test");
  await paid({ userId: ids.hr!, kind: "invoice", ref: "nusa:inv-1", description: "VIP", amount: 12_500, meta: { rupiah: 2_500_000 }, provider: "koin" });
  await paid({ userId: ids.hr!, kind: "stall", ref: "food:1", description: "Stan", amount: 750_000, provider: "demo" });
  await paid({ userId: ids.ani!, kind: "stall", ref: "food:2", description: "Stan", amount: 750_000, provider: "demo" });
  await paid({ userId: ids.hr!, kind: "invoice", ref: "nusantara:inv-9", description: "Lain", amount: 99_000, provider: "demo" });
  await createPayment(db, { userId: ids.hr!, kind: "invoice", ref: "nusa:inv-2", description: "Belum", amount: 1_000_000, provider: "xendit" });
});

afterAll(async () => {
  await close();
});

describe("booth report", () => {
  it("adds up reach, applicants, the funnel, who applied and what one applicant cost", async () => {
    const r = await buildBoothReport(db, "nusa");
    expect(r.since).toBeNull();
    expect(r.reach).toMatchObject({ visits: 3, visitors: 2, promoClicks: 1 });
    expect(r.applicants).toBe(2);
    expect(r.applications).toBe(3);
    expect(r.hired).toBe(1);
    expect(r.funnel[0]).toEqual({ label: "Lamaran masuk", n: 3 });
    expect(r.funnel.at(-1)).toEqual({ label: "Diterima", n: 1 });
    expect(r.demographics.campus).toEqual([
      { label: "ITS", n: 1 },
      { label: "Tidak diisi", n: 1 },
    ]);
    expect(r.demographics.city.map((b) => b.label).sort()).toEqual(["Jakarta", "Surabaya"]);
    expect(r.demographics.education.map((b) => b.label).sort()).toEqual(["S1", "SMA/SMK"]);
    expect(r.verified).toBe(1);
    expect(r.rating).toEqual({ count: 1, average: 4 });
    expect(r.spend).toEqual({ registration: 7_500_000, invoices: 2_500_000, stalls: 750_000, total: 10_750_000 });
    expect(r.costPerApplicant).toBe(5_375_000);
    // Nothing personal is kept.
    expect(JSON.stringify(r)).not.toContain("@mail.example");
  });

  it("knows the booths that have a team, applicants or a registration", async () => {
    expect((await reportBoothKeys(db)).sort()).toEqual(["nusa", "other"]);
  });

  it("freezes every booth once per event name, and the next report starts after it", async () => {
    const first = new Date();
    expect(await freezeBoothReports(db, { eventName: "Job Fair Oktober 2026", boothKeys: ["nusa", "other", "nusa"], by: ids.org!, now: first })).toBe(2);
    await expect(freezeBoothReports(db, { eventName: "job fair oktober 2026", boothKeys: ["nusa"], by: ids.org! })).rejects.toBeInstanceOf(ReportNameTakenError);

    const list = await boothReportList(db, "nusa");
    expect(list.map((r) => r.eventName)).toEqual(["Job Fair Oktober 2026"]);
    const saved = await boothReportById(db, "nusa", list[0]!.id);
    expect(saved?.report.applicants).toBe(2);
    // Another booth's report can't be opened through this booth.
    expect(await boothReportById(db, "other", list[0]!.id)).toBeNull();
    expect((await closedEvents(db))[0]).toMatchObject({ eventName: "Job Fair Oktober 2026", booths: 2 });
    expect((await closedEvents(db))[0]!.at).toBeInstanceOf(Date);

    // The next event: only what happens after the freeze counts.
    await new Promise((r) => setTimeout(r, 20));
    await apply("citra", "nusa", "be", { city: "Medan" });
    await addStats(db, ids.citra!, today, [{ key: "visit:nusa", what: "view" }]);
    const next = await buildBoothReport(db, "nusa");
    expect(next.since).toBe(first.getTime());
    expect(next.applicants).toBe(1);
    expect(next.reach.visitors).toBe(1);
    expect(next.spend.total).toBe(0);
    expect(next.costPerApplicant).toBe(0);
  });
});
