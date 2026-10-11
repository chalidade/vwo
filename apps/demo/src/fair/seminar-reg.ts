// Seminar registration ("Daftar" / "Batal"). The live site keeps who registered on the server, which
// checks the seats and the time; the GitHub Pages demo keeps it in this browser with the same rules.
import { LIVE } from "../mode";
import { fair } from "../useFair";

let pulled = 0;

/** Take the server's counts and this account's registrations (at most every 20 seconds unless forced). */
export async function pullSeminarRegs(force = false) {
  if (!LIVE || (!force && Date.now() - pulled < 20_000)) return;
  pulled = Date.now();
  try {
    const r = await fetch("/api/jobfair/seminars", { credentials: "same-origin" });
    if (!r.ok) return;
    const d = (await r.json()) as { counts?: Record<string, number>; mine?: string[] };
    fair.setSeminarRegs(Array.isArray(d.mine) ? d.mine : [], d.counts ?? {});
  } catch {
    // Offline: the list shows what it knew.
  }
}

const ERRORS: Record<string, string> = {
  full: "Kursi sesi ini sudah penuh.",
  ended: "Sesi ini sudah selesai.",
  unscheduled: "Jadwal sesi ini belum ditentukan panitia.",
  not_found: "Sesi ini sudah tidak ada di jadwal.",
  not_signed_in: "Masuk dulu untuk mendaftar seminar.",
  too_many_requests: "Terlalu sering. Coba lagi sebentar lagi.",
  offline: "Tidak tersambung ke server. Periksa internet lalu coba lagi.",
};

/** Register for a session or cancel. Resolves to the message to show. */
export async function setSeminarReg(id: string, register: boolean): Promise<{ ok: boolean; text: string }> {
  const title = fair.seminars().find((s) => s.id === id)?.title ?? "sesi";
  const done = (registered: boolean) => ({
    ok: true,
    text: registered ? `✅ Terdaftar di ${title}. Kami ingatkan H-1 dan 15 menit sebelum mulai.` : `Pendaftaran ${title} dibatalkan.`,
  });
  if (!LIVE) {
    if (fair.seminarRegs().includes(id) === register) return done(register);
    const r = fair.toggleSeminarRegLocal(id);
    return r.ok ? done(r.registered) : { ok: false, text: ERRORS[r.error] ?? "Gagal. Coba lagi." };
  }
  try {
    const res = await fetch("/api/jobfair/seminars", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seminarId: id, register }),
    });
    const d = (await res.json().catch(() => ({}))) as { registered?: boolean; count?: number; error?: string };
    if (typeof d.count === "number") fair.seminarRegChanged(id, res.ok ? !!d.registered : fair.seminarRegs().includes(id), d.count);
    return res.ok ? done(!!d.registered) : { ok: false, text: ERRORS[d.error ?? ""] ?? "Gagal. Coba lagi." };
  } catch {
    return { ok: false, text: ERRORS.offline! };
  }
}

/** Organiser: who registered for a session, for the export. Live only; the demo has just this player. */
export async function seminarRegistrants(id: string): Promise<{ name: string; email: string; at: number }[] | null> {
  if (!LIVE) return fair.seminarRegs().includes(id) ? [{ name: "Kamu (demo)", email: "-", at: Date.now() }] : [];
  try {
    const r = await fetch(`/api/jobfair/seminars/registrants?id=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!r.ok) return null;
    return ((await r.json()) as { registrants: { name: string; email: string; at: number }[] }).registrants;
  } catch {
    return null;
  }
}

/** Speaker page: tell registered seekers the session is starting (the server sends it once). */
export function announceLive(id: string) {
  if (!LIVE) return;
  void fetch("/api/jobfair/seminars/live", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seminarId: id }),
  }).catch(() => undefined);
}
