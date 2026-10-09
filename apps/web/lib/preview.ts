// Before launch the app is only for the organisers and verified companies. Who may look is carried in
// a signed cookie, so the edge can check it without a database call. Web Crypto: runs on the edge too.

export const PREVIEW_COOKIE = "vwo_preview";
export const PREVIEW_DAYS = 7;

/** The site is open to everyone once the owner sets SITE_LAUNCHED=1. */
export const launched = () => process.env.SITE_LAUNCHED === "1";

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function key() {
  // A dedicated secret when set; otherwise the database URL, which is already secret and server-only.
  const secret = process.env.PREVIEW_SECRET || process.env.DATABASE_URL || "";
  if (!secret) return null;
  return crypto.subtle.importKey("raw", enc.encode(`vwo-preview:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function signPreview(userId: string, now = Date.now()) {
  const k = await key();
  if (!k) return null;
  const body = `${now + PREVIEW_DAYS * 86400_000}.${userId}`;
  return `${body}.${b64url(await crypto.subtle.sign("HMAC", k, enc.encode(body)))}`;
}

export async function validPreview(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const body = value.slice(0, i);
  const exp = Number(body.split(".")[0]);
  if (!Number.isFinite(exp) || exp < now) return false;
  const k = await key();
  if (!k) return false;
  const want = b64url(await crypto.subtle.sign("HMAC", k, enc.encode(body)));
  const got = value.slice(i + 1);
  if (want.length !== got.length) return false;
  let diff = 0;
  for (let j = 0; j < want.length; j++) diff |= want.charCodeAt(j) ^ got.charCodeAt(j);
  return diff === 0;
}
