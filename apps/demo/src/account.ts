// Job seeker accounts for the demo, before launch: kept in this browser's localStorage.
// Passwords are never stored: only a salted PBKDF2 hash. The real launch moves accounts to the server.

export interface Account {
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: number;
}

const ACCOUNTS_KEY = "vwo:accounts";
const CURRENT_KEY = "vwo:account";
const ITERATIONS = 120_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD = 6;

function readAll(): Record<string, Account> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Account>) : {};
    return all && typeof all === "object" ? all : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Account>) {
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

/** The signed-in account, if any. */
export function currentAccount(): Account | null {
  try {
    const email = localStorage.getItem(CURRENT_KEY);
    return email ? (readAll()[email] ?? null) : null;
  } catch {
    return null;
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

export async function register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  const email = normEmail(input.email);
  const name = input.name.trim().slice(0, 40);
  if (!name) return { ok: false, error: "Isi nama kamu dulu." };
  if (!EMAIL.test(email) || email.length > 120) return { ok: false, error: "Format email belum benar." };
  if (input.password.length < MIN_PASSWORD) return { ok: false, error: `Password minimal ${MIN_PASSWORD} karakter.` };
  const all = readAll();
  if (all[email]) return { ok: false, error: "Email ini sudah terdaftar. Silakan masuk." };
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const account: Account = { email, name, salt, hash: await hashPassword(input.password, salt), createdAt: Date.now() };
  all[email] = account;
  writeAll(all);
  // The first account on this browser keeps the profile and character made before accounts existed.
  if (Object.keys(all).length === 1) adoptGuestData(email);
  setCurrent(email);
  return { ok: true, account };
}

export async function login(emailIn: string, password: string): Promise<AuthResult> {
  const email = normEmail(emailIn);
  const account = readAll()[email];
  // Same message for both cases, so the form doesn't reveal which emails exist.
  const wrong = { ok: false as const, error: "Email atau password salah." };
  if (!account) return wrong;
  if (!sameHash(await hashPassword(password, account.salt), account.hash)) return wrong;
  setCurrent(email);
  return { ok: true, account };
}

export function logout() {
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
