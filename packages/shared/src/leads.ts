// Booth and food court stall requests ("leads"). A company or a food business fills in a short form,
// with no prices and no payment; the organiser calls them back and, once agreed, opens the booth or
// the stall from the organiser hub. Each request is one private document (`lead:<id>` on the server,
// never in the public event setup); the decisions below run under a lock on the server
// (packages/db leads.ts) and on this browser's copy in the offline demo.
import type { BoothLeadData, LeadPatch, StallLeadData } from "./leads-schema";

/** One private document per request: contact details are for the organiser only. */
export const LEAD_PREFIX = "lead:";

export type LeadKind = "booth" | "stall";
export type LeadStatus = "new" | "contacted" | "done" | "rejected";
export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "done", "rejected"];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = { new: "Baru", contacted: "Dihubungi", done: "Selesai", rejected: "Ditolak" };

/** How many requests one account may have waiting per kind (new or contacted). */
export const LEAD_MAX_OPEN = 3;

/** "perusahaan.co.id" is fine too: a site without a scheme gets https://. Only http(s) addresses pass. */
export function cleanWebsite(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A request as stored. `name` is the company or the food business. */
export interface Lead {
  id: string;
  kind: LeadKind;
  status: LeadStatus;
  /** The signed-in account that asked; the booth or stall goes to it. Null in the offline demo. */
  userId: string | null;
  at: number;
  updatedAt: number;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  /** Booth: */
  industry?: string;
  city?: string;
  website?: string;
  contactRole?: string;
  want?: { floor: number; x: number; y: number } | null;
  /** Stall: */
  sells?: string;
  wantSlot?: number | null;
  /** What the company or business wrote. */
  note?: string;
  /** The organiser's own notes from the calls. Never shown to the requester. */
  orgNote?: string;
  /** What the organiser opened for it. */
  result?: { boothId?: string; pin?: string; stallId?: string; at: number; by: string };
}

/** Turn a checked form into the stored request. */
export function newLead(id: string, userId: string | null, input: { kind: "booth"; data: BoothLeadData } | { kind: "stall"; data: StallLeadData }, now: number): Lead {
  const base = { id, status: "new" as const, userId, at: now, updatedAt: now, ...(input.data.note ? { note: input.data.note } : {}) };
  if (input.kind === "booth") {
    const d = input.data;
    return {
      ...base,
      kind: "booth",
      name: d.company,
      industry: d.industry,
      city: d.city,
      website: d.website,
      contactName: d.contactName,
      contactRole: d.contactRole,
      email: d.email,
      phone: d.phone,
      want: d.want ?? null,
    };
  }
  const d = input.data;
  return { ...base, kind: "stall", name: d.business, sells: d.sells, contactName: d.contactName, email: d.email, phone: d.phone, wantSlot: d.slot ?? null };
}

export const leadOpen = (l: Lead) => l.status === "new" || l.status === "contacted";

export type LeadChange<T> = { result: T } | { error: string };

export const leadOps = {
  /** File a request; one account can't have more than LEAD_MAX_OPEN of one kind waiting. */
  create(all: readonly Lead[], lead: Lead, max = LEAD_MAX_OPEN): LeadChange<Lead> {
    if (all.some((l) => l.id === lead.id)) return { error: "exists" };
    if (lead.userId && all.filter((l) => l.userId === lead.userId && l.kind === lead.kind && leadOpen(l)).length >= max) return { error: "too_many_open" };
    return { result: lead };
  },

  /** The organiser changes the status or the notes. Once a booth or stall was opened for it, the status stays Selesai. */
  edit(lead: Lead, patch: LeadPatch, now: number): LeadChange<Lead> {
    if (patch.status && patch.status !== lead.status && lead.result) return { error: "fulfilled" };
    return { result: { ...lead, ...(patch.status ? { status: patch.status } : {}), ...(patch.orgNote !== undefined ? { orgNote: patch.orgNote } : {}), updatedAt: now } };
  },

  /** The booth or stall is open: the request is done. Only once, and only while it is still open. */
  finish(lead: Lead, result: Omit<NonNullable<Lead["result"]>, "at">, now: number): LeadChange<Lead> {
    if (lead.result || !leadOpen(lead)) return { error: "not_open" };
    return { result: { ...lead, status: "done", result: { ...result, at: now }, updatedAt: now } };
  },
};

/** Newest first, with what still needs a call on top. */
export const sortLeads = (list: readonly Lead[]) => [...list].sort((a, b) => Number(leadOpen(b)) - Number(leadOpen(a)) || b.at - a.at);

/** A WhatsApp chat link for an Indonesian number ("0812…" or "+62 812…"); null when it isn't one. */
export function waLink(phone: string) {
  let d = phone.replace(/[^0-9]/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return /^[1-9][0-9]{8,14}$/.test(d) ? `https://wa.me/${d}` : null;
}

/** A tel: link that keeps only the digits and a leading +. */
export const telLink = (phone: string) => `tel:${phone.trim().replace(/(?!^\+)[^0-9]/g, "")}`;
