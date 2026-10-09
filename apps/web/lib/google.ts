import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Sign in with Google (OpenID Connect, authorization code with PKCE). Off until both env vars are set. */
export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const GOOGLE_COOKIE = "vwo_google";

const b64url = (b: Buffer) => b.toString("base64url");

/** This request's own origin, as the browser sees it; Google sends the person back here. */
export function callbackUrl(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/google/callback`;
}

export function startGoogle(req: Request) {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: `${state}.${verifier}` };
}

/** Trade the code for the person's Google id, email and name. Null when anything does not check out. */
export async function finishGoogle(req: Request, code: string, verifier: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(req),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return null;
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) return null;
  // Asked of Google directly over TLS with our own token, so the answer needs no signature check.
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!info.ok) return null;
  const u = (await info.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!u.sub || !u.email || u.email_verified !== true) return null;
  return { sub: u.sub, email: u.email.trim().toLowerCase(), name: (u.name ?? "").trim() };
}
