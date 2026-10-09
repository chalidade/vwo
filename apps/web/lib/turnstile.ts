import "server-only";

/**
 * Cloudflare Turnstile: a free check that the sign-up comes from a person, usually without a puzzle.
 * Off until TURNSTILE_SECRET_KEY is set (and the game is built with VITE_TURNSTILE_SITE_KEY).
 */
export async function isHuman(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
