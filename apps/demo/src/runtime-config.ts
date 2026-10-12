// Limits the game follows, set by env vars on the server (GET /api/jobfair/config) so the organiser can
// raise them or switch features off without rebuilding this static bundle. The demo, and the live site
// while the server can't be reached, use the defaults, which fit the free plans.
import { STAGE_DEFAULTS, type StageConfig, cleanStageConfig } from "@vwo/shared";
import { useEffect, useState } from "react";
import { LIVE } from "./mode";

export interface RuntimeConfig {
  /** Seminar and Aula broadcasts: mesh cap, heartbeat, chat. */
  stage: StageConfig;
}

const DEFAULTS: RuntimeConfig = { stage: STAGE_DEFAULTS };
/** Asked again after this long, so a change on the server reaches tabs left open all day. */
const REFRESH_MS = 5 * 60_000;

let current: RuntimeConfig = DEFAULTS;
let loading: Promise<RuntimeConfig> | null = null;
let loadedAt = 0;
const subs = new Set<(c: RuntimeConfig) => void>();

const clean = (x: unknown): RuntimeConfig => {
  const c = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return { stage: cleanStageConfig(c.stage) };
};

/** The limits now: the defaults until the server answered. */
export const runtimeConfigNow = () => current;

/** Fetch the limits (at most once per few minutes); resolves to the defaults when offline or in the demo. */
export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (!LIVE || typeof fetch === "undefined") return Promise.resolve(current);
  if (loading && Date.now() - loadedAt < REFRESH_MS) return loading;
  loadedAt = Date.now();
  loading = fetch("/api/jobfair/config", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: unknown) => {
      if (j) {
        current = clean(j);
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
