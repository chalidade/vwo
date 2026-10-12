// What the game in the browser needs to know of the server's limits, read from the environment
// (docs/deploy/vercel-supabase.md lists each with its default). Served by /api/jobfair/config.
// Public: never put a secret here.
import { envInt } from "./limits";

/** Polling intervals in seconds; the defaults keep requests per visitor low for a small budget. */
export function pollConfig(env: Record<string, string | undefined> = process.env) {
  return {
    statePollSec: envInt("STATE_POLL_SEC", 60, 10, 3600, env),
    applicationsPollSec: envInt("APPLICATIONS_POLL_SEC", 30, 5, 3600, env),
    statsPollSec: envInt("STATS_POLL_SEC", 120, 15, 3600, env),
    statsSendSec: envInt("STATS_SEND_SEC", 30, 5, 600, env),
    progressPollSec: envInt("PROGRESS_POLL_SEC", 90, 15, 3600, env),
    progressPushSec: envInt("PROGRESS_PUSH_SEC", 8, 2, 120, env),
    reviewsPollSec: envInt("REVIEWS_POLL_SEC", 180, 30, 3600, env),
    friendsPollSec: envInt("FRIENDS_POLL_SEC", 180, 30, 3600, env),
    portalPollSec: envInt("PORTAL_POLL_SEC", 15, 5, 600, env),
  };
}

/** Everything the browser takes from the server's environment. */
export function runtimeConfig(env: Record<string, string | undefined> = process.env) {
  return { ...pollConfig(env) };
}
