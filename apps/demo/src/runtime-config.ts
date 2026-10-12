// Limits and switches the live site's server sets through its environment (see
// docs/deploy/vercel-supabase.md), read from /api/jobfair/config. The game is a static bundle, so
// it starts on these defaults (sized for a small budget) and takes the server's values when they come;
// the offline demo keeps the defaults.
import { STAGE_DEFAULTS, type StageConfig, cleanStageConfig } from "@vwo/shared";
import { useEffect, useState } from "react";
import { LIVE } from "./mode";

/** Players online (see apps/web/lib/runtime-config.ts and live.ts). */
export interface LiveConfig {
  enabled: boolean;
  maxConnections: number;
  floorCap: number;
  msgBudget: number;
  heartbeatSec: number;
  chatPerMin: number;
}

export const LIVE_DEFAULTS: LiveConfig = { enabled: true, maxConnections: 120, floorCap: 10, msgBudget: 70, heartbeatSec: 0, chatPerMin: 6 };

const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);

/** The players-online limits the server sent, field by field, falling back to the defaults for anything missing or odd. */
export function readLive(raw: unknown): LiveConfig {
  const d = LIVE_DEFAULTS;
  const l = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof l.enabled === "boolean" ? l.enabled : d.enabled,
    maxConnections: num(l.maxConnections, d.maxConnections, 0, 100_000),
    floorCap: num(l.floorCap, d.floorCap, 2, 200),
    msgBudget: num(l.msgBudget, d.msgBudget, 5, 1_000_000),
    heartbeatSec: num(l.heartbeatSec, d.heartbeatSec, 0, 3600),
    chatPerMin: num(l.chatPerMin, d.chatPerMin, 0, 120),
  };
}

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
  live: LiveConfig;
  /** Seminar and Aula broadcasts: mesh cap, heartbeat, chat. */
  stage: StageConfig;
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
  live: LIVE_DEFAULTS,
  stage: STAGE_DEFAULTS,
};
/** Asked again after this long, so a change on the server reaches tabs left open all day. */
const REFRESH_MS = 5 * 60_000;

let current: RuntimeConfig = DEFAULT_CONFIG;
let loading: Promise<RuntimeConfig> | null = null;
let loadedAt = 0;
const subs = new Set<(c: RuntimeConfig) => void>();

/** The limits in force now (the defaults until the server's have come). */
export const runtimeConfig = () => current;
export const runtimeConfigNow = runtimeConfig;

/** Only known fields: positive numbers for the intervals, a cleaned stage section; anything else keeps the default. */
export function mergeConfig(base: RuntimeConfig, got: unknown): RuntimeConfig {
  const out = { ...base };
  if (!got || typeof got !== "object") return out;
  const g = got as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof RuntimeConfig)[]) {
    if (k === "stage" || k === "live") continue;
    const v = g[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  if (g.stage !== undefined) out.stage = cleanStageConfig(g.stage);
  if (g.live !== undefined) out.live = readLive(g.live);
  return out;
}

/** Fetch the server's limits (live site only, at most once per few minutes). Never fails: offline keeps the defaults. */
export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (!LIVE || typeof fetch === "undefined") return Promise.resolve(current);
  if (loading && Date.now() - loadedAt < REFRESH_MS) return loading;
  loadedAt = Date.now();
  loading = fetch("/api/jobfair/config", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: unknown) => {
      if (d) {
        current = mergeConfig(DEFAULT_CONFIG, d);
        for (const fn of subs) fn(current);
      }
      return current;
    })
    .catch(() => current);
  return loading;
}

/** The limits, re-rendering when the server's answer arrives. */
export function useRuntimeConfig() {
  const [c, setC] = useState(current);
  useEffect(() => {
    subs.add(setC);
    setC(current);
    void loadRuntimeConfig();
    return () => {
      subs.delete(setC);
    };
  }, []);
  return c;
}
