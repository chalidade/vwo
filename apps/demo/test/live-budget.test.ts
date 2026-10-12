import { describe, expect, it } from "vitest";
import { ChatLimit, nextShard, ShardBudget, shardRate } from "../src/live-budget";
import { decodeMove, encodeMove, KEY_CARRY_MS, motionAt, type MoveIntent, startMotion } from "../src/live-motion";
import { readConfig } from "../src/runtime-config";
import { simulate } from "./live-sim";

const counts = (o: Record<number, number>) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));

describe("floor channels (shards)", () => {
  it("joins the first channel with people and room, looking no further than needed", () => {
    expect(nextShard(counts({}), 10)).toEqual({ probe: 0 });
    expect(nextShard(counts({ 0: 4 }), 10)).toEqual({ pick: 0 });
    expect(nextShard(counts({ 0: 10 }), 10)).toEqual({ probe: 1 });
    expect(nextShard(counts({ 0: 10, 1: 3 }), 10)).toEqual({ pick: 1 });
    // An empty first channel: check the next one isn't where everyone is.
    expect(nextShard(counts({ 0: 0 }), 10)).toEqual({ probe: 1 });
    expect(nextShard(counts({ 0: 0, 1: 6 }), 10)).toEqual({ pick: 1 });
    expect(nextShard(counts({ 0: 0, 1: 0 }), 10)).toEqual({ pick: 0 });
    expect(nextShard(counts({ 0: 10, 1: 0, 2: 10 }), 10)).toEqual({ pick: 1 });
    // Every channel full: the emptiest takes one more rather than nobody seeing anyone.
    expect(nextShard(counts({ 0: 10, 1: 9 }), 9, -1, 2)).toEqual({ pick: 1 });
  });

  it("follows a friend into their channel when it has room", () => {
    expect(nextShard(counts({}), 10, 2)).toEqual({ probe: 2 });
    expect(nextShard(counts({ 2: 5 }), 10, 2)).toEqual({ pick: 2 });
    expect(nextShard(counts({ 2: 10 }), 10, 2)).toEqual({ probe: 0 });
  });
});

describe("message budget", () => {
  it("shares the plan's budget between everyone who may be online", () => {
    // 70 messages a second for 120 people: each channel may carry ~0.58 broadcasts a second.
    expect(shardRate(70, 120, 120)).toBeCloseTo(70 / 120);
    // A quiet fair gets more each, assuming a quarter more people than heard of, at least ten.
    expect(shardRate(70, 2, 120)).toBe(7);
    expect(shardRate(70, 40, 120)).toBe(1.4);
    // No cap set: still sized on the crowd.
    expect(shardRate(70, 400, 0)).toBe(0.14);
  });

  it("lets a channel's broadcasts through up to its allowance, fairly between senders", () => {
    const b = new ShardBudget(10_000, 400);
    const rate = 0.6; // six per ten seconds
    let t = 0;
    const sent: string[] = [];
    // Two players who would each send every half second.
    for (; t < 10_000; t += 500)
      for (const who of ["a", "b"])
        if (b.allow(who, t, rate)) {
          b.heard(who, t);
          sent.push(who);
        }
    expect(sent.length).toBe(6);
    expect(sent.filter((x) => x === "a").length).toBe(3);
    // A quiet moment refills it.
    expect(b.allow("a", 30_000, rate)).toBe(true);
  });

  it("keeps a lone player's sends a little apart, and spreads bursts over the window", () => {
    const b = new ShardBudget(10_000, 400);
    b.heard("a", 0);
    expect(b.allow("a", 200, 5)).toBe(false);
    expect(b.allow("a", 500, 5)).toBe(true);
    // At 0.6 a second, at most two in any one second.
    const c = new ShardBudget();
    c.heard("x", 0);
    c.heard("y", 100);
    expect(c.allow("z", 200, 0.6)).toBe(false);
    expect(c.allow("z", 1100, 0.6)).toBe(true);
  });

  it("caps chat bubbles per minute", () => {
    const c = new ChatLimit(2);
    expect([0, 1, 2].map((t) => c.allow(t))).toEqual([true, true, false]);
    expect(c.allow(60_001)).toBe(true);
  });

  it("reads the server's limits, falling back to defaults for anything odd", () => {
    expect(readConfig(null).live).toEqual({ enabled: true, maxConnections: 120, floorCap: 10, msgBudget: 70, heartbeatSec: 0, chatPerMin: 6 });
    expect(readConfig({ live: { enabled: false, floorCap: 1, msgBudget: "lots", maxConnections: 2500.4 } }).live).toMatchObject({
      enabled: false,
      floorCap: 2,
      msgBudget: 70,
      maxConnections: 2500,
    });
  });
});

