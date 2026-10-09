// Job fair rules against a real Postgres: coins can't be double-spent and a seeker applies once.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AlreadyAppliedError,
  JobClosedError,
  NotEnoughCoinsError,
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
