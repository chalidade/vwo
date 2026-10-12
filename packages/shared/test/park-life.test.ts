import { describe, expect, it } from "vitest";
import {
  ANOMALY_INFO,
  ANOMALY_KINDS,
  BENCH_W,
  DEMO_JOB_FAIR,
  PARK,
  PARK_LOOPS,
  PARK_NPC_MAX,
  PHONE_FRONT,
  PIGEON_FLOCKS,
  alongLoop,
  anomalyOutAt,
  atPhoneBox,
  benchSeat,
  buildParkFloor,
  darkness,
  dayPhase,
  findPath,
  isBlocked,
  lampsOn,
  parkNpcHello,
  parkNpcSeats,
  parkNpcsAt,
  pickAnomalyKind,
  scaredFlocks,
  wibMinute,
} from "../src";

/** A moment at hh:mm Jakarta time (WIB, UTC+7) on 12 Oct 2026. */
const wib = (h: number, m = 0, s = 0) => Date.UTC(2026, 9, 12, h - 7, m, s);

describe("the park's day and night (WIB)", () => {
  it("reads the clock in Jakarta", () => {
    expect(wibMinute(wib(0))).toBe(0);
    expect(wibMinute(wib(18, 30))).toBe(18 * 60 + 30);
    expect(wibMinute(Date.UTC(2026, 9, 12, 23, 59))).toBe(6 * 60 + 59);
  });

  it("changes phase exactly at 05.00, 06.00, 17.30 and 18.30", () => {
    expect(dayPhase(wib(4, 59, 59))).toBe("night");
    expect(dayPhase(wib(5))).toBe("dawn");
    expect(dayPhase(wib(5, 59, 59))).toBe("dawn");
    expect(dayPhase(wib(6))).toBe("day");
    expect(dayPhase(wib(12))).toBe("day");
    expect(dayPhase(wib(17, 29, 59))).toBe("day");
    expect(dayPhase(wib(17, 30))).toBe("dusk");
    expect(dayPhase(wib(18, 29, 59))).toBe("dusk");
    expect(dayPhase(wib(18, 30))).toBe("night");
    expect(dayPhase(wib(23, 59))).toBe("night");
    expect(dayPhase(wib(0))).toBe("night");
  });

  it("darkens over dusk and brightens over dawn, without jumps", () => {
    expect(darkness(wib(12))).toBe(0);
    expect(darkness(wib(17, 30))).toBe(0);
    expect(darkness(wib(18))).toBeCloseTo(0.5, 2);
    expect(darkness(wib(18, 30))).toBe(1);
    expect(darkness(wib(2))).toBe(1);
    expect(darkness(wib(5))).toBe(1);
    expect(darkness(wib(5, 30))).toBeCloseTo(0.5, 2);
    expect(darkness(wib(6))).toBe(0);
    for (let t = wib(17); t < wib(19); t += 60_000) expect(Math.abs(darkness(t + 60_000) - darkness(t))).toBeLessThan(0.02);
    expect(lampsOn(wib(12))).toBe(false);
    expect(lampsOn(wib(17, 45))).toBe(true);
    expect(lampsOn(wib(3))).toBe(true);
  });

  it("lets the park's day ones out by day and its ghosts only at night", () => {
    const night = ANOMALY_KINDS.filter((k) => ANOMALY_INFO[k].phase === "night");
    const day = ANOMALY_KINDS.filter((k) => ANOMALY_INFO[k].phase === "day");
    expect(night).toEqual(["kunti", "pocong", "lamp", "eyes"]);
    expect(day).toEqual(["squirrel", "kite", "fountaincat"]);
    for (const k of [...night, ...day]) expect(ANOMALY_INFO[k].place).toBe("park");
    for (const k of night) {
      expect(anomalyOutAt(k, wib(21))).toBe(true);
      expect(anomalyOutAt(k, wib(12))).toBe(false);
      expect(anomalyOutAt(k, wib(18))).toBe(false); // dusk is not night yet
    }
    for (const k of day) {
      expect(anomalyOutAt(k, wib(12))).toBe(true);
      expect(anomalyOutAt(k, wib(21))).toBe(false);
    }
    // Picked for a stay that runs into the morning: never a night one.
    for (let i = 0; i < 200; i++) expect(night).not.toContain(pickAnomalyKind(i / 200, wib(4, 58), wib(5, 0, 30)));
  });
});

