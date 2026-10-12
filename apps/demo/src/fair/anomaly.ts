// Where a random anomaly (a cat, fireflies...) shows up: the server picks a floor number and a
// seed; every visitor turns them into the same floor and the same walkable spot here.
import { ANOMALY_KINDS, type AnomalyInfo, type AnomalyKind, type AnomalyPlace, type FairStop, type FloorView, isBlocked } from "@vwo/shared";

/** How far the sprite strolls left and right of its spot, in tiles. */
export const WANDER = 0.8;

/** The stops a kind may turn up on: all of them, or only the floor of its room (the bebek karet in the
 *  food court, Si Jobi in the Aula). */
export const anomalyStops = (stops: readonly FairStop[], place: AnomalyPlace | undefined, roomKind: (roomId: string) => string | undefined) =>
  place ? stops.filter((st) => st.roomId !== undefined && roomKind(st.roomId) === place) : stops;

/** The floor an anomaly is on: one of the lift's stops, halls and rooms alike. */
export const anomalyFloorId = (stops: readonly FairStop[], pick: number) => (stops.length ? stops[pick % stops.length]!.floorId : null);

/**
 * A walkable spot from the seed, away from the back wall and with room to stroll to either side.
 * Always the same for the same floor and seed; the middle of the floor when nothing fits.
 */
export function anomalySpot(floor: FloorView, seed: number) {
  let h = seed >>> 0 || 1;
  const next = () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    return (h >>> 8) / 0x1000000;
  };
  // Not on a chair either, where someone may sit: chairs don't block walking.
  const onSeat = (x: number, y: number) => floor.seats.some((s) => Math.abs(s.y - y) < 0.8 && Math.abs(s.x - x) < WANDER + 0.6);
  const free = (x: number, y: number) => !isBlocked(floor, x, y, 0.35) && !isBlocked(floor, x - WANDER, y, 0.35) && !isBlocked(floor, x + WANDER, y, 0.35) && !onSeat(x, y);
  for (let i = 0; i < 60; i++) {
    const x = 1.5 + next() * Math.max(0, floor.width - 3);
    const y = 2.5 + next() * Math.max(0, floor.height - 4);
    if (free(x, y)) return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }
  return { x: floor.width / 2, y: floor.height / 2 };
}

/** One kind in the player's collection: when they first caught it, and where when known. */
export interface Caught {
  kind: AnomalyKind;
  at: number;
  where?: string;
}

/** Several records of catches (the server's, this browser's, the coin history) as one collection:
 *  the first catch of each kind, with a place from whichever record has one. In the kinds' order. */
export function mergeCaught(lists: readonly (readonly Caught[])[]): Map<AnomalyKind, Caught> {
  const by = new Map<AnomalyKind, Caught>();
  for (const c of lists.flat()) {
    const was = by.get(c.kind);
    const first = !was || c.at < was.at ? c : was;
    by.set(c.kind, { kind: c.kind, at: first.at, ...((first.where ?? was?.where ?? c.where) ? { where: first.where ?? was?.where ?? c.where } : {}) });
  }
  return new Map(ANOMALY_KINDS.filter((k) => by.has(k)).map((k) => [k, by.get(k)!]));
}

/** "Petunjuk: 05.00–10.00 WIB" or "Petunjuk: di food court": where to look for a kind not caught yet. */
export function anomalyHint(info: AnomalyInfo) {
  if (info.place) return info.place === "foodcourt" ? "Petunjuk: di food court" : "Petunjuk: di Aula";
  if (info.hours) {
    const [from, to] = info.hours;
    const hh = (h: number) => `${String(h).padStart(2, "0")}.00`;
    return `Petunjuk: ${hh(from)}–${hh(to)} WIB`;
  }
  return info.rare ? "Petunjuk: sangat jarang muncul" : null;
}
