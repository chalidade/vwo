import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveChannel, type LiveSelf, type Net } from "../src/live";
import { DEFAULT_CONFIG, type LiveConfig } from "../src/runtime-config";
import { memNet } from "./live-net";

const look = { skin: "#f1c27d" } as never;
const floors = new Set(["f1", "f2"]);

function player(net: Net, name: string, at: LiveSelf, config: Partial<LiveConfig> = {}, friends: string[] = []) {
  const seen = new Map<string, { floorId: string; x: number; y: number; seatId: string | null; say: string | null }>();
  const pings: unknown[] = [];
  const statuses: string[] = [];
  const self: LiveSelf = { ...at };
  const ch = new LiveChannel({
    room: "jobfair",
    self: () => self,
    onPeer: (p) => seen.set(p.id, { floorId: p.floorId, x: p.x, y: p.y, seatId: p.seatId, say: p.say ?? seen.get(p.id)?.say ?? null }),
    onGone: (id) => seen.delete(id),
    knownFloor: (id) => floors.has(id),
    onStatus: (s) => statuses.push(s),
    onDirect: (from, data) => pings.push({ from, data }),
    friends: () => friends,
    net,
    config: { ...DEFAULT_CONFIG.live, ...config },
  });
  Object.defineProperty(ch, "id", { value: name });
  ch.start();
  return { ch, self, seen, pings, statuses };
}

const at = (floorId: string, x = 5, extra: Partial<LiveSelf> = {}): LiveSelf => ({ name: "x", look, floorId, x, y: 5, facing: "front", seatId: null, say: null, ...extra });

type P = ReturnType<typeof player>;
/** Let `ms` pass, drawing frames like the game does. */
async function run(ms: number, ps: P[], step = 50) {
  for (let t = 0; t < ms; t += step) {
    for (const p of ps) p.ch.frame();
    await vi.advanceTimersByTimeAsync(step);
  }
}

