// Job seeker accounts. On the live site they live on the server (/api/auth, session cookie);
// in the GitHub Pages demo they are kept in this browser's localStorage, where passwords are
// never stored: only a salted PBKDF2 hash.
import { LIVE } from "./mode";

export interface Account {
  email: string;
  name: string;
  /** Live site: the server's id for this account, which calls are addressed to. */
  id?: string;
  /** Live site: an event admin, who may change the setup and see applicants. */
  fairAdmin?: boolean;
  /** Live site: the company booths this account runs (company accounts). */
  booths?: string[];
  /** Live site: email goes out and this address is not verified yet, so applying waits for it. */
  mustVerify?: boolean;
}

interface StoredAccount extends Account {
  salt: string;
  hash: string;
  createdAt: number;
}

const ACCOUNTS_KEY = "vwo:accounts";
const CURRENT_KEY = "vwo:account";
const ITERATIONS = 120_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD = LIVE ? 8 : 6;

function readAll(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, StoredAccount>) : {};
    return all && typeof all === "object" ? all : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, StoredAccount>) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all));
  } catch {
    // Blocked storage: the account lives only until the page closes.
  }
}

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256);
  return hex(bits);
}

/** Compares two hex strings without stopping at the first difference. */
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const normEmail = (email: string) => email.trim().toLowerCase();

const LIVE_ACCOUNT_KEY = "vwo:live-account";
/** Fired on window when the live account changes (signed in, out, or refreshed from the server). */
export const ACCOUNT_EVENT = "vwo:account";

/** The signed-in account, if any. On the live site this is the last account the server confirmed;
 *  `checkSession` asks the server whether the session cookie is still good. */
export function currentAccount(): Account | null {
  try {
    if (LIVE) {
      const raw = localStorage.getItem(LIVE_ACCOUNT_KEY);
      const a = raw ? (JSON.parse(raw) as Partial<Account>) : null;
      return a && typeof a.email === "string" && typeof a.name === "string" ? { email: a.email, name: a.name, id: typeof a.id === "string" ? a.id : undefined, fairAdmin: a.fairAdmin === true, booths: Array.isArray(a.booths) ? a.booths.filter((b): b is string => typeof b === "string") : [], mustVerify: a.mustVerify === true } : null;
    }
    const email = localStorage.getItem(CURRENT_KEY);
    const a = email ? readAll()[email] : undefined;
    return a ? { email: a.email, name: a.name } : null;
  } catch {
    return null;
  }
}

function rememberLive(a: Account | null) {
  queueMicrotask(() => window.dispatchEvent(new Event(ACCOUNT_EVENT)));
  try {
    if (a) {
      localStorage.setItem(LIVE_ACCOUNT_KEY, JSON.stringify(a));
      localStorage.setItem(CURRENT_KEY, a.email);
    } else {
      localStorage.removeItem(LIVE_ACCOUNT_KEY);
      localStorage.removeItem(CURRENT_KEY);
    }
  } catch {
    // Nothing to remember.
  }
}

const SERVER_ERRORS: Record<string, string> = {
  email_taken: "Email ini sudah terdaftar. Silakan masuk.",
  wrong_email_or_password: "Email atau password salah.",
  too_many_requests: "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
  bad_origin: "Permintaan ditolak. Muat ulang halaman lalu coba lagi.",
  not_human: "Pemeriksaan keamanan gagal. Muat ulang halaman lalu coba lagi.",
};

