// The live game's shared event setup, one JSON document per key ("org", "company:<booth id>").
// Keys under "billing:" (the organiser's seller and bank details, buyers' invoice details) are
// private: the setup read below never returns them, only their own key reads do.
import { and, eq, notLike, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairState } from "./jobfair-schema";

export const PRIVATE_STATE_PREFIX = "billing:";

/** The event setup. Seekers' offers ("offers:<user id>", see fair-pool.ts) are personal and left out, and so are billing details. */
export function readFairState(db: Db) {
  return db
    .select({ key: fairState.key, data: fairState.data, updatedAt: fairState.updatedAt })
    .from(fairState)
    .where(and(sql`${fairState.key} not like 'offers:%'`, notLike(fairState.key, `${PRIVATE_STATE_PREFIX}%`)));
}

export async function readFairStateKey(db: Db, key: string) {
  const [row] = await db.select({ data: fairState.data, updatedAt: fairState.updatedAt }).from(fairState).where(eq(fairState.key, key));
  return row ?? null;
}

export async function writeFairState(db: Db, input: { key: string; data: unknown; userId: string }) {
  await db
    .insert(fairState)
    .values({ key: input.key, data: input.data, updatedBy: input.userId })
    .onConflictDoUpdate({ target: fairState.key, set: { data: input.data, updatedBy: input.userId, updatedAt: sql`now()` } });
}

export async function deleteFairState(db: Db, key: string) {
  await db.delete(fairState).where(eq(fairState.key, key));
}

/**
 * Read the documents and add one, under a lock: two writers deciding from the same documents (two
 * paid rentals wanting the same food court slot) take turns instead of both winning.
 */
export async function addFairStateLocked(db: Db, lock: string, userId: string, decide: (rows: { key: string; data: unknown }[]) => { key: string; data: unknown } | null) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:" + lock}))`);
    const rows = await tx.select({ key: fairState.key, data: fairState.data }).from(fairState);
    const doc = decide(rows);
    if (!doc) return null;
    await tx.insert(fairState).values({ key: doc.key, data: doc.data, updatedBy: userId }).onConflictDoNothing();
    return doc;
  });
}

/**
 * Change one document under a lock: `change` gets what is stored (null when nothing is) and returns
 * the new document, or null to leave it as it is. Two organisers changing it at once take turns.
 */
export async function updateFairStateLocked<T>(db: Db, key: string, userId: string, change: (data: unknown) => T | null) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:" + key}))`);
    const [row] = await tx.select({ data: fairState.data }).from(fairState).where(eq(fairState.key, key));
    const next = change(row ? row.data : null);
    if (next === null) return null;
    await tx
      .insert(fairState)
      .values({ key, data: next, updatedBy: userId })
      .onConflictDoUpdate({ target: fairState.key, set: { data: next, updatedBy: userId, updatedAt: sql`now()` } });
    return next;
  });
}
