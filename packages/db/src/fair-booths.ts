// Company accounts in the live game: which accounts run which booth.
import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { fairApplications, fairBoothMembers } from "./jobfair-schema";
import { users } from "./schema";

/** The booths this account runs. */
export async function boothsOf(db: Db, userId: string) {
  const rows = await db.select({ boothKey: fairBoothMembers.boothKey }).from(fairBoothMembers).where(eq(fairBoothMembers.userId, userId));
  return rows.map((r) => r.boothKey);
}

export async function isBoothMember(db: Db, userId: string, boothKey: string) {
  const [row] = await db
    .select({ boothKey: fairBoothMembers.boothKey })
    .from(fairBoothMembers)
    .where(and(eq(fairBoothMembers.userId, userId), eq(fairBoothMembers.boothKey, boothKey)));
  return !!row;
}

export async function addBoothMember(db: Db, boothKey: string, userId: string) {
  await db.insert(fairBoothMembers).values({ boothKey, userId }).onConflictDoNothing();
}

export async function removeBoothMember(db: Db, boothKey: string, userId: string) {
  const rows = await db
    .delete(fairBoothMembers)
    .where(and(eq(fairBoothMembers.boothKey, boothKey), eq(fairBoothMembers.userId, userId)))
    .returning({ userId: fairBoothMembers.userId });
  return rows.length > 0;
}

/** Who runs a booth, for the organiser. */
export function boothMembers(db: Db, boothKey: string) {
  return db
    .select({ userId: users.id, email: users.email, name: users.displayName, since: fairBoothMembers.createdAt })
    .from(fairBoothMembers)
    .innerJoin(users, eq(users.id, fairBoothMembers.userId))
    .where(eq(fairBoothMembers.boothKey, boothKey))
    .orderBy(fairBoothMembers.createdAt);
}

/** The booth an application was sent to, so the caller can check who may answer it. */
export async function applicationBooth(db: Db, id: string) {
  const [row] = await db.select({ boothKey: fairApplications.boothKey }).from(fairApplications).where(eq(fairApplications.id, id));
  return row?.boothKey ?? null;
}
