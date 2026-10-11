// Inviting friends: every account's public fair tag doubles as its referral code. When a new account
// joins with someone's code, both get coins once. The coin ledger is the record: the keys
// "referral-in:<new account>" and "referral-out:<new account>" make each join pay out only once,
// and the inviter's "referral-out:" rows count the friends they brought.
import { and, eq, like, sql } from "drizzle-orm";
import type { Db } from "./client";
import { coinLedger, fairPlayers } from "./jobfair-schema";
import { grantCoins } from "./jobfair";
import { users } from "./schema";

/** Friends that still pay the inviter; more can join, they just don't earn more coins. */
export const REFERRAL_CAP = 50;
/** A code is only taken by an account this new, so old accounts can't swap codes around. */
export const REFERRAL_WINDOW_MS = 14 * 86_400_000;

export type ReferralResult = "ok" | "unknown_code" | "self" | "already" | "too_old" | "cap";

export async function referralCount(db: Db, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`, coins: sql<string | null>`sum(${coinLedger.delta})` })
    .from(coinLedger)
    .where(and(eq(coinLedger.userId, userId), like(coinLedger.idempotencyKey, "referral-out:%")));
  return { friends: row?.n ?? 0, coins: Number(row?.coins ?? 0) };
}

/** Who brought this account in, if anyone. */
export async function referredBy(db: Db, userId: string) {
  const [row] = await db
    .select({ refId: coinLedger.refId })
    .from(coinLedger)
    .where(eq(coinLedger.idempotencyKey, `referral-in:${userId}`));
  return row?.refId ?? null;
}

/** Take a friend's code for a new account: both get `reward` coins, once per new account. */
export async function claimReferral(db: Db, input: { userId: string; code: string; reward: number; now?: Date }): Promise<ReferralResult> {
  const code = input.code.trim().toLowerCase();
  if (!/^[0-9a-f]{6,16}$/.test(code)) return "unknown_code";
  const [inviter] = await db.select({ id: users.id, name: users.displayName }).from(users).where(eq(users.fairTag, code));
  if (!inviter) return "unknown_code";
  if (inviter.id === input.userId) return "self";
  if (await referredBy(db, input.userId)) return "already";
  const [me] = await db.select({ createdAt: users.createdAt, name: users.displayName }).from(users).where(eq(users.id, input.userId));
  if (!me) return "unknown_code";
  const now = input.now ?? new Date();
  if (now.getTime() - me.createdAt.getTime() > REFERRAL_WINDOW_MS) return "too_old";
  // The newcomer's coins first: their key is what stops a second claim, whatever happens next.
  const got = await grantCoins(db, {
    userId: input.userId,
    amount: input.reward,
    reason: `Bonus gabung lewat ajakan ${inviter.name}`,
    key: `referral-in:${input.userId}`,
    refId: inviter.id,
  });
  if (!got) return "already";
  if ((await referralCount(db, inviter.id)).friends >= REFERRAL_CAP) return "cap";
  await grantCoins(db, { userId: inviter.id, amount: input.reward, reason: `Bonus ajak teman: ${me.name} bergabung`, key: `referral-out:${input.userId}`, refId: input.userId });
  return "ok";
}

export interface CampusRow {
  campus: string;
  members: number;
  xp: number;
}

/** Campus names as people type them ("ITB", "itb ", "I T B") count as one. */
export const campusKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Campuses ranked by the total XP of their students at the fair, from the campus each player put in
 * their profile. Only names and sums leave the server: nobody's account or progress.
 */
export async function campusBoard(db: Db, limit = 20): Promise<CampusRow[]> {
  const campus = sql<string>`trim(${fairPlayers.data} -> 'profile' ->> 'campus')`;
  const key = sql<string>`regexp_replace(lower(${campus}), '[^a-z0-9]+', '', 'g')`;
  const xp = sql<number>`coalesce(sum(least(greatest((${fairPlayers.data} -> 'player' ->> 'xp')::numeric, 0), 1000000)), 0)::int`;
  const rows = await db
    .select({ key, campus: sql<string>`mode() within group (order by ${campus})`, members: sql<number>`count(*)::int`, xp })
    .from(fairPlayers)
    .where(sql`length(${key}) between 2 and 60 and jsonb_typeof(${fairPlayers.data} -> 'player' -> 'xp') = 'number'`)
    .groupBy(key)
    .orderBy(sql`${xp} desc`, sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({ campus: r.campus.slice(0, 60), members: r.members, xp: r.xp }));
}
