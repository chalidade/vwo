import { describe, expect, it } from "vitest";
import {
  atLobbyDoor,
  atParkDoor,
  buildJobFairFloors,
  buildParkFloor,
  cleanParkBuildings,
  DEMO_JOB_FAIR,
  entranceFloorId,
  fairStops,
  findPath,
  isBlocked,
  isParkFloor,
  LIFT_FRONT,
  lobbyDoorFront,
  PARK,
  PARK_MAX_BUILDINGS,
  parkFloorId,
  parkPlots,
  plotAt,
  plotFront,
  publicParkBuildings,
  type FloorView,
} from "../src";

/** Every walkable half-tile cell reached from `from`, walking the way findPath does (8 directions, no corner cutting). */
function reachable(floor: FloorView, from: { x: number; y: number }) {
  const cols = Math.ceil(floor.width / 0.5);
  const rows = Math.ceil(floor.height / 0.5);
  const open = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && !isBlocked(floor, (c + 0.5) * 0.5, (r + 0.5) * 0.5);
  const start = [Math.floor(from.x / 0.5), Math.floor(from.y / 0.5)] as const;
  const seen = new Set([start[1] * cols + start[0]]);
  const queue = [start];
  while (queue.length) {
    const [c, r] = queue.pop()!;
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++) {
        const k = (r + dr) * cols + c + dc;
        if ((!dc && !dr) || seen.has(k) || !open(c + dc, r + dr)) continue;
        if (dc && dr && (!open(c + dc, r) || !open(c, r + dr))) continue;
        seen.add(k);
        queue.push([c + dc, r + dr]);
      }
  }
  let walkable = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (open(c, r)) walkable++;
  return { seen, walkable };
}

describe("the park", () => {
  const park = buildParkFloor(DEMO_JOB_FAIR);

  it("is its own floor, about the size of a room, outside the lift", () => {
    expect(park.id).toBe(parkFloorId(DEMO_JOB_FAIR));
    expect(isParkFloor(park.id)).toBe(true);
    expect(isParkFloor(fairStops(DEMO_JOB_FAIR)[0]!.floorId)).toBe(false);
    expect(park.width * park.height).toBeLessThanOrEqual(DEMO_JOB_FAIR.width * DEMO_JOB_FAIR.height);
    expect(fairStops(DEMO_JOB_FAIR).some((st) => st.floorId === park.id)).toBe(false);
    expect(buildJobFairFloors(DEMO_JOB_FAIR).at(-1)!.id).toBe(park.id);
  });

  it("can be walked all over from the building's door: no cell is walled in", () => {
    expect(isBlocked(park, PARK.arrive.x, PARK.arrive.y)).toBe(false);
    expect(atParkDoor(PARK.arrive.x, PARK.arrive.y)).toBe(true);
    const { seen, walkable } = reachable(park, PARK.arrive);
    expect(walkable).toBeGreaterThan(2000);
    expect(seen.size).toBe(walkable);
  });

  it("reaches the front of every plot and every bench from the door", () => {
    PARK.plots.forEach((_, i) => {
      const at = plotFront(i);
      expect(isBlocked(park, at.x, at.y)).toBe(false);
      expect(plotAt(at.x, at.y)).toBe(i);
      expect(findPath(park, PARK.arrive, at)).not.toBeNull();
    });
    expect(park.seats).toHaveLength(PARK.benches.length * 2);
    for (const s of park.seats) expect(findPath(park, PARK.arrive, { x: s.x, y: s.y + 0.6 })).not.toBeNull();
    expect(plotAt(PARK.arrive.x, PARK.arrive.y)).toBe(-1);
  });

  it("has a door in the lobby, reachable from where people come in and from the lift", () => {
    const floors = buildJobFairFloors(DEMO_JOB_FAIR);
    const lobby = floors.find((f) => f.id === entranceFloorId(DEMO_JOB_FAIR))!;
    const doors = floors.flatMap((f) => (f.objects ?? []).filter((o) => o.targetFloorId === park.id).map((o) => ({ f, o })));
    expect(doors).toHaveLength(1);
    expect(doors[0]!.f.id).toBe(lobby.id);
    const front = lobbyDoorFront(lobby);
    expect(isBlocked(lobby, front.x, front.y)).toBe(false);
    expect(atLobbyDoor(lobby, front.x, front.y)).toBe(true);
    expect(findPath(lobby, DEMO_JOB_FAIR.spawn, front)).not.toBeNull();
    expect(findPath(lobby, LIFT_FRONT, front)).not.toBeNull();
  });

  it("moves the door with the entrance when the floor people come in on changes", () => {
    const noAula = { ...DEMO_JOB_FAIR, hallBase: 0, rooms: DEMO_JOB_FAIR.rooms.filter((r) => r.kind !== "aula").map((r) => ({ ...r, level: r.level })) };
    const floors = buildJobFairFloors(noAula);
    const lobby = floors.find((f) => f.id === entranceFloorId(noAula))!;
    expect(lobby.id).toBe(`${noAula.slug}-f1`);
    expect(lobby.objects!.some((o) => o.targetFloorId === parkFloorId(noAula))).toBe(true);
    const front = lobbyDoorFront(lobby);
    expect(findPath(lobby, LIFT_FRONT, front)).not.toBeNull();
  });
});

describe("the organiser's buildings", () => {
  it("are cleaned: trimmed, capped, no odd ids or duplicates, nothing without a name", () => {
    const raw = [
      { id: "fair-2027", name: "  Job Fair Maret  ", date: "Maret 2027", about: "x".repeat(500), status: "soon", secret: "drop me" },
      { id: "fair-2027", name: "Duplikat" },
      { id: "bad id!", name: "Id aneh" },
      { id: "kosong", name: "   " },
      { id: "tersembunyi", name: "Rapat internal", status: "hidden" },
      { id: "aneh", name: "Status aneh", status: "<script>" },
      "junk",
      null,
      { id: "baris", name: "Baris\nbaru\u0000" },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `extra-${i}`, name: `Extra ${i}` })),
    ];
    const list = cleanParkBuildings(raw);
    expect(list).toHaveLength(PARK_MAX_BUILDINGS);
    expect(list[0]).toEqual({ id: "fair-2027", name: "Job Fair Maret", date: "Maret 2027", about: "x".repeat(200), status: "soon" });
    expect(list.map((b) => b.id)).toEqual(["fair-2027", "tersembunyi", "aneh", "baris", "extra-0"]);
    expect(list[2]!.status).toBe("soon");
    expect(list[3]!.name).toBe("Baris baru");
    expect(cleanParkBuildings("nope")).toEqual([]);
    expect(cleanParkBuildings({ 0: { id: "a", name: "b" } })).toEqual([]);
    expect(cleanParkBuildings([{ id: "a", name: "b".repeat(80), date: 7 }])).toEqual([{ id: "a", name: "b".repeat(40), status: "soon" }]);
  });

  it("show only what is not hidden, filling the plots in list order", () => {
    const raw = [
      { id: "a", name: "A", status: "hidden", about: "rahasia" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    expect(publicParkBuildings(raw).map((b) => b.id)).toEqual(["b", "c"]);
    expect(JSON.stringify(publicParkBuildings(raw))).not.toContain("rahasia");
    const plots = parkPlots(cleanParkBuildings(raw));
    expect(plots).toHaveLength(PARK.plots.length);
    expect(plots.map((p) => p.building?.id ?? null)).toEqual(["b", "c", null, null, null]);
  });
});
