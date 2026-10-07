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

export interface FloorView {
  id: string;
  name: string;
  width: number;
  height: number;
  tables: TableView[];
  seats: SeatView[];
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
    { name: "Lantai 1", width: 20, height: 14, spawn: { x: 10, y: 12 } },
    { name: "Rooftop", width: 16, height: 10, spawn: { x: 1, y: 1 } },
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
    };
  });
}
