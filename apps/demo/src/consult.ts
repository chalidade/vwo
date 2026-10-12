// Lounge consultants from the browser: a consultant's own desk and application, the organiser's
// list, and who sits at the desks in the game. The live site asks the server (/api/jobfair/consultants);
// the offline demo keeps the same documents in this browser, so a consultant tab, an organiser tab and
// a job fair tab of one browser work together (calls between them go through call.ts as usual).
import {
  BOT_CONSULTANTS,
  type ConsultantDoc,
  type ConsultantProfile,
  type ConsultChange,
  type ConsultRequest,
  type ConsultSnapshot,
  consultOps,
  consultSnapshot,
  freeConsultDesks,
  isOpenNow,
  newConsultantId,
  price,
  publicConsultant,
} from "@vwo/shared";
import { currentAccount } from "./account";
import { LIVE } from "./mode";
import { claimPaidCoins, pay } from "./payments";
import { pullShared, refreshShared } from "./shared-state";
import { fair } from "./useFair";

export type MyDesk = ConsultantDoc & { open: boolean };
export interface MyConsult {
  consultant: MyDesk | null;
  request: ConsultRequest | null;
  freeDesks: number[];
  price: number;
}
export interface OrgConsult {
  consultants: MyDesk[];
  requests: ConsultRequest[];
  botsOff: string[];
  bots: { id: string; name: string; role: string; desk: number }[];
  freeDesks: number[];
}
export type Contact = { email: string; phone: string };
type Res<T> = { ok: true; data: T } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  not_signed_in: "Sesi login habis. Masuk lagi di halaman Job Fair.",
  not_allowed: "Halaman ini khusus panitia.",
  has_desk: "Akun ini sudah punya meja konsultan.",
  desk_taken: "Meja ini baru saja terisi. Pilih meja lain.",
  slot_taken: "Meja ini baru saja terisi. Pilih meja lain.",
  not_pending: "Pendaftaran ini sudah diputuskan.",
  not_found: "Data tidak ditemukan. Muat ulang halaman.",
  invalid_input: "Data belum lengkap atau terlalu panjang. Periksa lagi isiannya.",
  too_many_requests: "Terlalu banyak percobaan. Coba lagi nanti.",
  bad_origin: "Permintaan ditolak. Muat ulang halaman lalu coba lagi.",
  full: "Semua meja sudah terisi.",
};
const message = (code: string) => ERRORS[code] ?? "Gagal menyimpan. Coba lagi sebentar lagi.";

