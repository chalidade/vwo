// Company registrations for the live game: form, demo payment, organiser verification.
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "./client";
import { companyRegistrations } from "./jobfair-schema";

export type CompanyRegistration = typeof companyRegistrations.$inferSelect;
export type NewCompanyRegistration = Omit<typeof companyRegistrations.$inferInsert, "id" | "status" | "paidAt" | "verifiedAt" | "verifiedBy" | "boothKey" | "pin" | "note" | "createdAt">;

export async function createRegistration(db: Db, input: NewCompanyRegistration) {
  const [row] = await db.insert(companyRegistrations).values(input).returning();
  return row!;
}

/** This account's registrations, newest first. */
export function myRegistrations(db: Db, userId: string) {
  return db.select().from(companyRegistrations).where(eq(companyRegistrations.userId, userId)).orderBy(desc(companyRegistrations.createdAt));
}

/** Every registration, newest first, for the organiser. */
export function allRegistrations(db: Db) {
  return db.select().from(companyRegistrations).orderBy(desc(companyRegistrations.createdAt)).limit(500);
}

export async function registrationById(db: Db, id: string) {
  const [row] = await db.select().from(companyRegistrations).where(eq(companyRegistrations.id, id));
  return row ?? null;
}

/** Demo payment by the account that registered. Only an unpaid registration can be paid. */
export async function payRegistration(db: Db, id: string, userId: string, method: string) {
  const rows = await db
    .update(companyRegistrations)
    .set({ status: "paid", method, paidAt: new Date() })
    .where(and(eq(companyRegistrations.id, id), eq(companyRegistrations.userId, userId), eq(companyRegistrations.status, "unpaid")))
    .returning({ id: companyRegistrations.id });
  return rows.length > 0;
}

/** The organiser accepts a paid registration: its booth and PIN are recorded. */
export async function verifyRegistration(db: Db, id: string, by: string, boothKey: string, pin: string) {
  const rows = await db
    .update(companyRegistrations)
    .set({ status: "verified", verifiedAt: new Date(), verifiedBy: by, boothKey, pin })
    .where(and(eq(companyRegistrations.id, id), eq(companyRegistrations.status, "paid")))
    .returning({ id: companyRegistrations.id });
  return rows.length > 0;
}

export async function rejectRegistration(db: Db, id: string, by: string, note: string) {
  const rows = await db
    .update(companyRegistrations)
    .set({ status: "rejected", verifiedAt: new Date(), verifiedBy: by, note })
    .where(and(eq(companyRegistrations.id, id), inArray(companyRegistrations.status, ["unpaid", "paid"])))
    .returning({ id: companyRegistrations.id });
  return rows.length > 0;
}

/** Whether this account has a registration the organiser verified (it may see the app before launch). */
export async function hasVerifiedRegistration(db: Db, userId: string) {
  const [row] = await db
    .select({ id: companyRegistrations.id })
    .from(companyRegistrations)
    .where(and(eq(companyRegistrations.userId, userId), eq(companyRegistrations.status, "verified")))
    .limit(1);
  return !!row;
}
