// Where each stand stands on the hall floors. The organiser can move a stand to any slot of any booth
// floor, or swap two stands; the moves are kept as one map of booth id to spot, applied over where
// each booth was published, added or booked. The game and the server both read the floors through
// placeStands, so they agree on which slots are taken, and stale or clashing entries never put two
// stands on one slot.
import { hasStand } from "./booth-packages";

/** Where the stand columns of a hall floor stand, left to right, 17 tiles apart so VIP wings and a
 *  sponsor banner fit between two columns. The halls were three columns wide; the last three were
 *  added on the right, so slots 0–5 and every stand saved on them stay where they were. */
export const STAND_COLUMNS = [3, 20, 37, 54, 71, 88];
/** The two rows of stands: along the back wall, and across the middle of the hall. */
export const STAND_ROWS = [0.4, 9.4];

/** The slots of a hall floor: six columns, two rows (top row first in each column). */
export const STAND_SLOTS = STAND_COLUMNS.flatMap((x) => STAND_ROWS.map((y) => ({ x, y })));

/** "Kolom 4 atas": where slot `slot` is, for the organiser's lists. Empty for a slot that isn't one. */
export const standSlotName = (slot: number) => {
  const s = STAND_SLOTS[slot];
  return s ? `Kolom ${STAND_COLUMNS.indexOf(s.x) + 1} ${s.y === STAND_ROWS[0] ? "atas" : "bawah"}` : "";
};

/** A spot on the hall floors: floor index and slot position. */
export type StandSpot = { floor: number; x: number; y: number };

/** The organiser's moves, by booth id. */
export type StandPlacements = Record<string, StandSpot>;

type Placeable = { id: string; floor: number; x: number; y: number; tier?: string };

/** The slot number (0–11) at a position, or -1 when the position is not a slot. */
export const standSlotIndex = (x: number, y: number) => STAND_SLOTS.findIndex((s) => s.x === x && s.y === y);

const spotKey = (s: StandSpot) => `${s.floor}:${s.x}:${s.y}`;

/** Whether a spot is a slot on one of `floors` booth floors. */
export const validStandSpot = (s: unknown, floors: number): s is StandSpot => {
  const v = s as StandSpot | null;
  return !!v && typeof v === "object" && Number.isInteger(v.floor) && v.floor >= 0 && v.floor < floors && standSlotIndex(v.x, v.y) >= 0;
};

/**
 * Where every stand stands now, by booth id. Moved booths take their spot first (in list order),
 * then the rest keep where they were published; a booth whose slot is already taken (a stale move,
 * two writers at once) goes to the first free slot of its floor, then of any floor. Mini booths
 * have no stand and are left out.
 */
export function placeStands(booths: Placeable[], placements: StandPlacements | undefined, floors: number): Map<string, StandSpot> {
  const out = new Map<string, StandSpot>();
  const used = new Set<string>();
  const stands = booths.filter(hasStand);
  const later: Placeable[] = [];
  for (const b of stands) {
    const p = placements?.[b.id];
    if (validStandSpot(p, floors) && !used.has(spotKey(p))) {
      out.set(b.id, { floor: p.floor, x: p.x, y: p.y });
      used.add(spotKey(p));
    } else later.push(b);
  }
  // Everyone else keeps their own slot when it is free; only then do the bumped ones look for room,
  // so one clash moves one booth instead of pushing the whole floor along.
  const bumped: Placeable[] = [];
  for (const b of later) {
    const spot: StandSpot = { floor: b.floor, x: b.x, y: b.y };
    if (used.has(spotKey(spot))) bumped.push(b);
    else {
      out.set(b.id, spot);
      used.add(spotKey(spot));
    }
  }
  const free = (floor: number) => STAND_SLOTS.map((s) => ({ floor, ...s })).find((s) => !used.has(spotKey(s)));
  for (const b of bumped) {
    const spot = free(b.floor) ?? Array.from({ length: floors }, (_, f) => free(f)).find(Boolean) ?? { floor: b.floor, x: b.x, y: b.y };
    out.set(b.id, spot);
    used.add(spotKey(spot));
  }
  return out;
}

export type StandMoveError = "not_found" | "no_stand" | "invalid_slot" | "same_slot";

/**
 * Move a stand to slot `slot` of floor `floor`: onto a free slot, or swapping places with the
 * stand there. `booths` are where they stand now (see placeStands). Returns the new placements,
 * keeping only booths still in the list, and which booth was swapped, if any.
 */
export function planStandMove(
  booths: Placeable[],
  placements: StandPlacements | undefined,
  boothId: string,
  to: { floor: number; slot: number },
  floors: number,
): { placements: StandPlacements; swapped: string | null } | { error: StandMoveError } {
  const b = booths.find((x) => x.id === boothId);
  if (!b) return { error: "not_found" };
  if (!hasStand(b)) return { error: "no_stand" };
  const slot = Number.isInteger(to.slot) ? STAND_SLOTS[to.slot] : undefined;
  const target = slot && { floor: to.floor, ...slot };
  if (!target || !validStandSpot(target, floors)) return { error: "invalid_slot" };
  if (b.floor === target.floor && b.x === target.x && b.y === target.y) return { error: "same_slot" };
  const other = booths.find((x) => x.id !== b.id && hasStand(x) && x.floor === target.floor && x.x === target.x && x.y === target.y);
  const ids = new Set(booths.map((x) => x.id));
  const next: StandPlacements = Object.fromEntries(Object.entries(placements ?? {}).filter(([id]) => ids.has(id)));
  next[b.id] = target;
  if (other) next[other.id] = { floor: b.floor, x: b.x, y: b.y };
  return { placements: next, swapped: other?.id ?? null };
}
