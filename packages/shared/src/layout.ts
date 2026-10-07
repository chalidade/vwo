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

  if (table.shape === "rect" && capacity >= 3) {
    // Long tables: one chair at each end, the rest split along the two long sides.
    const horizontal = table.width >= table.height;
    const ends = capacity >= 4 ? 2 : 0;
    const sideA = Math.ceil((capacity - ends) / 2);
    const sideB = capacity - ends - sideA;
    const along = (n: number, i: number) => (horizontal ? table.x + (table.width * (i + 0.5)) / n : table.y + (table.height * (i + 0.5)) / n);
    const out: Point[] = [];
    for (let i = 0; i < sideA; i++)
      out.push(horizontal ? { x: round(along(sideA, i)), y: round(table.y - gap), rotation: 0 } : { x: round(table.x + table.width + gap), y: round(along(sideA, i)), rotation: 90 });
    if (ends) out.push(horizontal ? { x: round(table.x + table.width + gap), y: round(cy), rotation: 90 } : { x: round(cx), y: round(table.y + table.height + gap), rotation: 180 });
    for (let i = sideB - 1; i >= 0; i--)
      out.push(horizontal ? { x: round(along(sideB, i)), y: round(table.y + table.height + gap), rotation: 180 } : { x: round(table.x - gap), y: round(along(sideB, i)), rotation: 270 });
    if (ends) out.push(horizontal ? { x: round(table.x - gap), y: round(cy), rotation: 270 } : { x: round(cx), y: round(table.y - gap), rotation: 0 });
    return out;
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
