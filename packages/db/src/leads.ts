// Booth and food court stall requests on the server: one private `lead:<id>` document each (see
// @vwo/shared leads.ts). The public setup read leaves them out (fair-state.ts); filing one and
// marking one done run under a lock, so an account can't slip past its open limit and two organisers
// can't both open a booth for the same request.
import { LEAD_PREFIX, type Lead, type LeadChange, type LeadPatch, leadOps, sortLeads } from "@vwo/shared";
import { eq, like, sql } from "drizzle-orm";
import type { Db } from "./client";
import { companyRegistrations, fairState } from "./jobfair-schema";

type Tx = Pick<Db, "select" | "insert" | "execute">;

const leadKey = (id: string) => `${LEAD_PREFIX}${id}`;
const leadRows = async (db: Pick<Db, "select">) =>
  (
    await db
      .select({ data: fairState.data })
      .from(fairState)
      .where(like(fairState.key, `${LEAD_PREFIX}%`))
  ).map((r) => r.data as Lead);

async function put(tx: Tx, lead: Lead, userId: string | null) {
  await tx
    .insert(fairState)
    .values({ key: leadKey(lead.id), data: lead, updatedBy: userId })
    .onConflictDoUpdate({ target: fairState.key, set: { data: lead, updatedBy: userId, updatedAt: sql`now()` } });
}

/** File a request (see leadOps.create). The account's open requests are counted under the lock. */
export async function createLead(db: Db, lead: Lead, max?: number): Promise<LeadChange<Lead>> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:leads"}))`);
    const out = leadOps.create(await leadRows(tx), lead, max);
    if ("result" in out) await put(tx, out.result, lead.userId);
    return out;
  });
}

/** Every request, what still needs a call first. For the organiser. */
export async function listLeads(db: Db) {
  return sortLeads(await leadRows(db));
}

/** This account's own requests, newest first. */
export async function leadsOf(db: Db, userId: string) {
  return (await leadRows(db)).filter((l) => l.userId === userId).sort((a, b) => b.at - a.at);
}

export async function leadById(db: Db, id: string) {
  const [row] = await db
    .select({ data: fairState.data })
    .from(fairState)
    .where(eq(fairState.key, leadKey(id)));
  return row ? (row.data as Lead) : null;
}

/** Change one request under its own lock. */
async function changeLead(db: Db, id: string, adminId: string, decide: (lead: Lead) => LeadChange<Lead>): Promise<LeadChange<Lead>> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fair:" + leadKey(id)}))`);
    const [row] = await tx
      .select({ data: fairState.data })
      .from(fairState)
      .where(eq(fairState.key, leadKey(id)));
    if (!row) return { error: "not_found" };
    const out = decide(row.data as Lead);
    if ("result" in out) await put(tx, out.result, adminId);
    return out;
  });
}

/** The organiser sets the status (Baru, Dihubungi, Selesai, Ditolak) or writes notes. */
export const editLead = (db: Db, id: string, adminId: string, patch: LeadPatch, now = Date.now()) => changeLead(db, id, adminId, (l) => leadOps.edit(l, patch, now));

/** The booth or stall is open: mark the request done. Fails when someone else finished it first. */
export const finishLead = (db: Db, id: string, adminId: string, result: { boothId?: string; pin?: string; stallId?: string }, now = Date.now()) =>
  changeLead(db, id, adminId, (l) => leadOps.finish(l, { ...result, by: adminId }, now));

/**
 * A booth opened from a request is also kept as a verified registration of the requesting account
 * (no price, paid by nobody): the registration page shows its code and PIN, and the account may
 * enter the app before launch like any verified company.
 */
export async function recordLeadRegistration(db: Db, lead: Lead, by: string, boothKey: string, pin: string, tier: string, color: string) {
  if (!lead.userId) return;
  await db.insert(companyRegistrations).values({
    userId: lead.userId,
    company: lead.name,
    industry: lead.industry ?? "Umum",
    color,
    website: lead.website || null,
    city: lead.city ?? "-",
    contactName: lead.contactName,
    contactRole: lead.contactRole ?? "-",
    email: lead.email,
    phone: lead.phone,
    tier,
    price: 0,
    method: "Formulir",
    status: "verified",
    verifiedAt: new Date(),
    verifiedBy: by,
    boothKey,
    pin,
  });
}
