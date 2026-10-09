// The organiser's price list in the live game.
import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairPrices } from "./jobfair-schema";

/** Every price the organiser changed, by key. */
export async function readPrices(db: Db) {
  const rows = await db.select({ key: fairPrices.key, amount: fairPrices.amount }).from(fairPrices);
  return Object.fromEntries(rows.map((r) => [r.key, r.amount])) as Record<string, number>;
}

/** Save prices (already checked against the catalog). Keys not given keep their row. */
export async function writePrices(db: Db, prices: Record<string, number>, userId: string) {
  const rows = Object.entries(prices).map(([key, amount]) => ({ key, amount, updatedBy: userId }));
  if (!rows.length) return;
  await db
    .insert(fairPrices)
    .values(rows)
    .onConflictDoUpdate({ target: fairPrices.key, set: { amount: sql`excluded.amount`, updatedBy: sql`excluded.updated_by`, updatedAt: sql`now()` } });
}
