import { describe, expect, it } from "vitest";
import { ANOMALY_INFO, ANOMALY_KINDS, LIFT_FRONT, anomalyKindsIn, anomalyReason, anomalyRewardOf, findPath, isBlocked, pickAnomalyKind } from "@vwo/shared";
import { WANDER, anomalyFloorId, anomalyHint, anomalySpot, anomalyStops, mergeCaught } from "../src/fair/anomaly";
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

describe("anomaly kinds in the game", () => {
  const fair = new DemoJobFair(() => 0.5);
  const roomKind = (id: string) => fair.room(id)?.kind;

  it("puts the room ones only on their room's floor", () => {
    const food = anomalyStops(fair.stops, "foodcourt", roomKind);
    expect(food.length).toBe(1);
    expect(roomKind(food[0]!.roomId!)).toBe("foodcourt");
    expect(anomalyStops(fair.stops, "aula", roomKind).map((st) => roomKind(st.roomId!))).toEqual(["aula"]);
    expect(anomalyStops(fair.stops, undefined, roomKind)).toBe(fair.stops);
    // The food court closed: nowhere to go, so it doesn't show.
    expect(
      anomalyFloorId(
        anomalyStops(
          fair.stops.filter((st) => st.roomId !== food[0]!.roomId),
          "foodcourt",
          roomKind,
        ),
        7,
      ),
    ).toBeNull();
  });

  it("picks the same weighted kind for the same roll and moment, only among those out then", () => {
    const noon = Date.UTC(2026, 9, 12, 5); // 12.00 WIB
    const night = Date.UTC(2026, 9, 12, 14); // 21.00 WIB
    expect(pickAnomalyKind(0.42, noon)).toBe(pickAnomalyKind(0.42, noon));
    const atNoon = new Set(Array.from({ length: 1000 }, (_, i) => pickAnomalyKind(i / 1000, noon)));
    const atNight = new Set(Array.from({ length: 1000 }, (_, i) => pickAnomalyKind(i / 1000, night)));
    expect(atNoon.has("ghost") || atNoon.has("ufo") || atNoon.has("rooster")).toBe(false);
    expect(atNight.has("ghost") && atNight.has("ufo") && !atNight.has("butterfly")).toBe(true);
    expect(atNoon.has("goldcat") && atNoon.has("dragon")).toBe(true);
    expect(pickAnomalyKind(-1, noon)).toBe("cat");
    expect(ANOMALY_KINDS).toContain(pickAnomalyKind(2, noon));
  });

  it("reads the kinds caught back from the coin history, old lines and new", () => {
    const lines = ANOMALY_KINDS.flatMap((k) => [anomalyReason(k, anomalyRewardOf(k, 200, 1, 5)), anomalyReason(k, { kind: "voucher", coins: 5 })]);
    expect(anomalyKindsIn(lines)).toEqual([...ANOMALY_KINDS]);
    expect(anomalyKindsIn(["Kejutan: Kucing oren", "Voucher lamar dari burung merpati", "Kejutan langka: Naga kecil", "Kejutan: Kucing palsu", "Top up koin"])).toEqual([
      "cat",
      "pigeon",
      "dragon",
    ]);
  });

  it("merges the records into one collection: the first catch of each kind, with a place when known", () => {
    const m = mergeCaught([
      [{ kind: "dog", at: 300 }],
      [
        { kind: "dog", at: 200, where: "Lantai 2 · Teknologi" },
        { kind: "cat", at: 500 },
      ],
      [{ kind: "dog", at: 100 }],
    ]);
    expect([...m.keys()]).toEqual(["cat", "dog"]);
    expect(m.get("dog")).toEqual({ kind: "dog", at: 100, where: "Lantai 2 · Teknologi" });
    expect(m.get("cat")).toEqual({ kind: "cat", at: 500 });
  });

  it("hints where to look for one not caught yet", () => {
    expect(anomalyHint(ANOMALY_INFO.duck)).toBe("Petunjuk: di food court");
    expect(anomalyHint(ANOMALY_INFO.ghost)).toBe("Petunjuk: 18.00–05.00 WIB");
    expect(anomalyHint(ANOMALY_INFO.goldcat)).toBe("Petunjuk: sangat jarang muncul");
    expect(anomalyHint(ANOMALY_INFO.cat)).toBeNull();
  });
});
