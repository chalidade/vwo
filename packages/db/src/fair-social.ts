// Job seekers together: the weekly mini game leaderboard and friends met at the fair.
import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairScores } from "./jobfair-schema";
import { friendships, users } from "./schema";

export type ScoreGame = "2048" | "catch" | "memory";
/** Memory is won in the fewest moves; the others by the highest score. */
export const lowerIsBetter = (game: ScoreGame) => game === "memory";

/** Keep an account's result for the week when it beats their earlier one. Returns their best. */
export async function submitScore(db: Db, input: { userId: string; week: string; game: ScoreGame; score: number }) {
  const better = lowerIsBetter(input.game) ? sql`least(${fairScores.best}, excluded.best)` : sql`greatest(${fairScores.best}, excluded.best)`;
  const [row] = await db
    .insert(fairScores)
    .values({ userId: input.userId, week: input.week, game: input.game, best: input.score })
    .onConflictDoUpdate({
      target: [fairScores.userId, fairScores.week, fairScores.game],
      set: { best: better, updatedAt: sql`case when ${better} <> ${fairScores.best} then now() else ${fairScores.updatedAt} end` },
    })
    .returning({ best: fairScores.best });
  return row!.best;
}

/** The week's top players of one game (display names only), and this account's own place. */
export async function leaderboard(db: Db, input: { week: string; game: ScoreGame; userId?: string; limit?: number }) {
  const low = lowerIsBetter(input.game);
  const where = and(eq(fairScores.week, input.week), eq(fairScores.game, input.game));
  const top = await db
    .select({ tag: users.fairTag, name: users.displayName, best: fairScores.best })
    .from(fairScores)
    .innerJoin(users, eq(users.id, fairScores.userId))
    .where(where)
    // Ties go to whoever got there first.
    .orderBy(low ? asc(fairScores.best) : desc(fairScores.best), asc(fairScores.updatedAt))
    .limit(input.limit ?? 20);
  let me: { best: number; rank: number } | null = null;
  if (input.userId) {
    const [mine] = await db
      .select({ best: fairScores.best, at: fairScores.updatedAt })
      .from(fairScores)
      .where(and(where, eq(fairScores.userId, input.userId)));
    if (mine) {
      const ahead = low ? lt(fairScores.best, mine.best) : gt(fairScores.best, mine.best);
      const [r] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(fairScores)
        .where(and(where, or(ahead, and(eq(fairScores.best, mine.best), lt(fairScores.updatedAt, mine.at)))));
      me = { best: mine.best, rank: (r?.n ?? 0) + 1 };
    }
  }
  return { top: top.map((r) => ({ tag: r.tag, name: r.name, best: r.best })), me };
}

export type FriendState = "friend" | "sent" | "received";

/** Ask someone (by their public fair tag) to be friends; if they already asked us, it's mutual now. */
export async function addFriend(db: Db, userId: string, tag: string): Promise<FriendState | "not_found" | "self"> {
  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.fairTag, tag));
  if (!other) return "not_found";
  if (other.id === userId) return "self";
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterUserId, userId), eq(friendships.addresseeUserId, other.id)),
          and(eq(friendships.requesterUserId, other.id), eq(friendships.addresseeUserId, userId)),
        ),
      )
      .for("update");
    if (!row) {
      await tx.insert(friendships).values({ requesterUserId: userId, addresseeUserId: other.id }).onConflictDoNothing();
      return "sent";
    }
    if (row.status === "accepted") return "friend";
    if (row.requesterUserId === other.id) {
      // They asked first: saying yes back makes it mutual.
      await tx.update(friendships).set({ status: "accepted", respondedAt: new Date() }).where(eq(friendships.id, row.id));
      return "friend";
    }
    // Our own earlier request (or one they turned down): ask again.
    await tx.update(friendships).set({ status: "pending", respondedAt: null }).where(eq(friendships.id, row.id));
    return "sent";
  });
}

/** Unfriend, withdraw a request, or turn one down. */
export async function removeFriend(db: Db, userId: string, tag: string) {
  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.fairTag, tag));
  if (!other) return false;
  const rows = await db
    .delete(friendships)
    .where(
      or(
        and(eq(friendships.requesterUserId, userId), eq(friendships.addresseeUserId, other.id)),
        and(eq(friendships.requesterUserId, other.id), eq(friendships.addresseeUserId, userId)),
      ),
    )
    .returning({ id: friendships.id });
  return rows.length > 0;
}

/** Friends, requests we sent, and requests waiting for us: public tag and name only. */
export async function friendsOf(db: Db, userId: string) {
  const rows = await db
    .select({ requester: friendships.requesterUserId, status: friendships.status, tag: users.fairTag, name: users.displayName, at: friendships.createdAt })
    .from(friendships)
    .innerJoin(users, sql`${users.id} = case when ${friendships.requesterUserId} = ${userId} then ${friendships.addresseeUserId} else ${friendships.requesterUserId} end`)
    .where(and(or(eq(friendships.requesterUserId, userId), eq(friendships.addresseeUserId, userId)), sql`${friendships.status} <> 'declined'`))
    .orderBy(desc(friendships.createdAt))
    .limit(200);
  return rows.map((r) => ({
    tag: r.tag,
    name: r.name,
    state: (r.status === "accepted" ? "friend" : r.requester === userId ? "sent" : "received") as FriendState,
  }));
}