async function api<T>(path: string, method = "GET", body?: unknown): Promise<Res<T>> {
  try {
    const r = await fetch(path, {
      method,
      credentials: "same-origin",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: message(d.error ?? "") };
  } catch {
    return { ok: false, error: "Tidak tersambung ke server. Periksa internet lalu coba lagi." };
  }
}

// ---- The offline demo: the documents in this browser.

const KEY = "vwo:consultants";
const EVENT = "vwo:consultants";

function readLocal(): Record<string, unknown> {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const localSnapshot = (): ConsultSnapshot => consultSnapshot(Object.entries(readLocal()).map(([key, data]) => ({ key, data })));

function runLocal<T>(decide: (s: ConsultSnapshot) => ConsultChange<T>): Res<T> {
  const docs = readLocal();
  const out = decide(consultSnapshot(Object.entries(docs).map(([key, data]) => ({ key, data }))));
  if ("error" in out) return { ok: false, error: message(out.error) };
  for (const d of out.put ?? []) docs[d.key] = d.data;
  for (const k of out.del ?? []) delete docs[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(docs));
  } catch {
    // Blocked storage: the change lives until the page closes.
  }
  seatLocal();
  window.dispatchEvent(new Event(EVENT));
  return { ok: true, data: out.result };
}

/** The demo's account stands in for the server's user id. */
const demoUser = () => currentAccount()?.email ?? "";

/** Demo: seat this browser's consultants in the game. */
function seatLocal() {
  const s = localSnapshot();
  const now = Date.now();
  fair.setConsultants(
    s.placed.map((d) => publicConsultant(d, now)),
    s.botsOff,
  );
}

let syncing = false;
/** Demo: keep the lounge in step with this browser's consultants (other tabs change them too). */
export function startConsultSync() {
  if (LIVE || syncing) return;
  syncing = true;
  seatLocal();
  window.addEventListener("storage", (e) => e.key === KEY && (seatLocal(), window.dispatchEvent(new Event(EVENT))));
  // An open desk closes by itself when its page stops saying it is there.
  setInterval(seatLocal, 30_000);
}

/** Run `fn` when the consultants change in this browser (demo); returns the unsubscribe. */
export function onConsultChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

// ---- A consultant's own desk.

export async function loadMine(): Promise<Res<MyConsult>> {
  if (LIVE) return api<MyConsult>("/api/jobfair/consultants/me");
  const s = localSnapshot();
  const me = demoUser();
  const mine = s.placed.find((p) => p.by === me);
  return {
    ok: true,
    data: {
      consultant: mine ? { ...mine, open: isOpenNow(mine, Date.now()) } : null,
      request: s.requests.find((r) => r.userId === me) ?? null,
      freeDesks: freeConsultDesks(BOT_CONSULTANTS, s.botsOff, s.placed),
      price: price("consult.slot"),
    },
  };
}

export async function applyToOrganizer(profile: ConsultantProfile, contact: Contact): Promise<Res<unknown>> {
  if (LIVE) return api("/api/jobfair/consultants/me", "POST", { profile, contact });
  return runLocal((s) => consultOps.apply(s, { userId: demoUser(), ...contact, profile }, Date.now()));
}

/** Buy a desk with coins: placed at once (the server charges its own price). */
export async function buySlot(desk: number, profile: ConsultantProfile, contact: Contact): Promise<Res<unknown>> {
  if (LIVE) {
    const r = await pay({ kind: "consultant", desk, profile, contact });
    if (!r.ok) return r;
    if ("redirect" in r) return { ok: true, data: null };
    await claimPaidCoins();
    refreshShared();
    return { ok: true, data: r.payment };
  }
  const cost = price("consult.slot");
  if (fair.player.coins < cost) return { ok: false, error: `Koin belum cukup: perlu ${cost.toLocaleString("id-ID")} koin.` };
  const r = runLocal((s) => consultOps.placePaid(s, { id: `demo-${Date.now()}`, userId: demoUser(), meta: { desk, profile, ...contact } }, newConsultantId(), Date.now()));
  if (r.ok) fair.payCoins(cost, `Slot meja konsultan · ${profile.name}`);
  return r;
}

export async function saveProfile(profile: ConsultantProfile): Promise<Res<unknown>> {
  if (LIVE) {
    const r = await api("/api/jobfair/consultants/me", "PUT", { profile });
    if (r.ok) pullShared();
    return r;
  }
  return runLocal((s) => consultOps.profile(s, demoUser(), profile));
}

/** Open or close the desk; while open the page repeats this so the lamp stays green. */
export async function setOpen(open: boolean): Promise<Res<unknown>> {
  if (LIVE) return api("/api/jobfair/consultants/me", "PATCH", { open });
  return runLocal((s) => consultOps.open(s, demoUser(), open, Date.now()));
}

// ---- The organiser.

export async function loadOrg(): Promise<Res<OrgConsult>> {
  if (LIVE) return api<OrgConsult>("/api/jobfair/consultants");
  const s = localSnapshot();
  const now = Date.now();
  return {
    ok: true,
    data: {
      consultants: s.placed.map((d) => ({ ...d, open: isOpenNow(d, now) })).sort((a, b) => a.desk - b.desk),
      requests: [...s.requests].sort((a, b) => b.at - a.at),
      botsOff: s.botsOff,
      bots: BOT_CONSULTANTS.map((b, desk) => ({ id: b.id, name: b.name, role: b.role, desk })),
      freeDesks: freeConsultDesks(BOT_CONSULTANTS, s.botsOff, s.placed),
    },
  };
}

type OrgAction =
  | { action: "approve"; user: string; desk: number }
  | { action: "reject"; user: string; note: string }
  | { action: "remove"; id: string }
  | { action: "bots"; off: string[] };

export async function orgAction(a: OrgAction): Promise<Res<unknown>> {
  if (LIVE) {
    const r = await api("/api/jobfair/consultants", "POST", a);
    if (r.ok) pullShared();
    return r;
  }
  const now = Date.now();
  if (a.action === "approve") return runLocal((s) => consultOps.approve(s, a.user, a.desk, newConsultantId(), now));
  if (a.action === "reject") return runLocal((s) => consultOps.reject(s, a.user, a.note, now));
  if (a.action === "remove") return runLocal((s) => consultOps.remove(s, a.id, now));
  return runLocal((s) => consultOps.botsOff(s, a.off));
}
