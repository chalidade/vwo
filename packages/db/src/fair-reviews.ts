// Job seekers' reviews of company booths in the live game.
import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairReviews } from "./jobfair-schema";

/** Write or change this account's review of a booth. Returns whether it is their first one there. */
export async function reviewBooth(db: Db, input: { userId: string; boothKey: string; stars: number }) {
  const [row] = await db
    .insert(fairReviews)
    .values({ userId: input.userId, boothKey: input.boothKey, stars: input.stars })
    .onConflictDoUpdate({ target: [fairReviews.userId, fairReviews.boothKey], set: { stars: input.stars, updatedAt: sql`now()` } })
    .returning({ first: sql<boolean>`(xmax = 0)` });
  return !!row?.first;
}

/** Every booth's review count and star total. */
export async function reviewTotals(db: Db) {
  const rows = await db
    .select({ boothKey: fairReviews.boothKey, count: sql<number>`count(*)::int`, sum: sql<number>`sum(${fairReviews.stars})::int` })
    .from(fairReviews)
    .groupBy(fairReviews.boothKey);
  return Object.fromEntries(rows.map((r) => [r.boothKey, { count: r.count, sum: r.sum }]));
}

/** This account's own stars, per booth. */
export async function myReviews(db: Db, userId: string) {
  const rows = await db.select({ boothKey: fairReviews.boothKey, stars: fairReviews.stars }).from(fairReviews).where(eq(fairReviews.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.boothKey, r.stars]));
}

