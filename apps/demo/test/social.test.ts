import { describe, expect, it, vi } from "vitest";
import { PING_TEXT, PingLimiter, parsePing } from "../src/fair/social";
import { LiveChannel } from "../src/live";
import { memNet } from "./live-net";

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
    vi.useFakeTimers();
    const { client } = memNet();
    const got: [string, unknown][] = [];
    const net = client();
    const ch = new LiveChannel({
      room: "r",
      self: () => ({ name: "Me", look: {} as never, floorId: "f", x: 1, y: 1, facing: "front", seatId: null, say: null }),
      onPeer: () => {},
      onGone: () => {},
      knownFloor: () => true,
      onStatus: () => {},
      onDirect: (from, data) => got.push([from, data]),
      net,
    });
    ch.start();
    const other = client();
    // A stranger writing to our inbox is ignored, and can't be written to.
    other.direct(`peer:${ch.id}`, "stranger", JSON.stringify({ k: "dm", d: { key: "hi" } }));
    expect(got).toEqual([]);
    expect(ch.sendTo("peer1", { key: "hi" })).toBe(false);
    // Once they are on our floor channel, they can.
    for (let i = 0; i < 30; i++) {
      ch.frame();
      await vi.advanceTimersByTimeAsync(100);
    }
    const room = other.join("r~f~s0", "peer1", { status: () => {}, message: () => {}, roster: () => {} }, true);
    room.track(JSON.stringify({ v: 1, id: "peer1", name: "Sari", look: {}, floorId: "f", x: 1, y: 1, facing: "front", seatId: null }));
    await vi.advanceTimersByTimeAsync(10);
    const mine: string[] = [];
    other.inbox("peer:peer1", (_from, text) => mine.push(text));
    other.direct(`peer:${ch.id}`, "peer1", JSON.stringify({ k: "dm", d: { key: "hi" } }));
    other.direct(`peer:${ch.id}`, "peer1", "not json");
    expect(got).toEqual([["peer1", { key: "hi" }]]);
    expect(ch.sendTo("peer1", { key: "follow" })).toBe(true);
    expect(mine).toEqual(['{"k":"dm","d":{"key":"follow"}}']);
    ch.stop();
    vi.useRealTimers();
  });
});
