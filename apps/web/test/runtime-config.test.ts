import { describe, expect, it } from "vitest";
import { GET } from "../app/api/jobfair/config/route";
import { LIVE_DEFAULTS, runtimeConfig } from "../lib/runtime-config";

describe("runtime config for the game", () => {
  it("uses defaults sized for Supabase Free when nothing is set", () => {
    expect(runtimeConfig({}).live).toEqual(LIVE_DEFAULTS);
  });

  it("reads the organiser's env vars, keeping odd values in range", () => {
    const live = runtimeConfig({
      LIVE_ENABLED: "off",
      LIVE_MAX_CONNECTIONS: "1000",
      LIVE_FLOOR_CAP: "1",
      LIVE_MSG_BUDGET: "abc",
      LIVE_HEARTBEAT_SEC: "-5",
      LIVE_CHAT_PER_MIN: "12.6",
    }).live;
    expect(live).toEqual({ enabled: false, maxConnections: 1000, floorCap: 2, msgBudget: LIVE_DEFAULTS.msgBudget, heartbeatSec: 0, chatPerMin: 13 });
    expect(runtimeConfig({ LIVE_ENABLED: "1" }).live.enabled).toBe(true);
  });

  it("is public, cacheable for a minute, and carries no secrets", async () => {
    process.env.LIVE_FLOOR_CAP = "25";
    const res = GET();
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    const body = await res.json();
    expect(body.live.floorCap).toBe(25);
    expect(JSON.stringify(body)).not.toMatch(/postgres|secret|key/i);
    delete process.env.LIVE_FLOOR_CAP;
  });
});
