// A crowd of simulated players on the in-memory realtime service, running the real LiveChannel:
// how many messages a second Supabase would count, how many connections, and how far off the
// others' screens draw each walker. Seeded, so every run gives the same numbers.
import { vi } from "vitest";
import { LiveChannel, type LiveSelf } from "../src/live";
import type { Pt } from "../src/live-motion";
import { DEFAULT_CONFIG, type LiveConfig } from "../src/runtime-config";
import { memNet } from "./live-net";

export interface SimOptions {
  users: number;
  /** How many of them are on the first floor (the rest spread over the others). */
  crowd: number;
  floors: number;
  /** Average pause between walks (ms); 0 walks all the time. */
  idleMs: number;
  /** Chance a walk starts by taking the lift to another floor. */
  floorChange: number;
  /** Average time between one player's speech bubbles (ms); 0 for none. */
  chatMs: number;
  /** Measured after everyone has arrived. */
  seconds: number;
  config?: Partial<LiveConfig>;
  seed?: number;
  /** Everyone arrives within this long (ms, default 20 s). */
  arriveMs?: number;
}

export interface SimResult {
  /** Messages a second, on average and in the busiest second. */
  avg: number;
  /** Messages a second while everyone arrives. */
  arrival: number;
  peak: number;
  byKind: { broadcast: number; presence: number; direct: number };
  peakConnections: number;
  /** Average distance (tiles) between where a walker is and where others draw them. */
  drift: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP = 100;
const WALK = 3.2;

export async function simulate(o: SimOptions): Promise<SimResult> {
  vi.useFakeTimers();
  const rand = rng(o.seed ?? 7);
  const { client, stats } = memNet();
  const floors = Array.from({ length: o.floors }, (_, i) => `f${i + 1}`);
  const known = new Set(floors);
  const config = { ...DEFAULT_CONFIG.live, ...o.config };
  const pickFloor = (i: number) => (i < o.crowd ? floors[0]! : floors[1 + ((i - o.crowd) % (o.floors - 1))]!);
  const randomFloor = () => (rand() < o.crowd / o.users ? floors[0]! : floors[1 + Math.floor(rand() * (o.floors - 1))]!);
  const exp = (mean: number) => (mean ? -Math.log(1 - rand()) * mean : 0);

  interface Sim {
    self: LiveSelf;
    ch: LiveChannel;
    seen: Map<string, Pt & { floorId: string }>;
    idleUntil: number;
    sayUntil: number;
    nextSay: number;
  }
  const sims: Sim[] = [];
  const join = (i: number) => {
    const self: LiveSelf = {
      name: `P${i}`,
      look: {} as never,
      floorId: pickFloor(i),
      x: 2 + rand() * 28,
      y: 2 + rand() * 18,
      facing: "front",
      seatId: null,
      say: null,
      route: null,
      speed: WALK,
    };
    const seen = new Map<string, Pt & { floorId: string }>();
    const ch = new LiveChannel({
      room: "jobfair",
      self: () => self,
      onPeer: (p) => seen.set(p.id, { x: p.x, y: p.y, floorId: p.floorId }),
      onGone: (id) => seen.delete(id),
      knownFloor: (id) => known.has(id),
      onStatus: () => {},
      net: client(),
      config,
    });
    Object.defineProperty(ch, "id", { value: `p${i}` });
    ch.start();
    sims.push({ self, ch, seen, idleUntil: Date.now() + exp(o.idleMs), sayUntil: 0, nextSay: Date.now() + exp(o.chatMs) });
  };

  const step = (now: number) => {
    for (const s of sims) {
      const me = s.self;
      if (me.route?.length) {
        let left = (WALK * STEP) / 1000;
        while (left > 0 && me.route.length) {
          const t = me.route[0]!;
          const d = Math.hypot(t.x - me.x, t.y - me.y);
          if (d <= left) {
            me.x = t.x;
            me.y = t.y;
            me.route.shift();
            left -= d;
          } else {
            me.x += ((t.x - me.x) * left) / d;
            me.y += ((t.y - me.y) * left) / d;
            left = 0;
          }
        }
        if (!me.route.length) {
          me.route = null;
          s.idleUntil = now + exp(o.idleMs);
        }
      } else if (now >= s.idleUntil) {
        if (rand() < o.floorChange) {
          const f = randomFloor();
          if (f !== me.floorId) {
            me.floorId = f;
            me.x = 2;
            me.y = 2;
          }
        }
        me.route = Array.from({ length: 3 }, () => ({ x: 1 + Math.round(rand() * 290) / 10, y: 1 + Math.round(rand() * 190) / 10 }));
      }
      if (o.chatMs && now >= s.nextSay) {
        me.say = `Halo ${Math.floor(rand() * 1000)}`;
        s.sayUntil = now + 3000;
        s.nextSay = now + exp(o.chatMs);
      } else if (now >= s.sayUntil) me.say = null;
      s.ch.frame();
    }
  };

  const start = Date.now();
  // Everyone arrives over the first 20 seconds (or as asked), then a settling period.
  const arriveMs = o.arriveMs ?? 20_000;
  let arrived = 0;
  for (let t = 0; t < arriveMs + 10_000; t += STEP) {
    if (t === arriveMs) arrived = stats.total;
    while (sims.length < o.users && sims.length < ((t + STEP) / arriveMs) * o.users) join(sims.length);
    step(start + t);
    await vi.advanceTimersByTimeAsync(STEP);
  }
  const from = Math.ceil(Date.now() / 1000);
  const base = { total: stats.total, broadcast: stats.broadcast, presence: stats.presence, direct: stats.direct };
  let drift = 0;
  let samples = 0;
  for (let t = 0; t < o.seconds * 1000; t += STEP) {
    step(Date.now());
    await vi.advanceTimersByTimeAsync(STEP);
    if (t % 1000 === 0)
      for (const s of sims)
        for (const [id, at] of s.seen) {
          const other = sims[Number(id.slice(1))]!.self;
          if (other.floorId !== at.floorId) continue;
          drift += Math.hypot(other.x - at.x, other.y - at.y);
          samples++;
        }
  }
  const to = Math.floor(Date.now() / 1000);
  let peak = 0;
  for (const [sec, n] of stats.perSecond) if (sec >= from && sec < to) peak = Math.max(peak, n);
  const result: SimResult = {
    avg: (stats.total - base.total) / o.seconds,
    arrival: arrived / (arriveMs / 1000),
    peak,
    byKind: { broadcast: (stats.broadcast - base.broadcast) / o.seconds, presence: (stats.presence - base.presence) / o.seconds, direct: (stats.direct - base.direct) / o.seconds },
    peakConnections: stats.peakConnections,
    drift: samples ? drift / samples : 0,
  };
  for (const s of sims) s.ch.stop();
  vi.useRealTimers();
  return result;
}
