// Applications sent from the live game. The game still carries its own event data (booths, jobs),
// so they are stored by the game's booth and job ids until fairs live in the database.
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairApplications } from "./jobfair-schema";
import { AlreadyAppliedError } from "./jobfair";

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
