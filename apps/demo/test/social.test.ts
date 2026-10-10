import { describe, expect, it } from "vitest";
import { PING_TEXT, PingLimiter, parsePing } from "../src/fair/social";
import { LiveChannel, type Transport } from "../src/live";

describe("quick messages between job seekers", () => {
  it("accepts only known keys, with a floor only where one is meant", () => {
    expect(parsePing({ key: "follow" })).toEqual({ key: "follow" });
    expect(parsePing({ key: "floor", floorId: "fl-2" })).toEqual({ key: "floor", floorId: "fl-2" });
    expect(parsePing({ key: "hi", floorId: "fl-2" })).toEqual({ key: "hi" });
    expect(parsePing({ key: "floor" })).toBeNull();
    expect(parsePing({ key: "floor", floorId: "../x y" })).toBeNull();
    expect(parsePing({ key: "<script>" })).toBeNull();
    expect(parsePing({ key: "toString" })).toBeNull();
    expect(parsePing("hi")).toBeNull();
    expect(PING_TEXT.floor("Lantai 3 · Seminar")).toBe("🛗 Ayo ke Lantai 3 · Seminar!");
  });

  it("lets a sender through a few times, then makes them wait", () => {
    const l = new PingLimiter(3, 20_000);
    expect([0, 1, 2, 3].map((t) => l.allow("a", t))).toEqual([true, true, true, false]);
    expect(l.allow("b", 4)).toBe(true);
    expect(l.allow("a", 20_001)).toBe(true);
  });

  it("delivers a direct message only from a peer it can see", async () => {
    const got: [string, unknown][] = [];
    let on: Parameters<Transport["connect"]>[0] | null = null;
    const sent: [string, string, string][] = [];
    const t: Transport = {
      connected: true,
      async connect(o) {
        on = o;
      },
      send() {},
      direct: (from, to, text) => void sent.push([from, to, text]),
      close() {},
    };
    const ch = new LiveChannel("r", () => null, () => {}, () => {}, () => true, () => {}, () => t, (from, data) => got.push([from, data]));
    ch.start();
    await Promise.resolve();
    on!.direct!("stranger", JSON.stringify({ key: "hi" }));
    expect(got).toEqual([]);
    expect(ch.sendTo("peer1", { key: "hi" })).toBe(false);
    on!.message("peer1", JSON.stringify({ v: 1, id: "peer1", name: "Sari", look: {}, floorId: "f", x: 1, y: 1, facing: "front" }));
    on!.direct!("peer1", JSON.stringify({ key: "hi" }));
    on!.direct!("peer1", "not json");
    expect(got).toEqual([["peer1", { key: "hi" }]]);
    expect(ch.sendTo("peer1", { key: "follow" })).toBe(true);
    expect(sent).toEqual([[ch.id, "peer1", '{"key":"follow"}']]);
    ch.stop();
  });
});
