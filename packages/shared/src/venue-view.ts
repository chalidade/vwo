// Plain layout shapes for rendering a floor, independent of the database layer.
// getVenueLayout() in @vwo/db returns objects that satisfy these types.
import { seatPositionsAround } from "./layout";

export interface TableView {
  id: string;
  label: string;
  shape: "round" | "square" | "rect" | "bar";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface SeatView {
  id: string;
  label: string;
  tableId: string | null;
  x: number;
  y: number;
  isActive: boolean;
}

export type MapObjectType = "wall" | "counter" | "door" | "decor" | "spawn_point" | "blocked" | "stairs" | "elevator";

export interface MapObjectView {
  id: string;
  type: MapObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which drawing to use for decor: plant, shelf, sofa, rug, lamp, ... */
  spriteKey: string | null;
  isWalkable: boolean;
  targetFloorId: string | null;
  targetX: number | null;
  targetY: number | null;
}

/** How a floor is drawn: an indoor room with walls, or an open rooftop deck. */
export type FloorTheme = "indoor" | "rooftop" | "hall";

export interface FloorView {
  id: string;
  name: string;
  width: number;
  height: number;
  tables: TableView[];
  seats: SeatView[];
  objects?: MapObjectView[];
  theme?: FloorTheme;
}

export interface ObjectSpec {
  floor: number;
  type: MapObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  spriteKey?: string;
  isWalkable?: boolean;
  target?: { floor: number; x: number; y: number };
}

export interface TableSpec {
  floor: number;
  label: string;
  shape: TableView["shape"];
  x: number;
  y: number;
  width: number;
  height: number;
  capacity: number;
}

/** The "cafe-a" demo venue. Used by the database seed and by the static GitHub Pages demo. */
export const DEMO_VENUE = {
  slug: "cafe-a",
  name: "Cafe A",
  floors: [
    { name: "Lantai 1", width: 20, height: 14, spawn: { x: 10, y: 12.6 }, theme: "indoor" },
    { name: "Rooftop", width: 16, height: 10, spawn: { x: 1.8, y: 2 }, theme: "rooftop" },
  ],
  tables: [
    { floor: 0, label: "M-01", shape: "square", x: 3, y: 5, width: 2, height: 2, capacity: 4 },
    { floor: 0, label: "M-02", shape: "square", x: 8, y: 5, width: 2, height: 2, capacity: 4 },
    { floor: 0, label: "M-03", shape: "round", x: 13, y: 5, width: 2, height: 2, capacity: 2 },
    { floor: 0, label: "M-04", shape: "rect", x: 4, y: 9, width: 4, height: 2, capacity: 6 },
    { floor: 0, label: "BAR", shape: "bar", x: 12, y: 9, width: 5, height: 1, capacity: 4 },
    { floor: 1, label: "R-01", shape: "round", x: 4, y: 4, width: 2, height: 2, capacity: 4 },
    { floor: 1, label: "R-02", shape: "rect", x: 9, y: 4, width: 4, height: 2, capacity: 6 },
  ] satisfies TableSpec[],
  objects: [
    { floor: 0, type: "door", x: 9, y: 13, width: 2, height: 1, isWalkable: true },
    { floor: 0, type: "spawn_point", x: 10, y: 12.6, width: 1, height: 1, isWalkable: true },
    { floor: 0, type: "counter", x: 1, y: 1, width: 6, height: 1 },
    { floor: 0, type: "stairs", x: 18, y: 0.2, width: 1.6, height: 2.2, isWalkable: true, target: { floor: 1, x: 1.8, y: 2 } },
    { floor: 0, type: "decor", spriteKey: "shelf", x: 8.4, y: 0, width: 2.2, height: 0.8 },
    { floor: 0, type: "decor", spriteKey: "plant", x: 0.2, y: 12.2, width: 1, height: 1 },
    { floor: 0, type: "decor", spriteKey: "plant", x: 18.8, y: 12.2, width: 1, height: 1 },
    { floor: 0, type: "decor", spriteKey: "plant-big", x: 16.6, y: 0.2, width: 1.2, height: 1 },
    { floor: 0, type: "decor", spriteKey: "sofa", x: 0.2, y: 4.8, width: 1, height: 2.4 },
    { floor: 0, type: "decor", spriteKey: "rug", x: 7.6, y: 11.6, width: 4.8, height: 1.8, isWalkable: true },
    { floor: 1, type: "stairs", x: 0, y: 0.2, width: 1.4, height: 1.6, isWalkable: true, target: { floor: 0, x: 18.8, y: 3 } },
    { floor: 1, type: "decor", spriteKey: "plant-big", x: 14.6, y: 0.2, width: 1.2, height: 1 },
    { floor: 1, type: "decor", spriteKey: "plant", x: 14.8, y: 8.8, width: 1, height: 1 },
    { floor: 1, type: "decor", spriteKey: "plant", x: 0.2, y: 8.8, width: 1, height: 1 },
    { floor: 1, type: "decor", spriteKey: "lamp", x: 7, y: 8.6, width: 0.8, height: 0.8 },
  ] satisfies ObjectSpec[],
} as const;

/** Seat label for the i-th chair of a table: M-01-A, M-01-B, ... */
export const seatLabel = (tableLabel: string, i: number) => `${tableLabel}-${String.fromCharCode(65 + i)}`;

/** Build in-memory floor views (ids derived from labels) for the demo venue. */
export function buildDemoFloors(): FloorView[] {
  return DEMO_VENUE.floors.map((f, floorIndex) => {
    const id = `floor-${floorIndex + 1}`;
    const specs = DEMO_VENUE.tables.filter((t) => t.floor === floorIndex);
    return {
      id,
      name: f.name,
      width: f.width,
      height: f.height,
      tables: specs.map((t) => ({ id: t.label, label: t.label, shape: t.shape, x: t.x, y: t.y, width: t.width, height: t.height, rotation: 0 })),
      seats: specs.flatMap((t) =>
        seatPositionsAround(t, t.capacity).map((p, i) => ({ id: seatLabel(t.label, i), label: seatLabel(t.label, i), tableId: t.label, x: p.x, y: p.y, isActive: true })),
      ),
      theme: f.theme,
      objects: DEMO_VENUE.objects
        .filter((o) => o.floor === floorIndex)
        .map((o: ObjectSpec, i): MapObjectView => ({
          id: `${id}-obj-${i}`,
          type: o.type,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          spriteKey: o.spriteKey ?? null,
          isWalkable: o.isWalkable ?? false,
          targetFloorId: o.target ? `floor-${o.target.floor + 1}` : null,
          targetX: o.target?.x ?? null,
          targetY: o.target?.y ?? null,
        })),
    };
  });
}
