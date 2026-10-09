import { sql } from "drizzle-orm";
import type { Db } from "./client";

/**
 * True when `key` may do one more action: at most `limit` per `windowMs`. The counter lives in
 * Postgres so every app instance (and every serverless function) shares it.
 */
export async function allowAction(db: Db, key: string, limit: number, windowMs: number): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    on conflict (key) do update set
      count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end
    returning count`);
  // Now and then, drop windows that have ended so the table stays small.
  if (Math.random() < 0.01) await db.execute(sql`delete from rate_limits where reset_at < now() - interval '1 hour'`);
  return Number(rows[0]?.count ?? 1) <= limit;
}
