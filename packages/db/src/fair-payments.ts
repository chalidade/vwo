// Payments through the gateway. A row is created before the buyer is sent to the checkout page and
// marked paid only after the gateway confirms it; the game then claims it once.
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairPayments } from "./jobfair-schema";

export type PaymentKind = "coins" | "registration" | "invoice" | "stall";
export type Payment = typeof fairPayments.$inferSelect;

export async function createPayment(
  db: Db,
  input: { userId: string; kind: PaymentKind; ref: string; description: string; amount: number; meta?: Record<string, unknown>; provider: string },
) {
  const [row] = await db
    .insert(fairPayments)
    .values({ ...input, meta: input.meta ?? {} })
    .returning();
  return row!;
}

export async function attachCheckout(db: Db, id: string, providerId: string, checkoutUrl: string) {
  await db.update(fairPayments).set({ providerId, checkoutUrl }).where(eq(fairPayments.id, id));
}

export async function paymentById(db: Db, id: string) {
  const [row] = await db.select().from(fairPayments).where(eq(fairPayments.id, id));
  return row ?? null;
}

/** A pending payment for the same thing at the same price, so a second click reuses its checkout page. */
export async function openPayment(db: Db, userId: string, kind: PaymentKind, ref: string, amount: number) {
  const [row] = await db
    .select()
    .from(fairPayments)
    .where(
      and(
        eq(fairPayments.userId, userId),
        eq(fairPayments.kind, kind),
        eq(fairPayments.ref, ref),
        eq(fairPayments.amount, amount),
        eq(fairPayments.status, "pending"),
        sql`${fairPayments.createdAt} > now() - interval '20 hours'`,
      ),
    )
    .orderBy(desc(fairPayments.createdAt))
    .limit(1);
  return row ?? null;
}

/** Pending → paid, once. Returns the row when this call is the one that changed it. */
export async function markPaid(db: Db, id: string, method: string | null) {
  const [row] = await db
    .update(fairPayments)
    .set({ status: "paid", method, paidAt: new Date() })
    .where(and(eq(fairPayments.id, id), eq(fairPayments.status, "pending")))
    .returning();
  return row ?? null;
}

export async function markClosed(db: Db, id: string, status: "expired" | "failed") {
  await db
    .update(fairPayments)
    .set({ status })
    .where(and(eq(fairPayments.id, id), eq(fairPayments.status, "pending")));
}

export function myPayments(db: Db, userId: string, kinds?: PaymentKind[]) {
  return db
    .select()
    .from(fairPayments)
    .where(and(eq(fairPayments.userId, userId), kinds?.length ? inArray(fairPayments.kind, kinds) : undefined))
    .orderBy(desc(fairPayments.createdAt))
    .limit(50);
}

/** The game took what was paid for. Only the first call wins, so coins are never added twice. */
export async function claimPayment(db: Db, id: string, userId: string) {
  const [row] = await db
    .update(fairPayments)
    .set({ claimedAt: new Date() })
    .where(and(eq(fairPayments.id, id), eq(fairPayments.userId, userId), eq(fairPayments.status, "paid"), isNull(fairPayments.claimedAt)))
    .returning();
  return row ?? null;
}

/** Paid company invoices of one booth (ref "<booth>:<invoice id>"), whoever paid them. */
export function paidInvoicesOf(db: Db, boothId: string) {
  return db
    .select()
    .from(fairPayments)
    .where(and(eq(fairPayments.kind, "invoice"), eq(fairPayments.status, "paid"), sql`${fairPayments.ref} like ${`${boothId.replace(/[\\%_]/g, "\\$&")}:%`}`));
}
