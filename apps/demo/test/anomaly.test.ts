import { describe, expect, it } from "vitest";
import { LIFT_FRONT, findPath, isBlocked } from "@vwo/shared";
import { WANDER, anomalyFloorId, anomalySpot } from "../src/fair/anomaly";
import { DemoJobFair } from "../src/jobfair-engine";

describe("where an anomaly shows up", () => {
  const fair = new DemoJobFair(() => 0.5);

  it("picks one of the lift's stops from the server's number", () => {
    expect(anomalyFloorId(fair.stops, 0)).toBe(fair.stops[0]!.floorId);
    expect(anomalyFloorId(fair.stops, fair.stops.length + 2)).toBe(fair.stops[2]!.floorId);
    expect(anomalyFloorId(fair.stops, 0xffffffff)).toBe(fair.stops[0xffffffff % fair.stops.length]!.floorId);
    expect(anomalyFloorId([], 5)).toBeNull();
  });

  it("is the same spot for everyone, walkable with room to stroll, off the chairs, and reachable from the lift", () => {
    for (const st of fair.stops) {
      const floor = fair.floor(st.floorId);
      for (let seed = 1; seed < 4_000_000_000; seed += 397_000_001) {
        const p = anomalySpot(floor, seed);
        expect(anomalySpot(floor, seed)).toEqual(p);
        for (const dx of [-WANDER, 0, WANDER]) expect(isBlocked(floor, p.x + dx, p.y), `${st.floorId} ${seed}`).toBe(false);
        expect(floor.seats.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 0.6)).toBe(false);
        expect(findPath(floor, LIFT_FRONT, { x: p.x, y: p.y + 0.5 }), `${st.floorId} ${seed}`).not.toBeNull();
      }
    }
  });

  it("spreads over the floor", () => {
    const floor = fair.floor(fair.stops[1]!.floorId);
    const spots = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(anomalySpot(floor, i * 7919 + 1))));
    expect(spots.size).toBeGreaterThan(20);
  });
});
