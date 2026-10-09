// Job fair rules against a real Postgres: coins can't be double-spent and a seeker applies once.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  attachCheckout,
  claimPayment,
  createPayment,
  markPaid,
  openPayment,
  paidInvoicesOf,
  AlreadyAppliedError,
  JobClosedError,
  NotEnoughCoinsError,
  addBoothMember,
  earlyAccessFor,
  earlyAccessList,
  grantEarlyAccess,
  revokeEarlyAccess,
  createRegistration,
  hasVerifiedRegistration,
  myRegistrations,
  payRegistration,
  rejectRegistration,
  verifyRegistration,
  readPrices,
  writePrices,
  boothMembers,
  boothsOf,
  isBoothMember,
  removeBoothMember,
  applyToJob,
  boothFairApplications,
  coinBalance,
  createDb,
  grantCoins,
  myFairApplications,
  readFairPlayer,
  setFairApplicationStatus,
  spendCoins,
  submitFairApplication,
  updateFairApplicationShared,
  writeFairPlayer,
} from "../src";
import { applications, booths, companies, fairs, jobs, users } from "../src/schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);

let seeker: string;
let jobId: string;
let closedJobId: string;

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  [{ id: seeker }] = (await db.insert(users).values({ email: "sari@mail.example", displayName: "Sari" }).returning({ id: users.id })) as [{ id: string }];
  const [fair] = await db.insert(fairs).values({ slug: "jobfair-okt", name: "Job Fair Oktober" }).returning();
  const [company] = await db.insert(companies).values({ name: "TokoKita" }).returning();
  const [booth] = await db.insert(booths).values({ fairId: fair!.id, companyId: company!.id, hallIndex: 0, slot: 0 }).returning();
  const made = await db
    .insert(jobs)
    .values([
      { boothId: booth!.id, title: "QA Engineer" },
      { boothId: booth!.id, title: "Marketing", open: false },
    ])
    .returning();
  jobId = made[0]!.id;
  closedJobId = made[1]!.id;
});

afterAll(async () => {
  await close();
});

describe("coins", () => {
  it("grants once per key and sums the ledger", async () => {
    expect(await grantCoins(db, { userId: seeker, amount: 50, reason: "Koin harian", key: "daily:2026-10-09:sari" })).toBe(true);
    expect(await grantCoins(db, { userId: seeker, amount: 50, reason: "Koin harian", key: "daily:2026-10-09:sari" })).toBe(false);
    expect(await coinBalance(db, seeker)).toBe(50);
  });

  it("never spends more than the balance, even when taps race", async () => {
    const tries = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => spendCoins(db, { userId: seeker, amount: 15, reason: "Badge", key: `race:${i}` })),
    );
    const ok = tries.filter((t) => t.status === "fulfilled").length;
    expect(ok).toBe(3);
    expect(tries.filter((t) => t.status === "rejected").every((t) => (t as PromiseRejectedResult).reason instanceof NotEnoughCoinsError)).toBe(true);
    expect(await coinBalance(db, seeker)).toBe(5);
  });

  it("treats a retried charge as already done", async () => {
    await grantCoins(db, { userId: seeker, amount: 20, reason: "Misi", key: "mission:1:sari" });
    expect(await spendCoins(db, { userId: seeker, amount: 10, reason: "Voucher", key: "voucher:1" })).toBe(true);
    expect(await spendCoins(db, { userId: seeker, amount: 10, reason: "Voucher", key: "voucher:1" })).toBe(false);
    expect(await coinBalance(db, seeker)).toBe(15);
  });
});

describe("applications", () => {
  it("charges once and records consent", async () => {
    const id = await applyToJob(db, { userId: seeker, jobId, cost: 10, consent: true });
    const [row] = await db.select().from(applications).where(sql`${applications.id} = ${id}`);
    expect(row?.consentAt).toBeInstanceOf(Date);
    expect(await coinBalance(db, seeker)).toBe(5);
    await expect(applyToJob(db, { userId: seeker, jobId, cost: 10, consent: true })).rejects.toBeInstanceOf(AlreadyAppliedError);
    expect(await coinBalance(db, seeker)).toBe(5);
  });

  it("refuses closed jobs and short balances without charging", async () => {
    await expect(applyToJob(db, { userId: seeker, jobId: closedJobId, cost: 1, consent: true })).rejects.toBeInstanceOf(JobClosedError);
    const [other] = await db.insert(users).values({ email: "budi@mail.example", displayName: "Budi" }).returning();
    await expect(applyToJob(db, { userId: other!.id, jobId, cost: 10, consent: true })).rejects.toBeInstanceOf(NotEnoughCoinsError);
    expect(await db.$count(applications)).toBe(1);
  });
});

