// Geometry helpers shared by the seed, the map editor and the world renderer.
// Coordinates are in tiles relative to the floor's top-left corner.

export interface TableRect {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "round" | "square" | "rect" | "bar";
}

export interface Point {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Place `capacity` chairs evenly around a table. Used when an admin sets a table's capacity:
 * the editor creates this many seats, which can then be dragged individually.
 * Rotation is in degrees and points the chair toward the table centre.
 */
export function seatPositionsAround(table: TableRect, capacity: number, gap = 0.6): Point[] {
  if (capacity <= 0) return [];
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;

  if (table.shape === "bar") {
    // Bar: chairs in a row along the long side, facing the bar.
    const step = table.width / capacity;
    return Array.from({ length: capacity }, (_, i) => ({
      x: round(table.x + step * (i + 0.5)),
      y: round(table.y + table.height + gap),
      rotation: 0,
    }));
  }

  const rx = table.width / 2 + gap;
  const ry = table.height / 2 + gap;
  return Array.from({ length: capacity }, (_, i) => {
    const angle = (2 * Math.PI * i) / capacity - Math.PI / 2;
    return {
      x: round(cx + rx * Math.cos(angle)),
      y: round(cy + ry * Math.sin(angle)),
      rotation: Math.round(((angle * 180) / Math.PI + 90 + 360) % 360),
    };
  });
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
