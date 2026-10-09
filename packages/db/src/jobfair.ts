// Job fair rules that must hold on the server: coin balances and applications.
// A user's coin rows are written under a per-user advisory lock, so two taps at once cannot spend
// the same coins twice, and every write carries an idempotency key, so a retried request is a no-op.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { applicationEvents, applications, coinLedger, jobs } from "./jobfair-schema";

export class NotEnoughCoinsError extends Error {
  constructor(
    readonly balance: number,
    readonly needed: number,
  ) {
    super(`not enough coins: has ${balance}, needs ${needed}`);
  }
}
export class AlreadyAppliedError extends Error {
  constructor() {
    super("already applied to this job");
  }
}
export class JobClosedError extends Error {
  constructor() {
    super("job is closed or does not exist");
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function lockUser(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"coins:" + userId}))`);
}

async function balanceIn(tx: Tx | Db, userId: string) {
  const [row] = await tx.select({ sum: sql<string | null>`sum(${coinLedger.delta})` }).from(coinLedger).where(eq(coinLedger.userId, userId));
  return Number(row?.sum ?? 0);
}

export function coinBalance(db: Db, userId: string) {
  return balanceIn(db, userId);
}

/** Add coins (daily gift, mission, top-up). Returns false if this key was already granted. */
export async function grantCoins(db: Db, input: { userId: string; amount: number; reason: string; key: string; fairId?: string; refId?: string }) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new RangeError("amount must be a positive integer");
  const rows = await db
    .insert(coinLedger)
    .values({ userId: input.userId, fairId: input.fairId, delta: input.amount, reason: input.reason, refId: input.refId, idempotencyKey: input.key })
    .onConflictDoNothing({ target: coinLedger.idempotencyKey })
    .returning({ id: coinLedger.id });
  return rows.length > 0;
}

/** Charge coins inside a transaction the caller already holds. */
async function chargeIn(tx: Tx, input: { userId: string; amount: number; reason: string; key: string; fairId?: string; refId?: string }) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new RangeError("amount must be a positive integer");
  await lockUser(tx, input.userId);
  const [done] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.idempotencyKey, input.key));
  if (done) return false;
  const balance = await balanceIn(tx, input.userId);
  if (balance < input.amount) throw new NotEnoughCoinsError(balance, input.amount);
  await tx
    .insert(coinLedger)
    .values({ userId: input.userId, fairId: input.fairId, delta: -input.amount, reason: input.reason, refId: input.refId, idempotencyKey: input.key });
  return true;
}

/** Spend coins. Returns false if this key was already charged; throws NotEnoughCoinsError when short. */
export function spendCoins(db: Db, input: { userId: string; amount: number; reason: string; key: string; fairId?: string; refId?: string }) {
  return db.transaction((tx) => chargeIn(tx, input));
}

/** Apply to a job, paying `cost` coins (0 for a free voucher), with the seeker's consent recorded. */
export async function applyToJob(db: Db, input: { userId: string; jobId: string; cost: number; note?: string; consent: true; fairId?: string }) {
  return db.transaction(async (tx) => {
    const [job] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.open, true)));
    if (!job) throw new JobClosedError();
    const [existing] = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.jobId, input.jobId), eq(applications.userId, input.userId)));
    if (existing) throw new AlreadyAppliedError();
    if (input.cost > 0) {
      await chargeIn(tx, { userId: input.userId, amount: input.cost, reason: "Lamaran", key: `apply:${input.jobId}:${input.userId}`, fairId: input.fairId, refId: input.jobId });
    }
    const [app] = await tx
      .insert(applications)
      .values({ jobId: input.jobId, userId: input.userId, note: input.note, consentAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: applications.id });
    if (!app) throw new AlreadyAppliedError();
    await tx.insert(applicationEvents).values({ applicationId: app.id, actorId: input.userId, status: "submitted" });
    return app.id;
  });
}
