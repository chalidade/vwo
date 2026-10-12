import "server-only";
import { stageConfigFromEnv } from "@vwo/shared";

/**
 * Limits the browser game follows, read from the server's env so they change without a rebuild (the game
 * is a static bundle). Public: no secrets here, only numbers and switches. Each feature adds its own
 * section; see docs/deploy/vercel-supabase.md for every variable.
 */
export function runtimeConfig() {
  return {
    /** Seminar and Aula broadcasts: mesh cap, heartbeat, chat. */
    stage: stageConfigFromEnv(process.env),
  };
}

export type RuntimeConfig = ReturnType<typeof runtimeConfig>;
