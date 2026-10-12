// Walking as intents rather than a stream of positions: a player sends one message when they set
// off (where from, the route, how fast) and one when they stop, sit or turn with the keys; every
// other device walks them along the same route by itself. A clicked walk of any length is one
// message instead of four a second.
import { type Facing, facingFor } from "@vwo/shared";

export interface Pt {
  x: number;
  y: number;
}

/** What a player is doing, as sent: standing (no path, no velocity), walking a route, or steering with the keys. */
export interface MoveIntent {
  x: number;
  y: number;
  facing: Facing;
  /** The rest of a clicked route, after (x, y). */
  path: Pt[];
  /** Tiles per second along the route. */
  speed: number;
  /** Steering with the keys: tiles per second on each axis. */
  vel: Pt | null;
  /** Sits here when the route ends (or now, when standing). */
  seatId: string | null;
}

/** A remote player's motion as this device plays it back. */
export interface Motion {
  /** Where they were drawn when the intent arrived; they walk on from here, not jump. */
  from: Pt;
  intent: MoveIntent;
  /** When playback started (ms). */
  at: number;
}

/** Keys-steered walkers are carried on for at most this long without word from them. */
export const KEY_CARRY_MS = 2500;
/** Further than this from where we drew them, a player is moved straight there. */
export const SNAP_TILES = 4;
const MAX_POINTS = 24;
const FACINGS = new Set<Facing>(["front", "back", "left", "right"]);

const round = (n: number) => Math.round(n * 100) / 100;
const clampTile = (n: number) => Math.min(200, Math.max(0, n));

/** The intent as a compact message (positions to a hundredth of a tile). */
export function encodeMove(m: MoveIntent) {
  const out: Record<string, unknown> = { k: "m", x: round(m.x), y: round(m.y), f: m.facing };
  if (m.path.length) {
    out.p = m.path.slice(0, MAX_POINTS).flatMap((p) => [round(p.x), round(p.y)]);
    out.s = round(m.speed);
  }
  if (m.vel) out.v = [round(m.vel.x), round(m.vel.y)];
  if (m.seatId) out.st = m.seatId;
  return out;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Read an intent from another device; anything malformed is dropped. */
export function decodeMove(raw: unknown): MoveIntent | null {
  const m = raw as { k?: unknown; x?: unknown; y?: unknown; f?: unknown; p?: unknown; s?: unknown; v?: unknown; st?: unknown } | null;
  if (!m || m.k !== "m" || !finite(m.x) || !finite(m.y) || !FACINGS.has(m.f as Facing)) return null;
  const path: Pt[] = [];
  if (m.p !== undefined) {
    if (!Array.isArray(m.p) || m.p.length % 2 || m.p.length > MAX_POINTS * 2 || !m.p.every(finite)) return null;
    for (let i = 0; i < m.p.length; i += 2) path.push({ x: clampTile(m.p[i] as number), y: clampTile(m.p[i + 1] as number) });
  }
  const speed = path.length ? (finite(m.s) ? Math.min(12, Math.max(0.2, m.s)) : null) : 0;
  if (speed === null) return null;
  let vel: Pt | null = null;
  if (m.v !== undefined) {
    if (!Array.isArray(m.v) || m.v.length !== 2 || !m.v.every(finite)) return null;
    const [vx, vy] = m.v as number[];
    vel = { x: Math.min(12, Math.max(-12, vx!)), y: Math.min(12, Math.max(-12, vy!)) };
  }
  const seatId = typeof m.st === "string" && /^[\w-]{1,80}$/.test(m.st) ? m.st : null;
  return { x: clampTile(m.x), y: clampTile(m.y), facing: m.f as Facing, path, speed, vel, seatId };
}

/** Start playing an intent back from where the player is drawn now. */
export function startMotion(drawn: Pt | null, intent: MoveIntent, at: number): Motion {
  const far = !drawn || Math.hypot(drawn.x - intent.x, drawn.y - intent.y) > SNAP_TILES;
  return { from: far ? { x: intent.x, y: intent.y } : { x: drawn.x, y: drawn.y }, intent, at };
}

/** Where a remote player is at `now`, and whether they have arrived (then they sit, if they meant to). */
export function motionAt(m: Motion, now: number): { x: number; y: number; facing: Facing; done: boolean; seatId: string | null } {
  const { intent } = m;
  const t = Math.max(0, now - m.at) / 1000;
  if (intent.vel) {
    // Catch up from where they were drawn to where the keys started them, then carry on a little.
    const carry = Math.min(t, KEY_CARRY_MS / 1000);
    const k = Math.min(1, t / 0.3);
    const x = clampTile(m.from.x + (intent.x - m.from.x) * k + intent.vel.x * carry);
    const y = clampTile(m.from.y + (intent.y - m.from.y) * k + intent.vel.y * carry);
    return { x, y, facing: facingFor(intent.vel.x, intent.vel.y, intent.facing), done: t * 1000 >= KEY_CARRY_MS, seatId: null };
  }
  // Along the polyline: from where they were drawn, through where they said they were, then the route.
  const pts: Pt[] = [m.from];
  if (Math.hypot(intent.x - m.from.x, intent.y - m.from.y) > 0.01) pts.push({ x: intent.x, y: intent.y });
  pts.push(...intent.path);
  const speed = intent.path.length ? intent.speed : 4;
  let left = speed * t;
  let facing = intent.facing;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    facing = facingFor(b.x - a.x, b.y - a.y, facing);
    if (left < len) return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len, facing, done: false, seatId: null };
    left -= len;
  }
  const end = pts[pts.length - 1]!;
  // Standing still: the facing they gave; at the end of a route, the way they were walking.
  return { x: end.x, y: end.y, facing: intent.path.length ? facing : intent.facing, done: true, seatId: intent.seatId };
}
