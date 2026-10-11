// The live game's shared event setup, one JSON document per key ("org", "company:<booth id>").
// Keys under "billing:" (the organiser's seller and bank details, buyers' invoice details) are
// private: the setup read below never returns them, only their own key reads do.
import { eq, notLike, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairState } from "./jobfair-schema";

export const PRIVATE_STATE_PREFIX = "billing:";

export function readFairState(db: Db) {
  return db
    .select({ key: fairState.key, data: fairState.data, updatedAt: fairState.updatedAt })
    .from(fairState)
    .where(notLike(fairState.key, `${PRIVATE_STATE_PREFIX}%`));
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
