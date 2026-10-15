// Small state for the bot checks on the public forms, kept in tables that exist already: a "hold"
// is a rate_limits row that only says "until when" (an event in slow mode), and what a sign-up kept
// about how it was sent sits in its data under "_sig" (see @vwo/shared antibot.ts SignupSignals).
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client";
import { preregRegistrations } from "./jobfair-schema";
import { rateLimits } from "./schema";

/** When the hold on `key` ends, or null when there is none now. */
export async function holdUntil(db: Db, key: string) {
  const [row] = await db
    .select({ resetAt: rateLimits.resetAt })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), sql`${rateLimits.resetAt} > now()`));
  return row?.resetAt ?? null;
}

/** Hold `key` for `ms` from now (a later end already set is kept). */
export async function setHold(db: Db, key: string, ms: number) {
  await db.execute(sql`
    insert into rate_limits (key, count, reset_at) values (${key}, 0, now() + ${ms} * interval '1 millisecond')
    on conflict (key) do update set reset_at = greatest(rate_limits.reset_at, excluded.reset_at)`);
}

/** The organiser removes many sign-ups of one event at once (spam). Returns how many went. */
export async function deletePreregs(db: Db, eventId: string, ids: string[]) {
  if (!ids.length) return 0;
  const rows = await db
    .delete(preregRegistrations)
    .where(and(eq(preregRegistrations.eventId, eventId), inArray(preregRegistrations.id, ids)))
    .returning({ id: preregRegistrations.id });
  return rows.length;
}

/** A sign-up of this event by its code alone; the caller still checks it belongs to the email given. */
export async function preregByCode(db: Db, eventId: string, code: string) {
  const [row] = await db
    .select()
    .from(preregRegistrations)
    .where(and(eq(preregRegistrations.eventId, eventId), eq(preregRegistrations.code, code)));
  return row ?? null;
}
