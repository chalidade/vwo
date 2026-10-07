import { describe, expect, it } from "vitest";
import { DEMO_JOB_FAIR, fairFloorId } from "@vwo/shared";
import { DemoJobFair, remoteId } from "../src/jobfair-engine";
import { parseWire } from "../src/live";

const floor = fairFloorId(DEMO_JOB_FAIR, 0);
const known = (id: string) => id === floor;
const wire = (extra: object = {}) =>
  JSON.stringify({ v: 1, id: "abc123", name: "Sari", look: { skin: "#f1c27d", style: "long", glasses: true }, floorId: floor, x: 10, y: 12, facing: "front", seatId: null, say: null, ...extra });

describe("live channel", () => {
  it("accepts a well-formed player and rejects junk from the public broker", () => {
    const p = parseWire(wire({ name: "  Sari\u0007  Dewi ", say: "Halo!" }), known)!;
    expect(p.name).toBe("Sari Dewi");
    expect(p.say).toBe("Halo!");
    expect(p.look).toEqual({ skin: "#f1c27d", style: "long", glasses: true });
    expect(parseWire("not json", known)).toBeNull();
    expect(parseWire(wire({ v: 2 }), known)).toBeNull();
    expect(parseWire(wire({ floorId: "elsewhere" }), known)).toBeNull();
    expect(parseWire(wire({ x: "1e999" }), known)).toBeNull();
    expect(parseWire(wire({ facing: "up" }), known)).toBeNull();
    expect(parseWire(wire({ id: "../../x" }), known)).toBeNull();
    // Odd look values are dropped rather than drawn.
    expect(parseWire(wire({ look: { skin: "url(javascript:x)", hair: "#000" } }), known)!.look).toEqual({ hair: "#000" });
    expect(parseWire(wire({ name: "x".repeat(50) }), known)!.name).toHaveLength(20);
  });

  it("mirrors remote players as visitors and removes them when they leave", () => {
    const fair = new DemoJobFair(() => 0.5);
    const p = parseWire(wire(), known)!;
    fair.upsertRemote(p);
    const v = fair.visitors.get(remoteId("abc123"))!;
    expect(v.remote).toBe(true);
    expect(v.displayName).toBe("🌐 Sari");
    fair.upsertRemote({ ...p, x: 11, say: "Hai" });
    expect(v.x).toBe(11);
    expect(fair.bubbles.get(remoteId("abc123"))?.text).toBe("Hai");
    // A sofa seat on the ground floor is honoured; a made-up one is not.
    const sofa = fair.floors[0]!.seats.find((s) => s.sofa)!;
    fair.upsertRemote({ ...p, seatId: sofa.id });
    expect(fair.seatTaken(sofa.id)).toBe(true);
    fair.upsertRemote({ ...p, seatId: "nope" });
    expect(v.seatId).toBeNull();
    fair.removeRemote("abc123");
    expect(fair.visitors.has(remoteId("abc123"))).toBe(false);
  });
});
