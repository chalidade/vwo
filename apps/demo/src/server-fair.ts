// The live app's applications on the server: what the seeker sent, and what each booth received.
// The GitHub Pages demo never calls these; everything there stays in the browser.
import type { ApplicationShared, CompanyBooth, FairApplicationInput, FairApplicationOut } from "@vwo/shared";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(path: string, init?: { method: string; body: unknown }): Promise<Result<T>> {
  try {
    const res = await fetch(`/api/jobfair/${path}`, {
      method: init?.method ?? "GET",
      credentials: "same-origin",
      headers: init ? { "Content-Type": "application/json" } : undefined,
      body: init ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? `http_${res.status}` };
  } catch {
    return { ok: false, error: "offline" };
  }
}

export const sendApplication = (input: FairApplicationInput) =>
  call<{ application: FairApplicationOut }>("applications", { method: "POST", body: input });

export const myApplications = () => call<{ applications: FairApplicationOut[] }>("applications");

export const boothApplications = (boothId: string) => call<{ applications: FairApplicationOut[] }>(`booths/${encodeURIComponent(boothId)}/applications`);

export const setApplicationStatus = (boothId: string, id: string, status: FairApplicationOut["status"]) =>
  call<{ ok: true }>(`booths/${encodeURIComponent(boothId)}/applications`, { method: "PATCH", body: { id, status } });

/** What to tell the seeker when sending failed. */
export function applyErrorText(error: string) {
  switch (error) {
    case "already_applied":
      return "Kamu sudah melamar lowongan ini.";
    case "not_signed_in":
      return "Sesi login habis. Masuk lagi lalu kirim ulang lamaranmu.";
    case "too_many_requests":
    case "too_many_applications":
      return "Terlalu banyak lamaran dalam waktu singkat. Coba lagi nanti.";
    case "invalid_input":
      return "Periksa lagi isian lamaran: email dan link CV harus benar.";
    case "email_not_verified":
      return "Verifikasi email kamu dulu sebelum melamar. Cek kotak masuk emailmu.";
    case "offline":
      return "Tidak tersambung ke server. Periksa internet lalu coba lagi.";
    default:
      return "Lamaran gagal terkirim. Coba lagi sebentar lagi.";
  }
}

/** One side's part of an application's conversation: chat, interview, rating and call log. */
export const sendShared = (id: string, as: "company" | "seeker", shared: ApplicationShared) =>
  call<{ ok: true }>(`applications/${encodeURIComponent(id)}/shared`, { method: "PUT", body: { as, shared } });

/** A company account joins its booth with the code and PIN from the organiser. */
export const claimBooth = (boothId: string, pin: string) => call<{ ok: true; boothId: string }>("company/claim", { method: "POST", body: { boothId, pin } });

/** Event admins: the accounts that run a booth, and taking one out. */
export const boothMembers = (boothId: string) => call<{ members: { id: string; email: string; name: string | null; since: number }[] }>(`booths/${encodeURIComponent(boothId)}/members`);
export const removeBoothMember = (boothId: string, userId: string) =>
  call<{ ok: true }>(`booths/${encodeURIComponent(boothId)}/members?user=${encodeURIComponent(userId)}`, { method: "DELETE", body: {} });

/** What to tell a company when joining its booth failed. */
export function claimErrorText(error: string) {
  switch (error) {
    case "no_pin":
      return "Panitia belum membuat PIN untuk stand ini. Minta PIN ke panitia.";
    case "wrong_pin":
      return "Kode perusahaan atau PIN salah. Tanyakan ke panitia kalau lupa.";
    case "too_many_requests":
      return "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.";
    case "not_signed_in":
      return "Sesi login habis. Masuk lagi dengan Google.";
    case "invalid_input":
      return "Periksa lagi kode perusahaan dan PIN.";
    case "offline":
      return "Tidak tersambung ke server. Periksa internet lalu coba lagi.";
    default:
      return "Gagal masuk ke stand. Coba lagi sebentar lagi.";
  }
}
