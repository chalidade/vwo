// Housekeeping: rows nobody will read again, so the database doesn't fill up with junk.
import { sql } from "drizzle-orm";
import type { Db } from "./client";

/** How long each kind of leftover is kept. */
export const KEEP = {
  /** The organiser's live feed of what happened at the fair. */
  eventsDays: 30,
  /** Weekly leaderboards: this week, plus a few past ones. */
  scoresDays: 60,
  /** Friend requests nobody answered. */
  friendRequestsDays: 30,
  /** Used or expired email links (verify, reset password). */
  emailTokensDays: 2,
} as const;

/** Delete what has outlived its use. Returns how many rows went, per table. */
export async function cleanupJunk(db: Db) {
  const n = async (q: ReturnType<typeof sql>) => (await db.execute(q)).count ?? 0;
  return {
    sessions: await n(sql`delete from sessions where expires_at < now()`),
    emailTokens: await n(sql`delete from email_tokens where expires_at < now() - make_interval(days => ${KEEP.emailTokensDays}) or used_at < now() - make_interval(days => ${KEEP.emailTokensDays})`),
    rateLimits: await n(sql`delete from rate_limits where reset_at < now() - interval '1 hour'`),
    events: await n(sql`delete from fair_events where created_at < now() - make_interval(days => ${KEEP.eventsDays})`),
    scores: await n(sql`delete from fair_scores where updated_at < now() - make_interval(days => ${KEEP.scoresDays})`),
    friendRequests: await n(sql`delete from friendships where status <> 'accepted' and created_at < now() - make_interval(days => ${KEEP.friendRequestsDays})`),
  };
}