describe("live game applications", () => {
  const data = { company: "TokoKita", jobTitle: "QA Engineer", name: "Sari", email: "sari@mail.example" };

  it("keeps one application per seeker and job, visible to the seeker and the booth", async () => {
    const row = await submitFairApplication(db, { userId: seeker, boothKey: "toko-kita", jobKey: "tk-qa", data });
    await expect(submitFairApplication(db, { userId: seeker, boothKey: "toko-kita", jobKey: "tk-qa", data })).rejects.toBeInstanceOf(AlreadyAppliedError);
    expect((await myFairApplications(db, seeker)).map((a) => a.id)).toEqual([row.id]);
    expect((await boothFairApplications(db, "toko-kita")).map((a) => a.id)).toEqual([row.id]);
    expect(await boothFairApplications(db, "other-booth")).toEqual([]);
  });

  it("lets only the booth that received an application change its status", async () => {
    const [row] = await boothFairApplications(db, "toko-kita");
    expect(await setFairApplicationStatus(db, { id: row!.id, boothKey: "other-booth", status: "Shortlist" })).toBe(false);
    expect(await setFairApplicationStatus(db, { id: row!.id, boothKey: "toko-kita", status: "Shortlist" })).toBe(true);
    expect((await myFairApplications(db, seeker))[0]!.status).toBe("Shortlist");
  });

  it("keeps both sides of the conversation, and each side only writes its own part", async () => {
    const [row] = await myFairApplications(db, seeker);
    const id = row!.id;
    const invite = { at: 5, mode: "Video call", place: "meet.example/abc" };
    expect(
      await updateFairApplicationShared(db, {
        id,
        as: "company",
        userId: "00000000-0000-0000-0000-000000000000",
        incoming: { messages: [{ at: 1, from: "company", text: "Halo Sari" }], interview: invite, rating: 4, calls: [{ at: 3, kind: "voice", answered: true, seconds: 60 }] },
      }),
    ).toBe(true);
    // The seeker's copy tries to rewrite the company's part; only the reply and its own message count.
    expect(
      await updateFairApplicationShared(db, {
        id,
        as: "seeker",
        userId: seeker,
        incoming: { messages: [{ at: 2, from: "seeker", text: "Siap" }, { at: 9, from: "company", text: "palsu" }], interview: { ...invite, place: "evil.example", reply: "hadir" }, rating: 5 },
      }),
    ).toBe(true);
    const [after] = await myFairApplications(db, seeker);
    const shared = after!.shared as Record<string, unknown>;
    expect(shared.messages).toEqual([
      { at: 1, from: "company", text: "Halo Sari" },
      { at: 2, from: "seeker", text: "Siap" },
    ]);
    expect(shared.interview).toEqual({ ...invite, reply: "hadir" });
    expect(shared.rating).toBe(4);
    // Someone else's account cannot write as this seeker.
    expect(await updateFairApplicationShared(db, { id, as: "seeker", userId: "00000000-0000-0000-0000-000000000000", incoming: {} })).toBe(false);
  });
});

describe("live game progress", () => {
  it("saves per account and refuses a save made on top of an older copy", async () => {
    expect(await readFairPlayer(db, seeker)).toBeNull();
    expect(await writeFairPlayer(db, { userId: seeker, rev: 0, data: { coins: 10 } })).toBe(1);
    // A second device that also thought nothing was saved yet.
    expect(await writeFairPlayer(db, { userId: seeker, rev: 0, data: { coins: 99 } })).toBeNull();
    expect(await writeFairPlayer(db, { userId: seeker, rev: 1, data: { coins: 20 } })).toBe(2);
    expect(await writeFairPlayer(db, { userId: seeker, rev: 1, data: { coins: 99 } })).toBeNull();
    expect(await readFairPlayer(db, seeker)).toEqual({ data: { coins: 20 }, rev: 2 });
  });
});

describe("company accounts", () => {
  it("lets an account join a booth once, list it, and be taken off it", async () => {
    expect(await boothsOf(db, seeker)).toEqual([]);
    await addBoothMember(db, "nusantara-tech", seeker);
    await addBoothMember(db, "nusantara-tech", seeker);
    expect(await boothsOf(db, seeker)).toEqual(["nusantara-tech"]);
    expect(await isBoothMember(db, seeker, "nusantara-tech")).toBe(true);
    expect(await isBoothMember(db, seeker, "other-booth")).toBe(false);
    expect((await boothMembers(db, "nusantara-tech")).map((m) => m.email)).toEqual(["sari@mail.example"]);
    expect(await removeBoothMember(db, "nusantara-tech", seeker)).toBe(true);
    expect(await removeBoothMember(db, "nusantara-tech", seeker)).toBe(false);
    expect(await boothsOf(db, seeker)).toEqual([]);
  });
});

describe("price list", () => {
  it("keeps one row per price, overwriting on save, and refuses negative amounts", async () => {
    expect(await readPrices(db)).toEqual({});
    await writePrices(db, { "coin.apply": 7, "stand.regular": 5_000_000 }, seeker);
    await writePrices(db, { "coin.apply": 8 }, seeker);
    expect(await readPrices(db)).toEqual({ "coin.apply": 8, "stand.regular": 5_000_000 });
    await expect(writePrices(db, { "coin.apply": -1 }, seeker)).rejects.toThrow();
  });
});

