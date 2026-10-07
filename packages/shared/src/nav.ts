// Walking around a floor: what blocks movement, sliding collision, and grid A* paths.
// Shared by the world client (player movement, click-to-walk) and the demo bots.
import type { FloorView, MapObjectView } from "./venue-view";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Radius of a walking character, in tiles. */
export const WALKER_RADIUS = 0.3;

/** Tables and solid map objects. Seats are not obstacles: you walk onto a chair to sit. */
export function obstaclesOf(floor: FloorView): Rect[] {
  const solid = (o: MapObjectView) => !o.isWalkable && o.type !== "spawn_point";
  return [...floor.tables, ...(floor.objects ?? []).filter(solid)];
}

function inside(r: Rect, x: number, y: number, pad: number) {
  return x > r.x - pad && x < r.x + r.width + pad && y > r.y - pad && y < r.y + r.height + pad;
}

export function isBlocked(floor: FloorView, x: number, y: number, radius = WALKER_RADIUS, obstacles = obstaclesOf(floor)) {
  if (x < radius || y < radius || x > floor.width - radius || y > floor.height - radius) return true;
  return obstacles.some((r) => inside(r, x, y, radius));
}

/**
 * Move from (x, y) by (dx, dy), sliding along walls and furniture instead of stopping dead.
 * A walker that is already inside an obstacle (e.g. standing up from a chair) may move freely
 * until it is out.
 */
export function slide(floor: FloorView, x: number, y: number, dx: number, dy: number, radius = WALKER_RADIUS) {
  const obstacles = obstaclesOf(floor);
  const blocked = (px: number, py: number) => isBlocked(floor, px, py, radius, obstacles);
  if (blocked(x, y)) return clampTo(floor, x + dx, y + dy, radius);
  if (!blocked(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  if (!blocked(x + dx, y)) return { x: x + dx, y };
  if (!blocked(x, y + dy)) return { x, y: y + dy };
  return { x, y };
}

function clampTo(floor: FloorView, x: number, y: number, r: number) {
  return { x: Math.min(Math.max(x, r), floor.width - r), y: Math.min(Math.max(y, r), floor.height - r) };
}

const CELL = 0.5;

/**
 * Shortest walkable path on a half-tile grid (8 directions, no corner cutting).
 * The start and goal may sit inside furniture (a chair next to a table); the path leaves
 * and enters them directly. Returns waypoints after `from`, ending exactly at `to`,
 * or null when there is no way through.
 */
export function findPath(floor: FloorView, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cols = Math.ceil(floor.width / CELL);
  const rows = Math.ceil(floor.height / CELL);
  const obstacles = obstaclesOf(floor);
  const cellOf = (p: { x: number; y: number }) => ({
    c: Math.min(cols - 1, Math.max(0, Math.floor(p.x / CELL))),
    r: Math.min(rows - 1, Math.max(0, Math.floor(p.y / CELL))),
  });
  const start = cellOf(from);
  const goal = cellOf(to);
  const key = (c: number, r: number) => r * cols + c;
  const startKey = key(start.c, start.r);
  const goalKey = key(goal.c, goal.r);
  const free = new Map<number, boolean>();
  const open = (c: number, r: number) => {
    const k = key(c, r);
    if (k === startKey || k === goalKey) return true;
    let v = free.get(k);
    if (v === undefined) {
      v = !isBlocked(floor, (c + 0.5) * CELL, (r + 0.5) * CELL, WALKER_RADIUS, obstacles);
      free.set(k, v);
    }
    return v;
  };

  const g = new Map<number, number>([[startKey, 0]]);
  const came = new Map<number, number>();
  const h = (c: number, r: number) => Math.hypot(c - goal.c, r - goal.r);
  const queue: { k: number; c: number; r: number; f: number }[] = [{ k: startKey, c: start.c, r: start.r, f: h(start.c, start.r) }];
  const closed = new Set<number>();

  while (queue.length) {
    let best = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i]!.f < queue[best]!.f) best = i;
    const cur = queue.splice(best, 1)[0]!;
    if (cur.k === goalKey) {
      const cells: number[] = [];
      for (let k: number | undefined = cur.k; k !== undefined && k !== startKey; k = came.get(k)) cells.unshift(k);
      const points = cells.slice(0, -1).map((k) => ({ x: ((k % cols) + 0.5) * CELL, y: (Math.floor(k / cols) + 0.5) * CELL }));
      return [...points, { x: to.x, y: to.y }];
    }
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue;
        const c = cur.c + dc;
        const r = cur.r + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows || !open(c, r)) continue;
        if (dc && dr && (!open(cur.c + dc, cur.r) || !open(cur.c, cur.r + dr))) continue;
        const k = key(c, r);
        const cost = (g.get(cur.k) ?? 0) + (dc && dr ? Math.SQRT2 : 1);
        if (cost < (g.get(k) ?? Infinity)) {
          g.set(k, cost);
          came.set(k, cur.k);
          queue.push({ k, c, r, f: cost + h(c, r) });
        }
      }
    }
  }
  return null;
}

/** The stairs, elevator or door to another room a walker standing at (x, y) is on, if any. */
export function portalAt(floor: FloorView, x: number, y: number) {
  return (floor.objects ?? []).find((o) => (o.type === "stairs" || o.type === "elevator" || o.type === "door") && o.targetFloorId && inside(o, x, y, 0)) ?? null;
}
