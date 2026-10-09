// Job fair rules against a real Postgres: coins can't be double-spent and a seeker applies once.
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AlreadyAppliedError, JobClosedError, NotEnoughCoinsError, applyToJob, coinBalance, createDb, grantCoins, spendCoins } from "../src";
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