describe("players online", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends a walk once and lets everyone on the floor play it back; other floors hear nothing", async () => {
    const { client, stats } = memNet();
    const a = player(client(), "aaa", at("f1"));
    const c = player(client(), "ccc", at("f1", 8));
    const d = player(client(), "ddd", at("f2"));
    await run(1500, [a, c, d]);
    expect(c.seen.get("aaa")).toMatchObject({ floorId: "f1", x: 5 });
    // Interest management: someone on another floor is not even known.
    expect(d.seen.has("aaa")).toBe(false);
    const before = stats.broadcast;
    a.self.route = [
      { x: 9, y: 5 },
      { x: 9, y: 8 },
    ];
    a.self.speed = 2;
    a.self.routeSeat = "seat-1";
    await run(1000, [a, c, d]);
    // Halfway along the first leg on the other screen, from one message.
    expect(c.seen.get("aaa")!.x).toBeGreaterThan(6.5);
    expect(c.seen.get("aaa")!.x).toBeLessThan(7.5);
    // The walker arrives and sits: nothing more to say, everyone already walks them there.
    a.self.route = null;
    a.self.x = 9;
    a.self.y = 8;
    a.self.seatId = "seat-1";
    await run(3000, [a, c, d]);
    expect(c.seen.get("aaa")).toMatchObject({ x: 9, y: 8, seatId: "seat-1" });
    expect(stats.broadcast - before).toBe(2); // one message, one receiver
    expect(d.seen.has("aaa")).toBe(false);
  });

  it("steers with the keys, stops, and follows a player to another floor", async () => {
    const { client } = memNet();
    const a = player(client(), "aaa", at("f1"));
    const d = player(client(), "ddd", at("f2"));
    await run(1500, [a, d]);
    a.self.vel = { x: 2, y: 0 };
    await run(1000, [a, d]);
    a.self.vel = null;
    a.self.x = 7;
    a.self.floorId = "f2";
    await run(3000, [a, d]);
    expect(d.seen.get("aaa")).toMatchObject({ floorId: "f2", x: 7 });
    a.self.vel = { x: 2, y: 0 };
    await run(500, [a, d]);
    expect(d.seen.get("aaa")!.x).toBeGreaterThan(7.4);
    a.self.vel = null;
    a.self.x = 8;
    await run(2000, [a, d]);
    expect(d.seen.get("aaa")!.x).toBeCloseTo(8, 5);
    // Closing the tab: presence says they left, no timeout needed.
    a.ch.stop();
    expect(d.seen.has("aaa")).toBe(false);
  });

  it("brings a newcomer up to date with one message from the longest-standing peer, not a reply from everyone", async () => {
    const { client, stats } = memNet();
    const crowd = ["p1", "p2", "p3", "p4", "p5"].map((n, i) => player(client(), n, at("f1", 2 + i)));
    await run(1500, crowd);
    crowd[2]!.self.route = [{ x: 20, y: 5 }];
    crowd[2]!.self.speed = 1;
    await run(1000, crowd);
    const directs = stats.direct;
    const broadcasts = stats.broadcast;
    const late = player(client(), "zz", at("f1", 1));
    await run(1500, [...crowd, late]);
    expect(stats.direct - directs).toBe(2); // one snapshot, sent and received
    expect(stats.broadcast - broadcasts).toBe(0);
    // It knows everyone, and sees the walker part-way along, not back where they set off.
    expect([...late.seen.keys()].sort()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(late.seen.get("p3")!.x).toBeGreaterThan(5.5);
  });

  it("splits a busy floor into channels of at most floorCap people", async () => {
    const { client } = memNet();
    const ps: P[] = [];
    for (let i = 0; i < 7; i++) {
      ps.push(player(client(), `p${i}`, at("f1", i), { floorCap: 3 }));
      await run(4000, ps);
    }
    const sizes = ps.map((p) => p.seen.size + 1);
    // 3 + 3 + 1: everyone sees only their own channel.
    expect(sizes.sort()).toEqual([1, 3, 3, 3, 3, 3, 3]);
    // Leaving frees a place, and the next newcomer takes it.
    ps[0]!.ch.stop();
    const n = player(client(), "new", at("f1"), { floorCap: 3 });
    await run(6000, [...ps.slice(1), n]);
    expect(n.seen.size).toBe(2);
  });

  it("sends quick messages to the receiver's inbox only", async () => {
    const { client, stats } = memNet();
    const a = player(client(), "aaa", at("f1"));
    const b = player(client(), "bbb", at("f1"));
    const c = player(client(), "ccc", at("f1"));
    await run(1500, [a, b, c]);
    const before = stats.direct;
    expect(a.ch.sendTo("bbb", { key: "hi" })).toBe(true);
    expect(b.pings).toEqual([{ from: "aaa", data: { key: "hi" } }]);
    expect(c.pings).toEqual([]);
    expect(stats.direct - before).toBe(2);
    // Strangers can't be messaged, and their messages are dropped.
    expect(a.ch.sendTo("nobody", { key: "hi" })).toBe(false);
  });

  it("plays solo when switched off, and when the fair is fuller than the cap", async () => {
    const { client, stats } = memNet();
    const off = player(client(), "off", at("f1"), { enabled: false });
    expect(off.statuses).toEqual(["solo"]);
    const a = player(client(), "aaa", at("f1"), { maxConnections: 2 });
    const b = player(client(), "bbb", at("f1"), { maxConnections: 2 });
    await run(4000, [a, b]);
    const c = player(client(), "ccc", at("f1"), { maxConnections: 2 });
    await run(4000, [a, b, c]);
    expect(c.statuses.at(-1)).toBe("full");
    expect(c.seen.size).toBe(0);
    expect(a.seen.has("ccc")).toBe(false);
    expect(stats.peakConnections).toBeLessThanOrEqual(3);
    expect(stats.connections).toBe(2);
  });

  it("tells friends which floor each other is on, through their inboxes", async () => {
    const { client } = memNet();
    const a = player(client(), "aaa", at("f1", 5, { tag: "aaaaaaaaaaaa" }), {}, ["bbbbbbbbbbbb"]);
    const b = player(client(), "bbb", at("f2", 5, { tag: "bbbbbbbbbbbb" }), {}, ["aaaaaaaaaaaa"]);
    const s = player(client(), "sss", at("f2", 5, { tag: "cccccccccccc" }));
    await run(5000, [a, b, s]);
    expect(a.seen.get("bbb")?.floorId).toBe("f2");
    expect(b.seen.get("aaa")?.floorId).toBe("f1");
    // A stranger on b's floor sees b (same channel) but never hears about a.
    expect(s.seen.has("bbb")).toBe(true);
    expect(s.seen.has("aaa")).toBe(false);
  });

  it("limits chat bubbles per minute and shares them with the floor", async () => {
    const { client } = memNet();
    const a = player(client(), "aaa", at("f1"), { chatPerMin: 2 });
    const b = player(client(), "bbb", at("f1"));
    await run(1500, [a, b]);
    const said: string[] = [];
    for (const t of ["Halo", "Apa kabar", "Spam"]) {
      a.self.say = t;
      await run(2000, [a, b]);
      said.push(b.seen.get("aaa")!.say ?? "");
      a.self.say = null;
      await run(200, [a, b]);
    }
    expect(said).toEqual(["Halo", "Apa kabar", "Apa kabar"]);
  });
});
