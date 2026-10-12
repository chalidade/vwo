// Limits and switches the live site's server sets through its environment (see
// docs/deploy/vercel-supabase.md), read once from /api/jobfair/config. The game is a static bundle, so
// it starts on these defaults (sized for a small budget) and takes the server's values when they come;
// the offline demo keeps the defaults.
import { LIVE } from "./mode";

export interface RuntimeConfig {
  /** Seconds between pulls of the shared event setup (paused while the tab is hidden). */
  statePollSec: number;
  /** Seconds between pulls of a seeker's applications and HR's answers. */
  applicationsPollSec: number;
  /** Seconds between pulls of booth visit totals, and between sends of this player's visits. */
  statsPollSec: number;
  statsSendSec: number;
  /** Seconds between pulls of this account's saved progress from other devices, and between saves. */
  progressPollSec: number;
  progressPushSec: number;
  /** Seconds between pulls of booth ratings, the friends list and a booth's applicants (company portal). */
  reviewsPollSec: number;
  friendsPollSec: number;
  portalPollSec: number;
}

export const DEFAULT_CONFIG: RuntimeConfig = {
  statePollSec: 60,
  applicationsPollSec: 30,
  statsPollSec: 120,
  statsSendSec: 30,
  progressPollSec: 90,
  progressPushSec: 8,
  reviewsPollSec: 180,
  friendsPollSec: 180,
  portalPollSec: 15,
};

let current: RuntimeConfig = DEFAULT_CONFIG;
let loading: Promise<RuntimeConfig> | null = null;

/** The limits in force now (the defaults until the server's have come). */
export const runtimeConfig = () => current;

/** Only known fields, as positive numbers; anything else keeps the default. */
export function mergeConfig(base: RuntimeConfig, got: unknown): RuntimeConfig {
  const out = { ...base };
  if (!got || typeof got !== "object") return out;
  for (const k of Object.keys(base) as (keyof RuntimeConfig)[]) {
    const v = (got as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

/** Fetch the server's limits once (live site only). Never fails: offline keeps the defaults. */
export function loadRuntimeConfig() {
  if (!LIVE) return Promise.resolve(current);
  loading ??= fetch("/api/jobfair/config", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (current = mergeConfig(DEFAULT_CONFIG, d)))
    .catch(() => current);
  return loading;
}
