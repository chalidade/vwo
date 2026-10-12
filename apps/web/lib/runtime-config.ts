// Limits the browser game reads at runtime. The game is a static Vite bundle, so anything an
// organiser may want to change on the day (switch players-online off, let more people in once a
// bigger Supabase plan is paid) comes from the server's env vars through GET /api/jobfair/config.
// No secrets here: everything returned is public.

export interface LiveConfig {
  /** Players on other devices at all. Off: everyone plays solo with bots; calls still work. */
  enabled: boolean;
  /** Players online together before newcomers play solo (Supabase Free allows 200 connections). */
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

export interface RuntimeConfig {
  live: LiveConfig;
}

/** Defaults sized for Supabase Free: ~100 players, up to 40 on one floor, under 100 messages/second. */
export const LIVE_DEFAULTS: LiveConfig = { enabled: true, maxConnections: 120, floorCap: 10, msgBudget: 70, heartbeatSec: 0, chatPerMin: 6 };

/** A whole number from env within [min, max], or the default when unset or not a number. */
export function envInt(raw: string | undefined, fallback: number, min: number, max: number) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** "0", "false", "off" and "no" switch a flag off; anything else (or unset) keeps the default. */
export function envFlag(raw: string | undefined, fallback: boolean) {
  if (raw === undefined || raw.trim() === "") return fallback;
  return !/^(0|false|off|no)$/i.test(raw.trim());
}

export function runtimeConfig(env: Record<string, string | undefined> = process.env): RuntimeConfig {
  const d = LIVE_DEFAULTS;
  return {
    live: {
      enabled: envFlag(env.LIVE_ENABLED, d.enabled),
      maxConnections: envInt(env.LIVE_MAX_CONNECTIONS, d.maxConnections, 0, 100_000),
      floorCap: envInt(env.LIVE_FLOOR_CAP, d.floorCap, 2, 200),
      msgBudget: envInt(env.LIVE_MSG_BUDGET, d.msgBudget, 5, 1_000_000),
      heartbeatSec: envInt(env.LIVE_HEARTBEAT_SEC, d.heartbeatSec, 0, 3600),
      chatPerMin: envInt(env.LIVE_CHAT_PER_MIN, d.chatPerMin, 0, 120),
    },
  };
}
