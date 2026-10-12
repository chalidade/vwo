import { describe, expect, it } from "vitest";
import { ANOMALY_INFO, ANOMALY_KINDS, PARK, findPath, isBlocked } from "@vwo/shared";
import { anomalyFloorId, anomalyHint, anomalyStops, parkAnomalySpot } from "../src/fair/anomaly";
import { phoneBook } from "../src/fair/phone-book";
import { DemoJobFair } from "../src/jobfair-engine";

describe("the park's anomalies in the game", () => {
  const fair = new DemoJobFair(() => 0.5);
  const roomKind = (id: string) => fair.room(id)?.kind;
  const park = fair.floor(fair.parkId);
  const parkKinds = ANOMALY_KINDS.filter((k) => ANOMALY_INFO[k].place === "park");

  it("only turn up in the park, never on a lift stop", () => {
    const stops = anomalyStops(fair.stops, "park", roomKind, fair.parkStop());
    expect(stops.map((st) => st.floorId)).toEqual([fair.parkId]);
    for (const n of [0, 7, 0xffffffff]) expect(anomalyFloorId(stops, n)).toBe(fair.parkId);
    expect(anomalyStops(fair.stops, "park", roomKind)).toEqual([]);
    // The others stay inside.
    expect(anomalyStops(fair.stops, undefined, roomKind, fair.parkStop())).toBe(fair.stops);
  });

  it("stand by what they belong to: a tree, a lamp, the fountain, a bench; and can be walked up to", () => {
    for (const k of parkKinds)
      for (let seed = 1; seed < 4_000_000_000; seed += 397_000_001) {
        const p = parkAnomalySpot(k, park, seed);
        expect(parkAnomalySpot(k, park, seed)).toEqual(p);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(PARK.width);
        // The player walks to its left side to catch it.
        expect(findPath(park, PARK.arrive, { x: p.x - 0.8, y: p.y }), `${k} ${seed}`).not.toBeNull();
      }
    const tree = parkAnomalySpot("kunti", park, 3);
    expect(PARK.trees.some((t) => t.x === tree.x && Math.abs(t.y - tree.y) < 0.1)).toBe(true);
    const lamp = parkAnomalySpot("lamp", park, 3);
    expect(PARK.lamps.some((l) => l.x === lamp.x)).toBe(true);
    const eyes = parkAnomalySpot("eyes", park, 12345);
    expect(isBlocked(park, eyes.x, eyes.y)).toBe(false);
  });

  it("say in the collection when to look for them", () => {
    expect(anomalyHint(ANOMALY_INFO.pocong)).toBe("Petunjuk: malam hari di taman");
    expect(anomalyHint(ANOMALY_INFO.kite)).toBe("Petunjuk: siang hari di taman");
  });
});

describe("the phone box's list", () => {
  const friends = [
    { tag: "a1", name: "Budi", state: "friend" as const },
    { tag: "b2", name: "Ayu", state: "friend" as const },
    { tag: "c3", name: "Citra", state: "sent" as const },
    { tag: "d4", name: "Doni", state: "received" as const },
    { tag: "e5", name: "Eka", state: "friend" as const },
  ];
  const online = new Map([
    ["e5", { memberId: "net:e5", where: "Lantai 2 · Teknologi" }],
    ["c3", { memberId: "net:c3", where: "Taman" }],
    ["zz", { memberId: "net:zz", where: "Taman" }],
  ]);

  it("lists only friends, the online ones first, and marks who can't be rung", () => {
    const book = phoneBook(friends, online);
    expect(book.map((e) => e.name)).toEqual(["Eka", "Ayu", "Budi"]);
    expect(book[0]!.online).toEqual({ memberId: "net:e5", where: "Lantai 2 · Teknologi" });
    expect(book.slice(1).every((e) => e.online === null)).toBe(true);
    // Someone who only asked (or was asked), or a stranger online, is never in it.
    expect(book.some((e) => e.tag === "c3" || e.tag === "d4" || e.tag === "zz")).toBe(false);
    expect(phoneBook([], online)).toEqual([]);
  });
});
