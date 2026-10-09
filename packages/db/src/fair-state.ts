// The live game's shared event setup, one JSON document per key ("org", "company:<booth id>").
import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairState } from "./jobfair-schema";

export function readFairState(db: Db) {
  return db.select({ key: fairState.key, data: fairState.data, updatedAt: fairState.updatedAt }).from(fairState);
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
