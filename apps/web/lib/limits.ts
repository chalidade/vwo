// Load knobs read from the server's environment, with defaults sized for a small budget (Vercel Pro,
// Supabase Free). Each one is listed in docs/deploy/vercel-supabase.md with when to raise it.
// Nothing here is a secret.

/** A whole number from the environment, kept between min and max; the default when unset or not a number. */
export function envInt(name: string, def: number, min: number, max: number, env: Record<string, string | undefined> = process.env) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** How long the CDN may serve the public event setup before asking again (seconds), and serve it stale while it does. */
export const stateCdnSec = () => envInt("STATE_CDN_SEC", 20, 0, 600);
export const stateSwrSec = () => envInt("STATE_SWR_SEC", 60, 0, 3600);
/** Images in the public setup larger than this (characters of data URL) are served by hash from their own cached URL. */
export const stateInlineMax = () => envInt("STATE_INLINE_MAX", 4096, 256, 10_000_000);
/** How long one instance reuses the visit totals (seconds); also the CDN lifetime of the public totals. */
export const statsCacheSec = () => envInt("STATS_CACHE_SEC", 30, 0, 600);
/** Google sign-ins started per address in 10 minutes (a campus or venue Wi-Fi shares one), and per device. */
export const googleRatePerIp = () => envInt("GOOGLE_RATE_PER_IP", 300, 1, 100_000);
export const googleRatePerDevice = () => envInt("GOOGLE_RATE_PER_DEVICE", 30, 1, 10_000);
/** Push notifications sent at once; the rest wait for this batch. */
export const pushBatch = () => envInt("PUSH_BATCH", 50, 1, 1000);
/** How long one reminders run works before stopping for the next run to carry on (seconds). */
export const reminderBudgetSec = () => envInt("REMINDER_BUDGET_SEC", 45, 5, 290);

/** Cache-Control for a response every visitor gets the same: the browser asks again each time, the CDN keeps it a while. */
export function publicCache(sMaxAge: number, swr: number) {
  return sMaxAge > 0 ? `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` : "no-store";
}
