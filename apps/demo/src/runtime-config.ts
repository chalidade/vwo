// Limits set by the organiser through the server's env vars (see apps/web/lib/runtime-config.ts),
// fetched once per page load. The demo and an unreachable server use the defaults below, which
// match the server's own defaults.
import { LIVE } from "./mode";

export interface LiveConfig {
  enabled: boolean;
  maxConnections: number;
  floorCap: number;
  msgBudget: number;
  heartbeatSec: number;
  chatPerMin: number;
}

export interface RuntimeConfig {
  live: LiveConfig;
}

export const DEFAULT_CONFIG: RuntimeConfig = {
  live: { enabled: true, maxConnections: 120, floorCap: 10, msgBudget: 70, heartbeatSec: 0, chatPerMin: 6 },
};

const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);

/** Take what the server sent, field by field, falling back to the defaults for anything missing or odd. */
export function readConfig(raw: unknown): RuntimeConfig {
  const d = DEFAULT_CONFIG.live;
  const l = (raw as { live?: Record<string, unknown> } | null)?.live ?? {};
  return {
    live: {
      enabled: typeof l.enabled === "boolean" ? l.enabled : d.enabled,
      maxConnections: num(l.maxConnections, d.maxConnections, 0, 100_000),
      floorCap: num(l.floorCap, d.floorCap, 2, 200),
      msgBudget: num(l.msgBudget, d.msgBudget, 5, 1_000_000),
      heartbeatSec: num(l.heartbeatSec, d.heartbeatSec, 0, 3600),
      chatPerMin: num(l.chatPerMin, d.chatPerMin, 0, 120),
    },
  };
}

let loading: Promise<RuntimeConfig> | null = null;

/** The organiser's limits; never rejects, and never waits more than a few seconds. */
export function runtimeConfig(): Promise<RuntimeConfig> {
  if (!LIVE) return Promise.resolve(DEFAULT_CONFIG);
  loading ??= Promise.race([
    fetch("/api/jobfair/config", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then(readConfig)
      .catch(() => DEFAULT_CONFIG),
    new Promise<RuntimeConfig>((r) => setTimeout(() => r(DEFAULT_CONFIG), 5000)),
  ]);
  return loading;
}
