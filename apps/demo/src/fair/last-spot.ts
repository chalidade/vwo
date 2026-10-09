// Where the player last stood, per account, so coming back (a reload, the payment page, closing
// the app) puts them on the same floor at the same spot instead of the entrance. Kept in this
// browser only: it is small, changes often, and is not worth a server round trip.

export interface Spot {
  floorId: string;
  x: number;
  y: number;
  at: number;
}

const SPOT = (who: string) => `vwo:jobfair-spot:${who}`;
const INSIDE = (who: string) => `vwo:jobfair-inside:${who}`;
/** A spot older than this is stale: the fair layout may have changed since. */
const MAX_AGE = 14 * 86_400_000;

export function saveSpot(who: string, s: Omit<Spot, "at">) {
  try {
    localStorage.setItem(SPOT(who), JSON.stringify({ floorId: s.floorId, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, at: Date.now() }));
  } catch {
    // Storage blocked: start at the entrance next time.
  }
}

export function loadSpot(who: string): Spot | null {
  try {
    const s = JSON.parse(localStorage.getItem(SPOT(who)) ?? "null") as Spot | null;
    if (!s || typeof s.floorId !== "string" || !Number.isFinite(s.x) || !Number.isFinite(s.y) || Date.now() - s.at > MAX_AGE) return null;
    return s;
  } catch {
    return null;
  }
}

/** The player was in the fair when they left, so the welcome screen is skipped next time. */
export function setInside(who: string, inside: boolean) {
  try {
    if (inside) localStorage.setItem(INSIDE(who), "1");
    else localStorage.removeItem(INSIDE(who));
  } catch {
    // Storage blocked: the welcome screen shows again.
  }
}

export function wasInside(who: string) {
  try {
    return localStorage.getItem(INSIDE(who)) === "1";
  } catch {
    return false;
  }
}
