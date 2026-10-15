import "server-only";

/** Answers older than this are refused, even though Cloudflare would still say they were solved. */
export const TURNSTILE_MAX_AGE_MS = 5 * 60_000;

/** Cloudflare's always-pass and always-fail test keys answer for "example.com", so their hostname is not checked. */
const testSecret = (s: string) => /^[123]x0{20,}/.test(s);

/**
 * Where our forms may have been solved: jobfair.co.id, the configured app address, the host this
 * request came to (a Vercel preview), and any listed in TURNSTILE_HOSTNAMES (comma separated).
 */
export function turnstileHosts(requestHost?: string | null, env: Record<string, string | undefined> = process.env) {
  const hosts = new Set(["jobfair.co.id", "www.jobfair.co.id"]);
  for (const u of [env.APP_URL, env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`])
    if (u)
      try {
        hosts.add(new URL(u).hostname);
      } catch {
        /* not a URL: ignored */
      }
  for (const h of (env.TURNSTILE_HOSTNAMES ?? "").split(",")) if (h.trim()) hosts.add(h.trim().toLowerCase());
  if (requestHost) hosts.add(requestHost.split(":")[0]!.toLowerCase());
  return hosts;
}

export type TurnstileCheck =
  | { ok: true }
  | { ok: false; reason: "turnstile_missing" | "turnstile_failed" | "turnstile_host" | "turnstile_action" | "turnstile_old" | "turnstile_error" };

/**
 * Cloudflare Turnstile: a free check that the form was sent by a person, usually without a puzzle.
 * Besides "solved", the answer must come from one of our hosts, for this form (`action`, when the
 * widget was given one) and from the last five minutes. Each answer works once (Cloudflare's rule).
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  opts: { action?: string; host?: string | null } = {},
  now = Date.now(),
  secret = process.env.TURNSTILE_SECRET_KEY ?? "",
): Promise<TurnstileCheck> {
  if (!token) return { ok: false, reason: "turnstile_missing" };
  let data: { success?: boolean; hostname?: string; action?: string; challenge_ts?: string };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, reason: "turnstile_error" };
  }
  if (data.success !== true) return { ok: false, reason: "turnstile_failed" };
  if (!testSecret(secret) && !turnstileHosts(opts.host).has((data.hostname ?? "").toLowerCase())) return { ok: false, reason: "turnstile_host" };
  if (opts.action && data.action !== opts.action) return { ok: false, reason: "turnstile_action" };
  const at = Date.parse(data.challenge_ts ?? "");
  if (!Number.isFinite(at) || now - at > TURNSTILE_MAX_AGE_MS) return { ok: false, reason: "turnstile_old" };
  return { ok: true };
}

/**
 * True when Turnstile is off (no TURNSTILE_SECRET_KEY; the game is built with VITE_TURNSTILE_SITE_KEY)
 * or the answer passes every check above.
 */
export async function isHuman(token: string | undefined, ip: string, opts: { action?: string; host?: string | null } = {}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  return (await verifyTurnstile(token, ip, opts, Date.now(), secret)).ok;
}
