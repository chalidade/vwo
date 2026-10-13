import { describe, expect, it } from "vitest";
import {
  DEMO_JOB_FAIR,
  LIBRARY_ENTRY,
  LIBRARY_NPC_MAX,
  LIBRARY_ROOM,
  atLibraryBooks,
  buildLibraryFloor,
  findPath,
  isBlocked,
  libraryNpcHello,
  libraryNpcSeats,
  libraryNpcsAt,
  librarySeat,
  librarySeatId,
  librarySpot,
  paceAt,
} from "../src";

const room = buildLibraryFloor(DEMO_JOB_FAIR);
/** Every few seconds over a day. */
const moments = Array.from({ length: 400 }, (_, i) => Date.UTC(2026, 9, 12) + i * 217_000);

describe("walking to and fro (paceAt)", () => {
  const a = { x: 2, y: 5 };
  const b = { x: 6, y: 5 };

  it("stands at each end facing the shelf, and walks between them facing the way it goes", () => {
    expect(paceAt(a, b, 1000, 100)).toEqual({ ...a, facing: "back", moving: false });
    expect(paceAt(a, b, 1000, 600)).toEqual({ ...b, facing: "back", moving: false });
    expect(paceAt(a, b, 1000, 420)).toMatchObject({ facing: "right", moving: true });
    expect(paceAt(a, b, 1000, 920)).toMatchObject({ facing: "left", moving: true });
    // Halfway through a walk, halfway there.
    expect(paceAt(a, b, 1000, 425).x).toBeCloseTo(4, 5);
  });

  it("never jumps: a step a frame stays small, starting and stopping included", () => {
    // Four tiles in a second and a half at most: about 0.07 a frame at the fastest, in the middle.
    for (let t = 0; t < 30_000; t += 16) {
      const p = paceAt(a, b, 10_000, t);
      const q = paceAt(a, b, 10_000, t + 16);
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThan(0.08);
    }
    // Eased: the first and last frames of a walk move less than the middle ones.
    const step = (t: number) => paceAt(a, b, 10_000, t + 16).x - paceAt(a, b, 10_000, t).x;
    expect(step(3510)).toBeLessThan(step(4240) / 10);
    expect(step(4980)).toBeLessThan(step(4240) / 10);
  });
});

describe("the reading room's people", () => {
  it("are the same for everyone at the same moment, few, and never visitors", () => {
    for (const t of moments.slice(0, 20)) {
      const npcs = libraryNpcsAt(t);
      expect(libraryNpcsAt(t)).toEqual(npcs);
      expect(npcs.length).toBe(LIBRARY_NPC_MAX);
      expect(new Set(npcs.map((n) => n.id)).size).toBe(npcs.length);
      for (const n of npcs) expect(n.id.startsWith("lib:")).toBe(true);
    }
  });

  it("sit on real chairs, and leave two whole tables and most chairs free", () => {
    const seats = libraryNpcSeats();
    for (const [t, k] of seats) expect(room.seats.some((s) => s.id === librarySeatId(room.id, t, k))).toBe(true);
    const used = new Set(seats.map(([t]) => t));
    expect(LIBRARY_ROOM.tables.length - used.size).toBeGreaterThanOrEqual(2);
    expect(room.seats.length - seats.length).toBeGreaterThanOrEqual(12);
    for (const n of libraryNpcsAt(moments[0]!).filter((n) => n.seated && n.activity !== "kid"))
      expect(room.seats.some((s) => Math.abs(s.x - n.x) < 0.01 && Math.abs(s.y - n.y) < 0.01)).toBe(true);
  });

  it("give up a chair a visitor took, standing beside the table where one can walk", () => {
    const [t, k] = libraryNpcSeats()[0]!;
    const npcs = libraryNpcsAt(moments[0]!, (tt, kk) => tt === t && kk === k);
    const chair = librarySeat(t, k);
    expect(npcs.some((n) => n.x === chair.x && n.y === chair.y)).toBe(false);
    for (const n of npcs.filter((n) => !n.seated)) expect(isBlocked(room, n.x, n.y, 0.2), n.id).toBe(false);
  });

  it("never block the librarian's desk, a bookcase, a free chair or the way from the door", () => {
    const desk = librarySpot("front");
    for (const t of moments) {
      const npcs = libraryNpcsAt(t);
      for (const n of npcs) {
        // Not where you stand to ask for a book, nor on the line from the door up to the desk.
        expect(Math.hypot(n.x - desk.x, n.y - desk.y), n.id).toBeGreaterThan(1.8);
        expect(Math.abs(n.x - LIBRARY_ENTRY.x) > 0.8 || n.y < desk.y, n.id).toBe(true);
        if (n.activity !== "kid" && !n.seated) expect(isBlocked(room, n.x, n.y, 0.2), `${n.id} ${n.x},${n.y}`).toBe(false);
      }
      // In front of every bookcase there is still a spot a tile clear of everyone, and it can be walked to.
      for (const s of [...LIBRARY_ROOM.backShelves, ...LIBRARY_ROOM.sideShelves]) {
        const spots = Array.from({ length: 9 }, (_, i) => ({ x: s.x + 0.4 + (i * (s.width - 0.8)) / 8, y: s.y + s.height + 0.6 }));
        const free = spots.filter((p) => atLibraryBooks(p.x, p.y) && npcs.every((n) => Math.hypot(n.x - p.x, n.y - p.y) > 1));
        expect(free.length, `shelf at ${s.x},${s.y}`).toBeGreaterThan(0);
      }
    }
    for (const s of [...LIBRARY_ROOM.backShelves, ...LIBRARY_ROOM.sideShelves]) {
      const front = { x: s.x + s.width - 0.6, y: s.y + s.height + 0.6 };
      expect(findPath(room, LIBRARY_ENTRY, front), `${s.x},${s.y}`).not.toBeNull();
    }
    // Every chair the people leave free can be walked up to from the door, the beanbag in the corner notwithstanding.
    const taken = new Set(libraryNpcSeats().map(([t, k]) => librarySeatId(room.id, t, k)));
    for (const s of room.seats.filter((s) => !taken.has(s.id))) expect(findPath(room, LIBRARY_ENTRY, s), s.id).not.toBeNull();
    expect(findPath(room, LIBRARY_ENTRY, librarySpot("front"))).not.toBeNull();
  });

  it("whisper now and then, and say something when tapped", () => {
    const said = moments.flatMap((t) => libraryNpcsAt(t).filter((n) => n.say));
    expect(said.length).toBeGreaterThan(0);
    // Mostly quiet: it is a library.
    expect(said.length).toBeLessThan(moments.length * LIBRARY_NPC_MAX * 0.3);
    for (const n of libraryNpcsAt(moments[0]!)) expect(libraryNpcHello(n.id, moments[0]!).length).toBeGreaterThan(0);
    expect(libraryNpcHello("lib:nobody", 0)).toContain("Ssst");
  });
});
