// A company's talent pool, read from the tables that already exist: its booths' applications and
// the seekers' saved profiles (fair_players.data.profile). Offers to apply are kept per seeker as
// one fair_state document, "offers:<user id>", which the event setup never reads.
import { desc, eq, inArray, sql } from "drizzle-orm";
import { OFFER_LIMIT, type PoolApplication, type PoolProfile, type TalentOffer } from "@vwo/shared";
import type { Db } from "./client";
import { fairApplications, fairPlayers, fairState } from "./jobfair-schema";

/** Most applications one pool reads; a company with more sees its newest. */
export const POOL_APPLICATION_LIMIT = 3000;

/** Every application to these booths, newest first, without photos and cover letters (the pool doesn't show them). */
export async function poolApplications(db: Db, boothKeys: string[]): Promise<PoolApplication[]> {
  if (!boothKeys.length) return [];
  const rows = await db
    .select({
      id: fairApplications.id,
      seeker: fairApplications.userId,
      boothId: fairApplications.boothKey,
      jobId: fairApplications.jobKey,
      status: fairApplications.status,
      data: sql<Record<string, unknown>>`${fairApplications.data} - 'photo' - 'message'`,
      createdAt: fairApplications.createdAt,
    })
    .from(fairApplications)
    .where(inArray(fairApplications.boothKey, boothKeys))
    .orderBy(desc(fairApplications.createdAt))
    .limit(POOL_APPLICATION_LIMIT);
  return rows.map((r) => ({ ...r, jobTitle: typeof r.data.jobTitle === "string" ? r.data.jobTitle : "", at: r.createdAt.getTime() }));
}

/** The saved profiles of these seekers (no photos), by account id. */
export async function seekerProfiles(db: Db, userIds: string[]): Promise<Map<string, PoolProfile>> {
  const out = new Map<string, PoolProfile>();
  for (let i = 0; i < userIds.length; i += 500) {
    const ids = userIds.slice(i, i + 500);
    const rows = await db
      .select({ userId: fairPlayers.userId, profile: sql<PoolProfile>`(${fairPlayers.data} -> 'profile') - 'photo'` })
      .from(fairPlayers)
      .where(inArray(fairPlayers.userId, ids));
    for (const r of rows) if (r.profile && typeof r.profile === "object") out.set(r.userId, r.profile);
  }
  return out;
}

/** Seekers who switched on "Boleh dihubungi perusahaan untuk lowongan lain", most recently active first. */
export async function openSeekers(db: Db, limit = 1000) {
  const rows = await db
    .select({ userId: fairPlayers.userId, profile: sql<PoolProfile>`(${fairPlayers.data} -> 'profile') - 'photo'`, updatedAt: fairPlayers.updatedAt })
    .from(fairPlayers)
    .where(sql`${fairPlayers.data} -> 'profile' ->> 'contactable' = 'true'`)
    .orderBy(desc(fairPlayers.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ userId: r.userId, profile: r.profile, at: r.updatedAt.getTime() }));
}

const offersKey = (userId: string) => `offers:${userId}`;

/** The offers a seeker has, newest first. */
export async function seekerOffers(db: Db, userId: string): Promise<TalentOffer[]> {
  const [row] = await db
    .select({ data: fairState.data })
    .from(fairState)
    .where(eq(fairState.key, offersKey(userId)));
  const list = (row?.data as { offers?: TalentOffer[] } | undefined)?.offers;
  return Array.isArray(list) ? list : [];
}

export class AlreadyOfferedError extends Error {
  constructor() {
    super("already offered");
  }
}

/** Give a seeker an offer; one per vacancy. Two companies offering at once both land. */
export async function addSeekerOffer(db: Db, userId: string, offer: TalentOffer, by: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${offersKey(userId)}))`);
    const [row] = await tx
      .select({ data: fairState.data })
      .from(fairState)
      .where(eq(fairState.key, offersKey(userId)));
    const have = ((row?.data as { offers?: TalentOffer[] } | undefined)?.offers ?? []).filter(Boolean);
    if (have.some((o) => o.boothId === offer.boothId && o.jobId === offer.jobId)) throw new AlreadyOfferedError();
    const offers = [offer, ...have].slice(0, OFFER_LIMIT);
    await tx
      .insert(fairState)
      .values({ key: offersKey(userId), data: { offers }, updatedBy: by })
      .onConflictDoUpdate({ target: fairState.key, set: { data: { offers }, updatedBy: by, updatedAt: sql`now()` } });
    return offers;
  });
}

/** The seeker dismisses an offer (or applied to it). Returns false when they had no such offer. */
export async function dropSeekerOffer(db: Db, userId: string, offerId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${offersKey(userId)}))`);
    const [row] = await tx
      .select({ data: fairState.data })
      .from(fairState)
      .where(eq(fairState.key, offersKey(userId)));
    const have = (row?.data as { offers?: TalentOffer[] } | undefined)?.offers ?? [];
    const offers = have.filter((o) => o.id !== offerId);
    if (offers.length === have.length) return false;
    await tx
      .update(fairState)
      .set({ data: { offers }, updatedBy: userId, updatedAt: sql`now()` })
      .where(eq(fairState.key, offersKey(userId)));
    return true;
  });
}
