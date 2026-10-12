import { describe, expect, it } from "vitest";
import {
  atLobbyDoor,
  atParkDoor,
  buildJobFairFloors,
  buildParkFloor,
  cleanDateRange,
  cleanDay,
  cleanParkBuildings,
  formatDateRange,
  parkBuildingDate,
  readTypedDate,
  DEMO_JOB_FAIR,
  entranceFloorId,
  fairStops,
  findPath,
  isBlocked,
  isLibraryFloor,
  atLibraryBooks,
  atLibraryDoor,
  atLibraryExit,
  buildLibraryFloor,
  LIBRARY_ENTRY,
  LIBRARY_FRONT,
  LIBRARY_ROOM,
  libraryFloorId,
  librarySpot,
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
    expect(
      buildJobFairFloors(DEMO_JOB_FAIR)
        .map((f) => f.id)
        .slice(-2),
    ).toEqual([park.id, libraryFloorId(DEMO_JOB_FAIR)]);
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
    // One door from the lobby, and one out of the library's reading room.
    expect(doors.map((d) => d.f.id).sort()).toEqual([lobby.id, libraryFloorId(DEMO_JOB_FAIR)].sort());
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

describe("the library in the park", () => {
  const park = buildParkFloor(DEMO_JOB_FAIR);
  const room = buildLibraryFloor(DEMO_JOB_FAIR);

  it("is a building of its own in the park, not one of the organiser's plots", () => {
    expect(isBlocked(park, PARK.library.x + PARK.library.width / 2, PARK.library.y + PARK.library.height / 2)).toBe(true);
    PARK.plots.forEach((_, i) => {
      const f = plotFront(i);
      expect(atLibraryDoor(f.x, f.y)).toBe(false);
    });
    expect(plotAt(LIBRARY_FRONT.x, LIBRARY_FRONT.y)).toBe(-1);
  });

  it("has its door reachable from where people come into the park", () => {
    expect(isBlocked(park, LIBRARY_FRONT.x, LIBRARY_FRONT.y)).toBe(false);
    expect(atLibraryDoor(LIBRARY_FRONT.x, LIBRARY_FRONT.y)).toBe(true);
    expect(atLibraryDoor(PARK.arrive.x, PARK.arrive.y)).toBe(false);
    expect(findPath(park, PARK.arrive, LIBRARY_FRONT)).not.toBeNull();
  });

  it("has a reading room where the desk, every bookcase, every chair and the way out are reachable", () => {
    expect(isLibraryFloor(room.id)).toBe(true);
    expect(isLibraryFloor(park.id)).toBe(false);
    expect(room.width * room.height).toBeLessThan(park.width * park.height);
    expect(isBlocked(room, LIBRARY_ENTRY.x, LIBRARY_ENTRY.y)).toBe(false);
    expect(atLibraryExit(LIBRARY_ENTRY.x, LIBRARY_ENTRY.y)).toBe(true);
    const front = librarySpot("front");
    expect(atLibraryBooks(front.x, front.y)).toBe(true);
    expect(findPath(room, LIBRARY_ENTRY, front)).not.toBeNull();
    for (const s of [...LIBRARY_ROOM.backShelves, ...LIBRARY_ROOM.sideShelves]) {
      const at = { x: s.x + s.width / 2, y: s.y + s.height + 0.5 };
      expect(atLibraryBooks(at.x, at.y)).toBe(true);
      expect(findPath(room, LIBRARY_ENTRY, at)).not.toBeNull();
    }
    expect(room.seats).toHaveLength(LIBRARY_ROOM.tables.length * 4);
    for (const s of room.seats) expect(findPath(room, LIBRARY_ENTRY, { x: s.x, y: s.y }) ?? findPath(room, LIBRARY_ENTRY, { x: s.x, y: s.y + 0.6 })).not.toBeNull();
    const { seen, walkable } = reachable(room, LIBRARY_ENTRY);
    expect(seen.size).toBe(walkable);
  });

  it("opens back onto the park, right in front of its own door", () => {
    const door = room.objects!.find((o) => o.type === "door")!;
    expect(door.targetFloorId).toBe(park.id);
    expect({ x: door.targetX, y: door.targetY }).toEqual(LIBRARY_FRONT);
    expect(atLibraryBooks(LIBRARY_ENTRY.x, LIBRARY_ENTRY.y)).toBe(false);
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

describe("the buildings' dates", () => {
  it("keeps a picked range: real days, a sane year, the end after the start", () => {
    expect(cleanDay("2026-11-12")).toBe("2026-11-12");
    for (const bad of ["2026-02-30", "2026-13-01", "1999-12-31", "2101-01-01", "12-11-2026", "2026-1-5", 20261112, null]) expect(cleanDay(bad)).toBe("");
    expect(cleanDateRange("2026-11-12", "2026-11-14")).toEqual({ startDate: "2026-11-12", endDate: "2026-11-14" });
    expect(cleanDateRange("2026-11-12", "2026-11-12")).toEqual({ startDate: "2026-11-12" });
    expect(cleanDateRange("2026-11-12", "2026-11-10")).toEqual({ startDate: "2026-11-12" });
    expect(cleanDateRange("2026-11-12", "2028-01-01")).toEqual({ startDate: "2026-11-12" });
    expect(cleanDateRange("", "2026-11-14")).toEqual({ startDate: "2026-11-14" });
    expect(cleanDateRange("nope", "")).toBeNull();
  });

  it("stores the range in org.buildings, drops the old typed date once there is one, and keeps old typed dates", () => {
    const [a, b, c] = cleanParkBuildings([
      { id: "a", name: "A", startDate: "2026-11-12", endDate: "2026-11-14", date: "Maret 2027" },
      { id: "b", name: "B", date: "Maret 2027" },
      { id: "c", name: "C", startDate: "2026-02-30", endDate: "<script>", date: "x".repeat(90) },
    ]);
    expect(a).toEqual({ id: "a", name: "A", startDate: "2026-11-12", endDate: "2026-11-14", status: "soon" });
    expect(b).toEqual({ id: "b", name: "B", date: "Maret 2027", status: "soon" });
    expect(c).toEqual({ id: "c", name: "C", date: "x".repeat(40), status: "soon" });
    expect(parkBuildingDate(a!)).toBe("12–14 Nov 2026");
    expect(parkBuildingDate(b!)).toBe("Maret 2027");
    expect(parkBuildingDate({})).toBe("");
  });

  it("writes the range the Indonesian way", () => {
    expect(formatDateRange("2026-11-12")).toBe("12 Nov 2026");
    expect(formatDateRange("2026-11-12", "2026-11-14")).toBe("12–14 Nov 2026");
    expect(formatDateRange("2026-11-30", "2026-12-02")).toBe("30 Nov – 2 Des 2026");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 Des 2026 – 2 Jan 2027");
    expect(formatDateRange("2027-05-01", "2027-08-17")).toBe("1 Mei – 17 Agu 2027");
  });

  it("reads an old typed date into the calendar when it names days", () => {
    expect(readTypedDate("12 Nov 2026")).toEqual({ startDate: "2026-11-12" });
    expect(readTypedDate("12-14 November 2026")).toEqual({ startDate: "2026-11-12", endDate: "2026-11-14" });
    expect(readTypedDate("3–5 Agustus 2027")).toEqual({ startDate: "2027-08-03", endDate: "2027-08-05" });
    expect(readTypedDate("2027-03-01")).toEqual({ startDate: "2027-03-01" });
    expect(readTypedDate("Maret 2027")).toBeNull();
    expect(readTypedDate("31 Feb 2027")).toBeNull();
    expect(readTypedDate(undefined)).toBeNull();
  });
});
