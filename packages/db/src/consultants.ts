// Lounge consultants on the server: the decisions live in @vwo/shared (consultOps); here they run
// under one lock, so two approvals, or a paid slot and an approval, never seat two people at one
// desk, and one account never holds two desks.
import {
  BOT_CONSULTANTS,
  CONSULT_CFG_KEY,
  CONSULT_REQ_PREFIX,
  CONSULTANT_PREFIX,
  type ConsultantDoc,
  type ConsultantProfile,
  type ConsultChange,
  type ConsultSnapshot,
  consultOps,
  consultSnapshot,
  newConsultantId,
} from "@vwo/shared";
import { eq, inArray, like, or, sql } from "drizzle-orm";
import type { Db } from "./client";
import { fairState } from "./jobfair-schema";

const consultRows = (db: Pick<Db, "select">) =>
  db
    .select({ key: fairState.key, data: fairState.data })
    .from(fairState)
    .where(or(like(fairState.key, `${CONSULTANT_PREFIX}%`), like(fairState.key, `${CONSULT_REQ_PREFIX}%`), eq(fairState.key, CONSULT_CFG_KEY)));

/** Desks, applications and the bot switch as stored now (no lock: for reading only). */
export async function readConsultants(db: Db): Promise<ConsultSnapshot> {
  return consultSnapshot(await consultRows(db));
}

/** Read everything, decide, and write what the decision says, all under the consultants' lock. */
async function consultChange<T>(db: Db, userId: string, decide: (s: ConsultSnapshot) => ConsultChange<T>): Promise<{ result: T } | { error: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:consultants"}))`);
    const out = decide(consultSnapshot(await consultRows(tx)));
    if ("error" in out) return { error: out.error };
    for (const doc of out.put ?? [])
      await tx
        .insert(fairState)
        .values({ key: doc.key, data: doc.data, updatedBy: userId })
        .onConflictDoUpdate({ target: fairState.key, set: { data: doc.data, updatedBy: userId, updatedAt: sql`now()` } });
    if (out.del?.length) await tx.delete(fairState).where(inArray(fairState.key, out.del));
    return { result: out.result };
  });
}

export const applyConsultant = (db: Db, input: { userId: string; email: string; phone: string; profile: ConsultantProfile }, now = Date.now()) =>
  consultChange(db, input.userId, (s) => consultOps.apply(s, input, now));

export const approveConsultant = (db: Db, adminId: string, userId: string, desk: number, now = Date.now(), bots = BOT_CONSULTANTS) =>
  consultChange(db, adminId, (s) => consultOps.approve(s, userId, desk, newConsultantId(), now, bots));

export const rejectConsultant = (db: Db, adminId: string, userId: string, note: string, now = Date.now()) =>
  consultChange(db, adminId, (s) => consultOps.reject(s, userId, note, now));

export const removeConsultant = (db: Db, adminId: string, id: string, now = Date.now()) => consultChange(db, adminId, (s) => consultOps.remove(s, id, now));

export const updateConsultantProfile = (db: Db, userId: string, profile: ConsultantProfile) => consultChange(db, userId, (s) => consultOps.profile(s, userId, profile));

export const setConsultantOpen = (db: Db, userId: string, open: boolean, now = Date.now()) => consultChange(db, userId, (s) => consultOps.open(s, userId, open, now));

export const setBotsOff = (db: Db, adminId: string, off: string[], bots = BOT_CONSULTANTS) => consultChange(db, adminId, (s) => consultOps.botsOff(s, off, bots));

/** A paid slot: seat the buyer (see consultOps.placePaid). Null when it can't be done; the coins then go back. */
export async function placePaidConsultant(db: Db, p: { id: string; userId: string; meta: unknown }, now = Date.now(), bots = BOT_CONSULTANTS): Promise<ConsultantDoc | null> {
  const out = await consultChange(db, p.userId, (s) => consultOps.placePaid(s, p, newConsultantId(), now, bots));
  if ("error" in out) {
    console.warn("paid consultant slot not placed", p.id, out.error);
    return null;
  }
  return out.result;
}