async function api(path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

function serverError(data: Record<string, unknown>): string {
  const code = typeof data.error === "string" ? data.error : "";
  if (code === "invalid_input") {
    const fields = (data.fields ?? {}) as Record<string, string[] | undefined>;
    if (fields.email) return "Format email belum benar.";
    if (fields.password) return `Password minimal ${MIN_PASSWORD} karakter.`;
    if (fields.name) return "Nama minimal 2 huruf.";
    if (fields.acceptTerms) return "Centang persetujuan syarat dan kebijakan privasi dulu.";
  }
  return SERVER_ERRORS[code] ?? "Server sedang bermasalah. Coba lagi sebentar lagi.";
}

/** Live site: the account behind the session cookie, or null when signed out or expired. */
export async function checkSession(): Promise<Account | null> {
  if (!LIVE) return currentAccount();
  try {
    const { status, data } = await api("me");
    const user = data.user as { id?: string; email?: string; name?: string; fairAdmin?: boolean; booths?: unknown; mustVerify?: boolean } | null | undefined;
    if (status === 200 && user?.email && user.name) {
      const a = { email: user.email, name: user.name, id: user.id, fairAdmin: user.fairAdmin === true, booths: Array.isArray(user.booths) ? user.booths.filter((b): b is string => typeof b === "string") : [], mustVerify: user.mustVerify === true };
      rememberLive(a);
      return a;
    }
    if (status === 401) rememberLive(null);
    // Any other answer (offline, server error) keeps the last known account.
    return status === 401 ? null : currentAccount();
  } catch {
    return currentAccount();
  }
}

function setCurrent(email: string | null) {
  try {
    if (email) localStorage.setItem(CURRENT_KEY, email);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    // Nothing to remember.
  }
}

/** Where a per-account value is stored: the base key plus the signed-in email. */
export function accountKey(base: string) {
  try {
    const email = localStorage.getItem(CURRENT_KEY);
    return email ? `${base}@${email}` : base;
  } catch {
    return base;
  }
}

export type AuthResult = { ok: true; account: Account } | { ok: false; error: string };

export async function register(input: { name: string; email: string; password: string; acceptTerms?: boolean; website?: string; captcha?: string }): Promise<AuthResult> {
  if (LIVE) {
    const { status, data } = await api("register", {
      name: input.name.trim(),
      email: normEmail(input.email),
      password: input.password,
      acceptTerms: input.acceptTerms === true,
      website: input.website || undefined,
      captcha: input.captcha || undefined,
    });
    if (status !== 201) return { ok: false, error: serverError(data) };
    const user = data.user as Account;
    const account = (await checkSession()) ?? { email: user.email, name: user.name };
    rememberLive(account);
    return { ok: true, account };
  }
  const email = normEmail(input.email);
  const name = input.name.trim().slice(0, 40);
  if (!name) return { ok: false, error: "Isi nama kamu dulu." };
  if (!EMAIL.test(email) || email.length > 120) return { ok: false, error: "Format email belum benar." };
  if (input.password.length < MIN_PASSWORD) return { ok: false, error: `Password minimal ${MIN_PASSWORD} karakter.` };
  const all = readAll();
  if (all[email]) return { ok: false, error: "Email ini sudah terdaftar. Silakan masuk." };
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const stored: StoredAccount = { email, name, salt, hash: await hashPassword(input.password, salt), createdAt: Date.now() };
  all[email] = stored;
  writeAll(all);
  // The first account on this browser keeps the profile and character made before accounts existed.
  if (Object.keys(all).length === 1) adoptGuestData(email);
  setCurrent(email);
  return { ok: true, account: { email, name } };
}

export async function login(emailIn: string, password: string): Promise<AuthResult> {
  if (LIVE) {
    const r = await api("login", { email: normEmail(emailIn), password });
    if (r.status !== 200) return { ok: false, error: serverError(r.data) };
    const account = await checkSession();
    return account ? { ok: true, account } : { ok: false, error: "Server sedang bermasalah. Coba lagi sebentar lagi." };
  }
  const email = normEmail(emailIn);
  const account = readAll()[email];
  // Same message for both cases, so the form doesn't reveal which emails exist.
  const wrong = { ok: false as const, error: "Email atau password salah." };
  if (!account) return wrong;
  if (!sameHash(await hashPassword(password, account.salt), account.hash)) return wrong;
  setCurrent(email);
  return { ok: true, account: { email: account.email, name: account.name } };
}

/** Live site: email a password reset link. The answer is the same whether or not the account exists. */
export async function forgotPassword(email: string): Promise<string> {
  try {
    const r = await api("forgot", { email: normEmail(email) });
    if (r.status === 200) return "Kalau email itu terdaftar, link untuk membuat password baru sudah dikirim. Cek kotak masuk dan folder spam.";
    return serverError(r.data);
  } catch {
    return "Tidak tersambung ke server. Coba lagi.";
  }
}

/** Live site: send the verification email again. */
export async function resendVerification(): Promise<string> {
  try {
    const r = await api("verify/resend", {});
    if (r.status === 200) return r.data.alreadyVerified ? "Email kamu sudah terverifikasi." : "Email verifikasi dikirim ulang. Cek kotak masuk dan folder spam.";
    return serverError(r.data);
  } catch {
    return "Tidak tersambung ke server. Coba lagi.";
  }
}

export function logout() {
  if (LIVE) {
    rememberLive(null);
    void api("logout", {}).catch(() => {});
    return;
  }
  setCurrent(null);
}

/** Per-account data made before signing up for the first time. */
const ADOPT = ["vwo:jobseeker", "vwo:character"];

function adoptGuestData(email: string) {
  try {
    for (const base of ADOPT) {
      const v = localStorage.getItem(base);
      if (v !== null && localStorage.getItem(`${base}@${email}`) === null) localStorage.setItem(`${base}@${email}`, v);
    }
  } catch {
    // Start fresh.
  }
}