describe("the park's people", () => {
  const park = buildParkFloor(DEMO_JOB_FAIR);

  it("are the same for everyone at the same moment, and few", () => {
    for (const t of [wib(9), wib(13, 7, 3), wib(21, 15), wib(2)]) {
      expect(parkNpcsAt(t)).toEqual(parkNpcsAt(t));
      expect(parkNpcsAt(t).length).toBeLessThanOrEqual(PARK_NPC_MAX);
      expect(new Set(parkNpcsAt(t).map((n) => n.id)).size).toBe(parkNpcsAt(t).length);
    }
    expect(parkNpcsAt(wib(10)).length).toBeGreaterThan(parkNpcsAt(wib(22)).length);
    expect(parkNpcsAt(wib(22)).some((n) => n.activity === "patrol")).toBe(true);
    expect(parkNpcsAt(wib(10)).some((n) => n.activity === "play")).toBe(true);
    expect(parkNpcsAt(wib(22)).some((n) => n.activity === "play")).toBe(false);
    for (const n of parkNpcsAt(wib(10))) expect(n.id.startsWith("park:")).toBe(true);
  });

  it("walk and stand only where a visitor could walk: never through a tree, a lamp or a building", () => {
    for (const loop of Object.values(PARK_LOOPS)) {
      const len = loop.reduce((n, a, i) => n + Math.hypot(loop[(i + 1) % loop.length]!.x - a.x, loop[(i + 1) % loop.length]!.y - a.y), 0);
      for (let d = 0; d < len; d += 0.2) {
        const p = alongLoop(loop, d);
        expect(isBlocked(park, p.x, p.y, 0.25), `${p.x.toFixed(1)},${p.y.toFixed(1)}`).toBe(false);
      }
    }
    for (let t = wib(0); t < wib(24); t += 37 * 60_000)
      for (const n of parkNpcsAt(t)) {
        if (n.seated) expect(park.seats.some((s) => Math.abs(s.x - n.x) < 0.01 && Math.abs(s.y - n.y) < 0.01)).toBe(true);
        else expect(isBlocked(park, n.x, n.y, 0.2), `${n.id} at ${n.x},${n.y}`).toBe(false);
      }
  });

  it("move along their loop as time passes and face where they go", () => {
    const a = parkNpcsAt(wib(10)).find((n) => n.id === "park:jogger")!;
    const b = parkNpcsAt(wib(10, 0, 2)).find((n) => n.id === "park:jogger")!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(3);
    expect(alongLoop(PARK_LOOPS.right, 1).facing).toBe("right");
    const dog = parkNpcsAt(wib(10)).find((n) => n.activity === "dog")!;
    expect(dog.pet).toBeDefined();
    expect(Math.hypot(dog.pet!.x - dog.x, dog.pet!.y - dog.y)).toBeLessThan(1.2);
  });

  it("stand beside the bench when a visitor already sits in their seat", () => {
    const [bench, side] = parkNpcSeats(wib(10))[0]!;
    const sitter = (t: number, taken: boolean) =>
      parkNpcsAt(t, (b, s) => taken && b === bench && s === side).find((n) => n.seated === undefined && Math.abs(n.y - (benchSeat(bench, side).y + 0.7)) < 0.01);
    expect(sitter(wib(10), false)).toBeUndefined();
    expect(sitter(wib(10), true)).toBeDefined();
    for (const [b] of parkNpcSeats(wib(10))) expect(b).toBeLessThan(PARK.benches.length);
    expect(BENCH_W).toBe(2);
  });

  it("talk now and then, and the two on the bench take turns", () => {
    const said = new Map<string, Set<string>>();
    for (let t = wib(10); t < wib(10, 10); t += 1000) for (const n of parkNpcsAt(t)) if (n.say) said.set(n.id, (said.get(n.id) ?? new Set()).add(n.say));
    expect(said.size).toBeGreaterThanOrEqual(8);
    expect(said.get("park:chat-a")?.size).toBeGreaterThan(1);
    expect(said.get("park:chat-b")?.size).toBeGreaterThan(1);
    // Never both at once.
    for (let t = wib(10); t < wib(10, 5); t += 500) {
      const pair = parkNpcsAt(t).filter((n) => n.activity === "chat" && n.say);
      expect(pair.length).toBeLessThanOrEqual(1);
    }
    expect(parkNpcHello("park:vendor", wib(21))).toMatch(/goreng/i);
    expect(parkNpcHello("park:chat-a", wib(10))).toBeTruthy();
  });

  it("leave pigeons alone until someone walks up", () => {
    const f = PIGEON_FLOCKS[0]!;
    expect(scaredFlocks(PARK.arrive.x, PARK.arrive.y).every((x) => !x)).toBe(true);
    expect(scaredFlocks(f.x + 1, f.y)[0]).toBe(true);
    for (const fl of PIGEON_FLOCKS) expect(isBlocked(park, fl.x, fl.y)).toBe(false);
  });
});

describe("the phone box", () => {
  const park = buildParkFloor(DEMO_JOB_FAIR);

  it("stands on the lawn, blocks, and can be walked up to from the door", () => {
    expect(isBlocked(park, PARK.phoneBox.x + 0.6, PARK.phoneBox.y + 0.4)).toBe(true);
    expect(isBlocked(park, PHONE_FRONT.x, PHONE_FRONT.y)).toBe(false);
    expect(atPhoneBox(PHONE_FRONT.x, PHONE_FRONT.y)).toBe(true);
    expect(atPhoneBox(PARK.arrive.x, PARK.arrive.y)).toBe(false);
    expect(findPath(park, PARK.arrive, PHONE_FRONT)).not.toBeNull();
  });

  it("leaves the cart, bikes, sign and playground reachable too", () => {
    const pg = PARK.playground;
    for (const at of [
      { x: PARK.cart.x + PARK.cart.width / 2, y: PARK.cart.y + PARK.cart.height + 0.6 },
      { x: PARK.bikes.x + 1, y: PARK.bikes.y + 1 },
      { x: PARK.signboard.x + 0.7, y: PARK.signboard.y - 0.6 },
      { x: pg.sandbox.x + pg.sandbox.width / 2, y: pg.sandbox.y + pg.sandbox.height / 2 },
    ]) {
      expect(isBlocked(park, at.x, at.y), JSON.stringify(at)).toBe(false);
      expect(findPath(park, PARK.arrive, at), JSON.stringify(at)).not.toBeNull();
    }
  });
});
