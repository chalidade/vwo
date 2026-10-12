// Inside the Perpustakaan in the park: a small reading room with bookcases along the back wall and
// down both sides, the librarian's desk at the back, reading tables in the middle, and the door out
// to the park in the bottom wall. Coordinates are tiles, like the halls.
import { LIBRARY_FRONT, parkFloorId } from "./park";
import type { FloorView, MapObjectView, SeatView, TableView } from "./venue-view";

type Box = { x: number; y: number; width: number; height: number };

export const LIBRARY_ROOM = {
  width: 26,
  height: 14,
  /** Bookcases against the back wall, either side of the librarian's desk. */
  backShelves: [
    { x: 0.8, y: 0.2, width: 4.2, height: 0.7 },
    { x: 5.4, y: 0.2, width: 4.2, height: 0.7 },
    { x: 16.4, y: 0.2, width: 4.2, height: 0.7 },
    { x: 21, y: 0.2, width: 4.2, height: 0.7 },
  ],
  /** Free-standing bookcases down both sides. */
  sideShelves: [
    { x: 1.2, y: 5.2, width: 4.4, height: 0.7 },
    { x: 1.2, y: 8.8, width: 4.4, height: 0.7 },
    { x: 20.4, y: 5.2, width: 4.4, height: 0.7 },
    { x: 20.4, y: 8.8, width: 4.4, height: 0.7 },
  ],
  desk: { x: 11, y: 2.2, width: 4, height: 0.8 },
  /** Reading tables, four chairs each. */
  tables: [
    { x: 8.4, y: 6, width: 3.2, height: 1.1 },
    { x: 14.4, y: 6, width: 3.2, height: 1.1 },
    { x: 8.4, y: 9.4, width: 3.2, height: 1.1 },
    { x: 14.4, y: 9.4, width: 3.2, height: 1.1 },
  ],
  /** The door out to the park, in the bottom wall. */
  door: { x: 12, y: 13, width: 2, height: 1 },
} as const;

export const libraryFloorId = (fair: { slug: string }) => `${fair.slug}-perpustakaan`;
export const isLibraryFloor = (floorId: string) => floorId.endsWith("-perpustakaan");

/** Where you step in from the park, and where you stand to go back out. */
export const LIBRARY_ENTRY = { x: 13, y: 12.4 };

/** Where the librarian stands behind the desk, and where a visitor stands to talk to them. */
export function librarySpot(spot: "librarian" | "front") {
  const d = LIBRARY_ROOM.desk;
  return spot === "librarian" ? { x: d.x + d.width / 2, y: d.y - 0.55 } : { x: d.x + d.width / 2, y: d.y + d.height + 0.7 };
}

const shelves = (): readonly Box[] => [...LIBRARY_ROOM.backShelves, ...LIBRARY_ROOM.sideShelves];

/** Standing at the librarian's desk or in front of a bookcase: the books are within reach. */
export function atLibraryBooks(x: number, y: number) {
  const f = librarySpot("front");
  if (Math.abs(x - f.x) < 1.8 && Math.abs(y - f.y) < 0.9) return true;
  return shelves().some((s) => x > s.x - 0.2 && x < s.x + s.width + 0.2 && y > s.y + s.height && y < s.y + s.height + 1.2);
}

/** Standing at the door, to go back out to the park. */
export function atLibraryExit(x: number, y: number) {
  return Math.abs(x - LIBRARY_ENTRY.x) < 1.4 && y > LIBRARY_ROOM.height - 1.9;
}

/** The reading room as a floor: bookcases and the desk block, the tables have chairs, the door leads
 *  out to the front of the library in the park. */
export function buildLibraryFloor(fair: { slug: string }): FloorView {
  const id = libraryFloorId(fair);
  const L = LIBRARY_ROOM;
  const objects: MapObjectView[] = [...shelves(), L.desk].map((b, i) => ({
    id: `${id}-obj-${i}`,
    type: "blocked",
    ...b,
    spriteKey: "invisible",
    isWalkable: false,
    targetFloorId: null,
    targetX: null,
    targetY: null,
  }));
  objects.push({ id: `${id}-door`, type: "door", ...L.door, spriteKey: null, isWalkable: true, targetFloorId: parkFloorId(fair), targetX: LIBRARY_FRONT.x, targetY: LIBRARY_FRONT.y });
  for (const [k, o] of [
    ["plant-a", { x: 0.3, y: L.height - 1.4, width: 1.2, height: 1 }],
    ["plant-b", { x: L.width - 1.5, y: L.height - 1.4, width: 1.2, height: 1 }],
  ] as const)
    objects.push({ id: `${id}-${k}`, type: "decor", ...o, spriteKey: "plant-big", isWalkable: false, targetFloorId: null, targetX: null, targetY: null });
  const tables: TableView[] = [];
  const seats: SeatView[] = [];
  L.tables.forEach((t, i) => {
    const table: TableView = { id: `${id}-meja${i + 1}`, label: `Meja ${i + 1}`, shape: "rect", ...t, rotation: 0 };
    tables.push(table);
    [
      [t.x + 0.8, t.y - 0.35],
      [t.x + t.width - 0.8, t.y - 0.35],
      [t.x + 0.8, t.y + t.height + 0.35],
      [t.x + t.width - 0.8, t.y + t.height + 0.35],
    ].forEach(([x, y], k) => seats.push({ id: `${table.id}-${"ABCD"[k]}`, label: `Meja ${i + 1}${"ABCD"[k]}`, tableId: table.id, x: x!, y: y!, isActive: true }));
  });
  return { id, name: "Perpustakaan", width: L.width, height: L.height, tables, seats, objects, theme: "indoor" };
}
