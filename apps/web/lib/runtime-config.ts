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

/** Players online (Supabase Realtime), switched and limited without rebuilding the game. */
export interface LiveConfig {
  /** Players on other devices at all. Off: everyone plays solo with bots; calls still work. */
  enabled: boolean;
  /** Players online together before newcomers play solo (Supabase Free allows 200 connections); 0 = no cap. */
  maxConnections: number;
  /** People per floor channel; more than this on one floor opens a second channel, and so on. */
  floorCap: number;
  /** Realtime messages per second all walking and chatting may cost together (Free allows 100). */
  msgBudget: number;
  /** A standing player repeats where they are this often (seconds); 0 leaves it to presence. */
  heartbeatSec: number;
  /** Speech bubbles one player may send to others per minute. */
  chatPerMin: number;
}

/** Defaults sized for Supabase Free: ~100 players, up to 40 on one floor, under 100 messages/second. */
export const LIVE_DEFAULTS: LiveConfig = { enabled: true, maxConnections: 120, floorCap: 10, msgBudget: 70, heartbeatSec: 0, chatPerMin: 6 };

/** "0", "false", "off" and "no" switch a flag off; anything else (or unset) keeps the default. */
export function envFlag(raw: string | undefined, fallback: boolean) {
  if (raw === undefined || raw.trim() === "") return fallback;
  return !/^(0|false|off|no)$/i.test(raw.trim());
}

export function liveConfig(env: Record<string, string | undefined> = process.env): LiveConfig {
  const d = LIVE_DEFAULTS;
  return {
    enabled: envFlag(env.LIVE_ENABLED, d.enabled),
    maxConnections: envInt("LIVE_MAX_CONNECTIONS", d.maxConnections, 0, 100_000, env),
    floorCap: envInt("LIVE_FLOOR_CAP", d.floorCap, 2, 200, env),
    msgBudget: envInt("LIVE_MSG_BUDGET", d.msgBudget, 5, 1_000_000, env),
    heartbeatSec: envInt("LIVE_HEARTBEAT_SEC", d.heartbeatSec, 0, 3600, env),
    chatPerMin: envInt("LIVE_CHAT_PER_MIN", d.chatPerMin, 0, 120, env),
  };
}

/** Everything the browser takes from the server's environment. */
export function runtimeConfig(env: Record<string, string | undefined> = process.env) {
  return { ...pollConfig(env), live: liveConfig(env) };
}
