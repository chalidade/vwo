// Applications sent from the live game. The game still carries its own event data (booths, jobs),
// so they are stored by the game's booth and job ids until fairs live in the database.
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairApplications } from "./jobfair-schema";
import { AlreadyAppliedError } from "./jobfair";
import { type ApplicationShared, mergeShared } from "@vwo/shared";

/** What a seeker can send. Each list stays short so one account cannot fill the table. */
export const FAIR_APPLICATION_LIMIT = 100;

export class TooManyApplicationsError extends Error {
  constructor() {
    super("too many applications");
  }
}

export type FairApplicationRow = typeof fairApplications.$inferSelect;

export async function submitFairApplication(db: Db, input: { userId: string; boothKey: string; jobKey: string; data: Record<string, unknown> }) {
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(fairApplications).where(eq(fairApplications.userId, input.userId))) as [{ n: number }];
  if (n >= FAIR_APPLICATION_LIMIT) throw new TooManyApplicationsError();
  const [row] = await db
    .insert(fairApplications)
    .values({ userId: input.userId, boothKey: input.boothKey, jobKey: input.jobKey, data: input.data })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new AlreadyAppliedError();
  return row;
}

/** The seeker's own applications, newest first. */
export function myFairApplications(db: Db, userId: string) {
  return db.select().from(fairApplications).where(eq(fairApplications.userId, userId)).orderBy(desc(fairApplications.createdAt)).limit(FAIR_APPLICATION_LIMIT);
}

/** Everyone who applied at one booth, newest first. */
export function boothFairApplications(db: Db, boothKey: string) {
  return db.select().from(fairApplications).where(eq(fairApplications.boothKey, boothKey)).orderBy(desc(fairApplications.createdAt)).limit(500);
}

/** The company's decision. Returns false when the application is not at that booth. */
export async function setFairApplicationStatus(db: Db, input: { id: string; boothKey: string; status: string }) {
  const rows = await db
    .update(fairApplications)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(eq(fairApplications.id, input.id), eq(fairApplications.boothKey, input.boothKey)))
    .returning({ id: fairApplications.id });
  return rows.length > 0;
}

/**
 * Add one side's part of the conversation. The seeker may only write to their own application,
 * the company only to one at its booth; returns false when the application is not theirs.
 */
export async function updateFairApplicationShared(
  db: Db,
  input: { id: string; as: "company" | "seeker"; userId: string; incoming: ApplicationShared },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(fairApplications).where(eq(fairApplications.id, input.id)).for("update");
    if (!row || (input.as === "seeker" && row.userId !== input.userId)) return false;
    const shared = mergeShared(row.shared as ApplicationShared, input.incoming, input.as);
    await tx.update(fairApplications).set({ shared, updatedAt: new Date() }).where(eq(fairApplications.id, input.id));
    return true;
  });
}

/** The company's private notes on one applicant at its booth. Leaves updated_at alone: the applicant sees nothing change. */
export async function setFairApplicationNotes(db: Db, input: { id: string; boothKey: string; notes: string }) {
  const rows = await db
    .update(fairApplications)
    .set({ companyNotes: input.notes })
    .where(and(eq(fairApplications.id, input.id), eq(fairApplications.boothKey, input.boothKey)))
    .returning({ id: fairApplications.id });
  return rows.length > 0;
}
