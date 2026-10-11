// The live game's shared event setup, one JSON document per key ("org", "company:<booth id>").
// Keys under "billing:" (the organiser's seller and bank details, buyers' invoice details) and
// "semreg:" (who registered for a seminar, see seminar-registrations.ts) are private: the setup read
// below never returns them, only their own key reads do.
import { and, eq, notLike, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairState } from "./jobfair-schema";

export const PRIVATE_STATE_PREFIX = "billing:";
/** One document per seminar session listing who registered: the organiser's export reads it, nobody else. */
export const SEMINAR_REG_PREFIX = "semreg:";

/** The event setup. Seekers' offers ("offers:<user id>", see fair-pool.ts) are personal and left out, and so are billing details and seminar registrations. */
export function readFairState(db: Db) {
  return db
    .select({ key: fairState.key, data: fairState.data, updatedAt: fairState.updatedAt })
    .from(fairState)
    .where(and(sql`${fairState.key} not like 'offers:%'`, notLike(fairState.key, `${PRIVATE_STATE_PREFIX}%`), notLike(fairState.key, `${SEMINAR_REG_PREFIX}%`)));
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
 * Read the documents and write one (new or replacing), under a lock: the organiser moving stands
 * and a booking taking a slot decide from the same documents one after the other.
 */
export async function putFairStateLocked<T extends { key: string; data: unknown }>(
  db: Db,
  lock: string,
  userId: string,
  decide: (rows: { key: string; data: unknown }[]) => T | { error: string },
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:" + lock}))`);
    const rows = await tx.select({ key: fairState.key, data: fairState.data }).from(fairState);
    const doc = decide(rows);
    if ("error" in doc) return doc;
    await tx
      .insert(fairState)
      .values({ key: doc.key, data: doc.data, updatedBy: userId })
      .onConflictDoUpdate({ target: fairState.key, set: { data: doc.data, updatedBy: userId, updatedAt: sql`now()` } });
    return doc;
  });
}