describe("company registrations", () => {
  it("goes unpaid → paid → verified only in that order, and only the registrant pays", async () => {
    const reg = await createRegistration(db, { userId: seeker, company: "Kopi Nusa", industry: "F&B", color: "#16a34a", website: null, city: "Bandung", contactName: "Dewi", contactRole: "HR", email: "hr@kopinusa.example", phone: "0812", tier: "regular", price: 7_500_000 });
    expect(reg.status).toBe("unpaid");
    expect(await verifyRegistration(db, reg.id, seeker, "kopi-nusa", "123456")).toBe(false);
    expect(await payRegistration(db, reg.id, "00000000-0000-0000-0000-000000000000", "QRIS")).toBe(false);
    expect(await payRegistration(db, reg.id, seeker, "QRIS")).toBe(true);
    expect(await payRegistration(db, reg.id, seeker, "QRIS")).toBe(false);
    expect(await hasVerifiedRegistration(db, seeker)).toBe(false);
    expect(await verifyRegistration(db, reg.id, seeker, "kopi-nusa", "123456")).toBe(true);
    expect(await rejectRegistration(db, reg.id, seeker, "telat")).toBe(false);
    expect(await hasVerifiedRegistration(db, seeker)).toBe(true);
    expect((await myRegistrations(db, seeker))[0]).toMatchObject({ status: "verified", boothKey: "kopi-nusa", pin: "123456" });
  });
});

describe("early access", () => {
  it("is keyed by lowercased email, keeps a booth only for company testers, and can be revoked", async () => {
    await grantEarlyAccess(db, { email: " Tester@Example.com ", role: "seeker", boothKey: "data-raya", addedBy: seeker });
    expect(await earlyAccessFor(db, "tester@example.com")).toMatchObject({ role: "seeker", boothKey: null });
    await grantEarlyAccess(db, { email: "tester@example.com", role: "company", boothKey: "data-raya", note: "HR teman", addedBy: seeker });
    expect(await earlyAccessFor(db, "TESTER@example.com")).toMatchObject({ role: "company", boothKey: "data-raya", note: "HR teman" });
    expect((await earlyAccessList(db)).length).toBe(1);
    await expect(db.execute(sql`insert into early_access (email, role) values ('x@example.com', 'admin')`)).rejects.toThrow();
    const [u] = await db.insert(users).values({ email: "Tester@example.com", displayName: "Tester" }).returning();
    await addBoothMember(db, "data-raya", u!.id);
    await grantEarlyAccess(db, { email: "tester@example.com", role: "company", boothKey: "gim-nusantara", addedBy: seeker });
    expect(await boothsOf(db, u!.id)).toEqual([]);
    await addBoothMember(db, "gim-nusantara", u!.id);
    expect((await revokeEarlyAccess(db, "tester@example.com"))?.boothKey).toBe("gim-nusantara");
    expect(await boothsOf(db, u!.id)).toEqual([]);
    expect(await earlyAccessFor(db, "tester@example.com")).toBeNull();
  });
});

describe("payments", () => {
  it("is paid once, claimed once, reused while open, and found per booth", async () => {
    const p = await createPayment(db, { userId: seeker, kind: "coins", ref: "koin-120", description: "120 koin", amount: 20_000, provider: "xendit" });
    expect(p.status).toBe("pending");
    await attachCheckout(db, p.id, "inv_123", "https://checkout.example/inv_123");
    expect((await openPayment(db, seeker, "coins", "koin-120", 20_000))?.checkoutUrl).toBe("https://checkout.example/inv_123");
    expect(await openPayment(db, seeker, "coins", "koin-120", 25_000)).toBeNull();
    expect(await claimPayment(db, p.id, seeker)).toBeNull();
    expect((await markPaid(db, p.id, "Xendit · QRIS"))?.status).toBe("paid");
    expect(await markPaid(db, p.id, "Xendit · QRIS")).toBeNull();
    expect(await openPayment(db, seeker, "coins", "koin-120", 20_000)).toBeNull();
    expect(await claimPayment(db, p.id, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await claimPayment(db, p.id, seeker)).not.toBeNull();
    expect(await claimPayment(db, p.id, seeker)).toBeNull();
    await expect(createPayment(db, { userId: seeker, kind: "coins", ref: "x", description: "x", amount: 0, provider: "demo" })).rejects.toThrow();

    const inv = await createPayment(db, { userId: seeker, kind: "invoice", ref: "data_raya:inv-1", description: "Tagihan", amount: 2_500_000, meta: { items: [{ id: "vip", name: "VIP", price: 2_500_000 }] }, provider: "demo" });
    await createPayment(db, { userId: seeker, kind: "invoice", ref: "dataXraya:inv-2", description: "Tagihan", amount: 1, provider: "demo" }).then((x) => markPaid(db, x.id, null));
    expect(await paidInvoicesOf(db, "data_raya")).toEqual([]);
    await markPaid(db, inv.id, null);
    expect((await paidInvoicesOf(db, "data_raya")).map((x) => x.ref)).toEqual(["data_raya:inv-1"]);
  });
});
