// Booth and food court stall requests from the game's forms, and the organiser's follow-up. Live: the
// server's /api/jobfair/leads routes. Demo: this browser's copy, with the same checks and decisions
// (@vwo/shared leads.ts), so the forms and the organiser's list work offline too.
import { type BoothTier, boothLeadInput, type BoothLeadInput, type Lead, type LeadPatch, leadOps, newLead, sortLeads, stallLeadInput, type StallLeadInput } from "@vwo/shared";
import { LIVE } from "./mode";
import { refreshShared } from "./shared-state";
import { fair } from "./useFair";

export type LeadResult<T> = { ok: true; data: T } | { ok: false; error: string };

const KEY = "vwo:leads";

/** What a refusal means, in the requester's or the organiser's words. */
export const LEAD_ERRORS: Record<string, string> = {
  invalid_input: "Periksa lagi isian: nama minimal 2 huruf, email dan nomor HP/WhatsApp harus benar.",
  too_many_open: "Masih ada permintaanmu yang menunggu panitia. Tunggu dihubungi dulu, ya.",
  too_many_requests: "Terlalu banyak formulir dari akun ini hari ini. Coba lagi besok.",
  not_signed_in: "Masuk dulu ke job fair, lalu isi formulir lagi.",
  bad_origin: "Permintaan ditolak. Muat ulang halaman lalu coba lagi.",
  verify_failed: "Formulir gagal diverifikasi, coba lagi.",
  email_rejected: "Email ini tidak bisa dipakai. Gunakan email kantor yang aktif.",
  not_open: "Permintaan ini sudah selesai atau ditolak.",
  fulfilled: "Stand atau stan sudah dibuat untuk permintaan ini; statusnya tetap Selesai.",
  slot_taken: "Tempat ini baru saja terisi. Pilih tempat lain.",
  invalid_slot: "Tempat ini tidak bisa dipakai. Pilih tempat lain.",
  exists: "Stan untuk permintaan ini sudah ada.",
  not_found: "Permintaan ini sudah tidak ada. Muat ulang.",
  not_allowed: "Hanya panitia yang bisa melihat ini.",
  offline: "Tidak tersambung ke server. Periksa internet lalu coba lagi.",
};
export const leadError = (code: string) => LEAD_ERRORS[code] ?? "Gagal. Coba lagi sebentar lagi.";

async function call<T>(path: string, method: string, body?: unknown): Promise<LeadResult<T>> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: d.error ?? `http_${r.status}` };
  } catch {
    return { ok: false, error: "offline" };
  }
}

function readLocal(): Lead[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as Lead[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Lead[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    // Storage full or blocked: the request lives only until reload.
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;

/** Send a booth or stall request. Nothing is paid; the organiser calls back. */
export async function sendLead(input: { kind: "booth"; data: BoothLeadInput } | { kind: "stall"; data: StallLeadInput }): Promise<LeadResult<{ id: string }>> {
  if (LIVE) {
    const r = await call<{ lead: { id: string } }>("/api/jobfair/leads", "POST", input);
    return r.ok ? { ok: true, data: { id: r.data.lead.id } } : r;
  }
  const parsed = input.kind === "booth" ? boothLeadInput.safeParse(input.data) : stallLeadInput.safeParse(input.data);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const lead = newLead(newId(), null, { kind: input.kind, data: parsed.data } as Parameters<typeof newLead>[2], Date.now());
  const list = readLocal();
  const out = leadOps.create(list, lead);
  if ("error" in out) return { ok: false, error: out.error };
  writeLocal([out.result, ...list]);
  return { ok: true, data: { id: lead.id } };
}

/** Every request, for the organiser. */
export async function loadLeads(): Promise<LeadResult<Lead[]>> {
  if (LIVE) {
    const r = await call<{ leads: Lead[] }>("/api/jobfair/leads", "GET");
    return r.ok ? { ok: true, data: r.data.leads } : r;
  }
  return { ok: true, data: sortLeads(readLocal()) };
}

function changeLocal(id: string, decide: (l: Lead) => { result: Lead } | { error: string }): LeadResult<Lead> {
  const list = readLocal();
  const lead = list.find((l) => l.id === id);
  if (!lead) return { ok: false, error: "not_found" };
  const out = decide(lead);
  if ("error" in out) return { ok: false, error: out.error };
  writeLocal(list.map((l) => (l.id === id ? out.result : l)));
  return { ok: true, data: out.result };
}

/** The organiser sets the status or writes notes. */
export async function editLead(id: string, patch: LeadPatch): Promise<LeadResult<Lead>> {
  if (LIVE) {
    const r = await call<{ lead: Lead }>(`/api/jobfair/leads/${id}`, "PATCH", patch);
    return r.ok ? { ok: true, data: r.data.lead } : r;
  }
  return changeLocal(id, (l) => leadOps.edit(l, patch, Date.now()));
}

/** Open the requested booth on a slot with a package; the contact gets the code and PIN (live: by email). */
export async function fulfilBooth(
  lead: Lead,
  pick: { floor: number; x: number; y: number; tier: BoothTier; color: string },
): Promise<LeadResult<{ boothId: string; pin: string }>> {
  if (LIVE) {
    const r = await call<{ boothId: string; pin: string }>(`/api/jobfair/leads/${lead.id}/fulfil`, "POST", pick);
    if (r.ok) refreshShared();
    return r;
  }
  if (lead.result) return { ok: false, error: "not_open" };
  const made = fair.bookStand({
    company: lead.name,
    industry: lead.industry ?? "",
    color: pick.color,
    contact: lead.contactName,
    email: lead.email,
    tier: pick.tier,
    method: "Formulir",
    price: 0,
    floor: pick.floor,
    x: pick.x,
    y: pick.y,
  });
  if (!made) return { ok: false, error: "slot_taken" };
  const done = changeLocal(lead.id, (l) => leadOps.finish(l, { boothId: made.booth.id, pin: made.pin, by: "demo" }, Date.now()));
  return done.ok ? { ok: true, data: { boothId: made.booth.id, pin: made.pin } } : done;
}

/** Open the requested food court stall in a free slot. */
export async function fulfilStall(lead: Lead, slot: number): Promise<LeadResult<{ stallId: string }>> {
  if (LIVE) {
    const r = await call<{ stallId: string }>(`/api/jobfair/leads/${lead.id}/fulfil`, "POST", { slot });
    if (r.ok) refreshShared();
    return r;
  }
  if (lead.result) return { ok: false, error: "not_open" };
  const st = fair.addStall(slot, { name: lead.name, vendor: lead.contactName.slice(0, 30), promo: (lead.sells ?? "").slice(0, 80) });
  if (!st) return { ok: false, error: "slot_taken" };
  const done = changeLocal(lead.id, (l) => leadOps.finish(l, { stallId: st.id, by: "demo" }, Date.now()));
  return done.ok ? { ok: true, data: { stallId: st.id } } : done;
}
