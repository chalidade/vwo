// One account's progress in the live game, saved as a whole document with a revision number.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairPlayers } from "./jobfair-schema";

export async function readFairPlayer(db: Db, userId: string) {
  const [row] = await db.select({ data: fairPlayers.data, rev: fairPlayers.rev }).from(fairPlayers).where(eq(fairPlayers.userId, userId));
  return row ?? null;
}

/**
 * Save on top of revision `rev` (0 when the account has none yet). Returns the new revision, or
 * null when another device saved first; the caller then sends back what is stored now.
 */
export async function writeFairPlayer(db: Db, input: { userId: string; rev: number; data: unknown }) {
  if (input.rev === 0) {
    const rows = await db.insert(fairPlayers).values({ userId: input.userId, data: input.data, rev: 1 }).onConflictDoNothing().returning({ rev: fairPlayers.rev });
    return rows[0]?.rev ?? null;
  }
  const rows = await db
    .update(fairPlayers)
    .set({ data: input.data, rev: sql`${fairPlayers.rev} + 1`, updatedAt: sql`now()` })
    .where(and(eq(fairPlayers.userId, input.userId), eq(fairPlayers.rev, input.rev)))
    .returning({ rev: fairPlayers.rev });
  return rows[0]?.rev ?? null;
}