describe("walking as intents", () => {
  const walk: MoveIntent = {
    x: 0,
    y: 0,
    facing: "front",
    path: [
      { x: 4, y: 0 },
      { x: 4, y: 3 },
    ],
    speed: 2,
    vel: null,
    seatId: "s-1",
  };

  it("round-trips an intent and rejects junk", () => {
    expect(decodeMove(JSON.parse(JSON.stringify(encodeMove(walk))))).toEqual(walk);
    expect(decodeMove({ k: "m", x: 1, y: 1, f: "up" })).toBeNull();
    expect(decodeMove({ k: "m", x: 1, y: 1, f: "front", p: [1, 2, 3] })).toBeNull();
    expect(decodeMove({ k: "m", x: 1, y: 1, f: "front", p: Array(60).fill(1), s: 2 })).toBeNull();
    expect(decodeMove({ k: "m", x: 1, y: 1, f: "front", v: [1e9, 0] })!.vel).toEqual({ x: 12, y: 0 });
    expect(decodeMove({ k: "m", x: 1, y: 1, f: "front", st: "../x" })!.seatId).toBeNull();
  });

  it("walks the route at the given speed, turning at corners, and sits at the end", () => {
    const m = startMotion({ x: 0, y: 0 }, walk, 1000);
    expect(motionAt(m, 1000)).toMatchObject({ x: 0, y: 0, done: false });
    expect(motionAt(m, 2000)).toMatchObject({ x: 2, y: 0, facing: "right", done: false });
    expect(motionAt(m, 3500)).toMatchObject({ x: 4, y: 1, facing: "front", done: false });
    expect(motionAt(m, 9000)).toEqual({ x: 4, y: 3, facing: "front", done: true, seatId: "s-1" });
  });

  it("walks on from where the player is drawn, and jumps only when far off", () => {
    const near = startMotion({ x: -1, y: 0 }, walk, 0);
    expect(motionAt(near, 500)).toMatchObject({ x: 0, y: 0 });
    const far = startMotion({ x: 30, y: 30 }, walk, 0);
    expect(far.from).toEqual({ x: 0, y: 0 });
  });

  it("carries a keys-steered player on for a moment only", () => {
    const keys: MoveIntent = { x: 5, y: 5, facing: "front", path: [], speed: 0, vel: { x: 2, y: 0 }, seatId: null };
    const m = startMotion({ x: 5, y: 5 }, keys, 0);
    expect(motionAt(m, 1000)).toMatchObject({ x: 7, y: 5, facing: "right", done: false });
    expect(motionAt(m, 60_000).x).toBe(5 + (2 * KEY_CARRY_MS) / 1000);
  });
});

describe("realtime budget, simulated (real LiveChannel, Supabase-style counting)", () => {
  const log = (name: string, r: Awaited<ReturnType<typeof simulate>>) => {
    if (process.env.MEASURE) console.log(name, JSON.stringify({ ...r, avg: +r.avg.toFixed(1), drift: +r.drift.toFixed(2) }));
  };

  it("keeps ~100 players, 40 on one floor, under Supabase Free's 100 messages/second and 200 connections", async () => {
    const r = await simulate({ users: 100, crowd: 40, floors: 8, idleMs: 8000, floorChange: 0.1, chatMs: 60_000, seconds: 60 });
    log("typical", r);
    expect(r.avg).toBeLessThan(85);
    expect(r.peakConnections).toBeLessThanOrEqual(100);
  }, 60_000);

  it("stays under the budget even when everyone walks and chats all the time", async () => {
    const r = await simulate({ users: 100, crowd: 40, floors: 8, idleMs: 0, floorChange: 0.1, chatMs: 10_000, seconds: 60 });
    log("busy", r);
    expect(r.avg).toBeLessThan(100);
  }, 60_000);

  it("plays walkers back almost exactly when the budget allows (a small group, or a bigger plan)", async () => {
    const small = await simulate({ users: 5, crowd: 5, floors: 8, idleMs: 3000, floorChange: 0, chatMs: 30_000, seconds: 60 });
    log("small", small);
    expect(small.drift).toBeLessThan(0.3);
    const pro = await simulate({
      users: 100,
      crowd: 40,
      floors: 8,
      idleMs: 8000,
      floorChange: 0.1,
      chatMs: 60_000,
      seconds: 60,
      config: { msgBudget: 2000, maxConnections: 1000, floorCap: 25 },
    });
    log("pro", pro);
    expect(pro.drift).toBeLessThan(0.5);
    expect(pro.avg).toBeLessThan(2000);
  }, 60_000);
});
