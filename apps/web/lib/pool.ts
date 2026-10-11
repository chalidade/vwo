import "server-only";
import { boothsOf, poolApplications, seekerProfiles } from "@vwo/db";
import { type PoolMember, poolMembers } from "@vwo/shared";
import { createHash } from "node:crypto";
import { db } from "./db";

/**
 * The booths whose applicants make up this booth's talent pool: the booth itself, and the other
 * booths the same account runs (a company back for its next event keeps the people from the last).
 * The caller has already checked the account may manage `booth`.
 */
export async function poolBooths(userId: string, booth: string) {
  const mine = await boothsOf(db, userId);
  return mine.includes(booth) ? mine : [booth];
}

/** Everyone who applied to these booths, with their saved profile's fresher skills and city. */
export async function loadPool(booths: string[]): Promise<PoolMember[]> {
  const apps = await poolApplications(db, booths);
  const profiles = await seekerProfiles(db, [...new Set(apps.map((a) => a.seeker))]);
  return poolMembers(apps, profiles);
}

/**
 * What a booth knows an opted-in stranger by: not their account id (that would let the company ring
 * or look them up elsewhere), only a handle tied to this booth, good for sending them an offer.
 */
export const seekerHandle = (booth: string, userId: string) => `h_${createHash("sha256").update(`talent:${booth}:${userId}`).digest("hex").slice(0, 32)}`;
