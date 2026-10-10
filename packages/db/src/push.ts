// Web Push subscriptions: which browsers and phones of an account get notifications outside the app.
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./client";
import { fairApplications, fairBoothMembers, pushSubscriptions } from "./jobfair-schema";
import { users } from "./schema";

/** At most this many devices per account; the oldest goes when a new one signs up. */
const PER_USER = 10;

export async function savePushSubscription(db: Db, input: { userId: string; endpoint: string; p256dh: string; auth: string }) {
  await db
    .insert(pushSubscriptions)
    .values(input)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: input.userId, p256dh: input.p256dh, auth: input.auth } });
  const all = await db.select({ endpoint: pushSubscriptions.endpoint, at: pushSubscriptions.createdAt }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, input.userId));
  const extra = all.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(PER_USER);
  if (extra.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, extra.map((x) => x.endpoint)));
}

export async function deletePushSubscription(db: Db, input: { userId: string; endpoint: string }) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, input.endpoint), eq(pushSubscriptions.userId, input.userId)));
}

/** A subscription the push service says is gone (the user turned notifications off, or reinstalled). */
export async function dropPushEndpoint(db: Db, endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export function pushSubscriptionsOf(db: Db, userIds: string[]) {
  if (!userIds.length) return Promise.resolve([]);
  return db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
}

/** The accounts on a booth's team. */
export async function boothMemberIds(db: Db, boothKey: string) {
  const rows = await db.select({ userId: fairBoothMembers.userId }).from(fairBoothMembers).where(eq(fairBoothMembers.boothKey, boothKey));
  return rows.map((r) => r.userId);
}

/** One application as stored, for working out who to tell about a change. */
export async function fairApplicationById(db: Db, id: string) {
  const [row] = await db.select().from(fairApplications).where(eq(fairApplications.id, id));
  return row ?? null;
}

/** The account behind a public fair tag. */
export async function userIdByTag(db: Db, tag: string) {
  const [row] = await db.select({ id: users.id, name: users.displayName }).from(users).where(eq(users.fairTag, tag));
  return row ?? null;
}
