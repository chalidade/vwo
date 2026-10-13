// The people in the Perpustakaan's reading room: two readers turning pages at one table, a student
// with a laptop at another, someone browsing a bookcase and a child on the beanbag with a picture
// book. Like the park's people they are worked out from the clock alone (nothing is sent between
// devices), they are never counted as visitors, and they leave two tables and the rest of the
// bookcases free: a visitor who sits on one of their chairs gets it, and they stand beside it.
import type { Facing } from "./protocol";
import { LIBRARY_ROOM, librarySeat } from "./library-room";

type Pt = { x: number; y: number };

/** What one of them is doing; the drawing picks a prop from it. */
export type LibraryActivity = "read" | "laptop" | "browse" | "kid";

interface Routine {
  id: string;
  name: string;
  activity: LibraryActivity;
  /** A chair: [table index, 0–3] (see librarySeat). */
  seat?: readonly [number, 0 | 1 | 2 | 3];
  /** Walking slowly between two spots, stopping at each to look at the books. */
  pace?: { a: Pt; b: Pt; period: number };
  /** Sitting somewhere that is not a chair (the beanbag). */
  at?: Pt;
  small?: boolean;
  /** What they whisper now and then, in turn. */
  lines: readonly string[];
}

const shelf = LIBRARY_ROOM.sideShelves[3]!;
const bag = LIBRARY_ROOM.beanbag;

/** In front of the bottom-right bookcase, along its left part: its right end stays free. */
const BROWSE = { a: { x: shelf.x + 0.7, y: shelf.y + shelf.height + 0.55 }, b: { x: shelf.x + 2.1, y: shelf.y + shelf.height + 0.55 }, period: 22_000 };

const ROUTINES: readonly Routine[] = [
  {
    id: "reader-a",
    name: "Pak Hendra",
    activity: "read",
    seat: [1, 0],
    lines: ["Ssst... 🤫", "Coba baca The Art of Public Speaking, cocok buat latihan wawancara", "Satu bab lagi, habis itu lamar kerja"],
  },
  {
    id: "reader-b",
    name: "Mbak Wulan",
    activity: "read",
    seat: [1, 3],
    lines: ["Sherlock Holmes seru banget, susah berhenti 🔍", "(berbisik) Halo...", "Pride and Prejudice, sudah baca belum?"],
  },
  {
    id: "student",
    name: "Raka",
    activity: "laptop",
    seat: [3, 1],
    lines: ["Lagi rapikan CV sebelum ke stand 💻", "Wifi di sini kencang lho", "Tips: How to Live on 24 Hours a Day, pendek dan bagus"],
  },
  {
    id: "browser",
    name: "Bu Sari",
    activity: "browse",
    pace: BROWSE,
    lines: ["Hmm, rak misteri di sebelah mana ya...", "Nah, ini dia bukunya!", "Kak Nadia, buku ini boleh dibaca di sini?"],
  },
  {
    id: "kid",
    name: "Dito",
    activity: "kid",
    at: { x: bag.x + bag.width / 2, y: bag.y + bag.height - 0.05 },
    small: true,
    lines: ["Kak, ada cerita Peter Pan! 🧚", "Hihi, gambarnya lucu", "Sst, kata Kakak harus pelan-pelan"],
  },
];

/** The most people in the reading room at once. */
export const LIBRARY_NPC_MAX = ROUTINES.length;

/** One of the reading room's people at a moment. */
export interface LibraryNpc {
  id: string;
  name: string;
  activity: LibraryActivity;
  x: number;
  y: number;
  facing: Facing;
  seated?: boolean;
  small?: boolean;
  /** Walking (legs move). */
  moving?: boolean;
  /** Whispered now, for a few seconds. */
  say?: string;
}

const ease = (k: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, k)))) / 2;

/**
 * Walking to and fro between `a` and `b` over `period` ms: standing at `a` (35% of the time), walking
 * over (15%), standing at `b` (35%), walking back (15%), easing in and out of each walk so nobody
 * starts or stops with a jolt. Facing the shelf ("back") while standing, the way they go while walking.
 */
export function paceAt(a: Pt, b: Pt, period: number, at: number): Pt & { facing: Facing; moving: boolean } {
  const u = (((at % period) + period) % period) / period;
  const walk = (from: Pt, to: Pt, k: number) => {
    const e = ease(k);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const facing: Facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "back" : "front";
    return { x: from.x + dx * e, y: from.y + dy * e, facing, moving: true };
  };
  if (u < 0.35) return { ...a, facing: "back", moving: false };
  if (u < 0.5) return walk(a, b, (u - 0.35) / 0.15);
  if (u < 0.85) return { ...b, facing: "back", moving: false };
  return walk(b, a, (u - 0.85) / 0.15);
}

/** A steady number per id, to spread out when each one talks. */
function spread(id: string) {
  let h = 11;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0) % 997;
}

/** A whisper every 28 to 40 seconds, shown for 4: it is a library. */
function lineAt(r: Routine, at: number) {
  if (!r.lines.length) return undefined;
  const cycle = 28_000 + (spread(r.id) % 13) * 1000;
  const t = at + spread(r.id) * 1000;
  if (t % cycle >= 4000) return undefined;
  return r.lines[Math.floor(t / cycle) % r.lines.length];
}

/**
 * The reading room's people at a moment. `seatTaken(table, k)` says whether a visitor sits on that
 * chair already: then whoever would sit there stands beside the table instead.
 */
export function libraryNpcsAt(at: number, seatTaken: (table: number, k: 0 | 1 | 2 | 3) => boolean = () => false): LibraryNpc[] {
  const out: LibraryNpc[] = [];
  for (const r of ROUTINES) {
    const base = { id: `lib:${r.id}`, name: r.name, activity: r.activity, ...(r.small ? { small: true } : {}) };
    const say = lineAt(r, at);
    const sayIt = say ? { say } : {};
    if (r.seat) {
      const [table, k] = r.seat;
      const s = librarySeat(table, k);
      const t = LIBRARY_ROOM.tables[table]!;
      // Standing at the table's end, on their own side of it.
      if (seatTaken(table, k)) out.push({ ...base, x: k % 2 ? t.x + t.width + 0.5 : t.x - 0.5, y: s.y, facing: k % 2 ? "left" : "right", ...sayIt });
      else out.push({ ...base, x: s.x, y: s.y, facing: k < 2 ? "front" : "back", seated: true, ...sayIt });
    } else if (r.pace) {
      const p = paceAt(r.pace.a, r.pace.b, r.pace.period, at + spread(r.id) * 37);
      out.push({ ...base, x: p.x, y: p.y, facing: p.facing, ...(p.moving ? { moving: true } : {}), ...sayIt });
    } else if (r.at) out.push({ ...base, x: r.at.x, y: r.at.y, facing: "front", seated: true, ...sayIt });
  }
  return out;
}

/** The chairs they sit on, as [table, k]: kept free for them unless a visitor got there first. */
export function libraryNpcSeats(): (readonly [number, 0 | 1 | 2 | 3])[] {
  return ROUTINES.filter((r) => r.seat).map((r) => r.seat!);
}

/** What one of them whispers when tapped. */
export function libraryNpcHello(id: string, at: number) {
  const r = ROUTINES.find((x) => `lib:${x.id}` === id);
  if (!r?.lines.length) return "Ssst... halo! 🤫";
  return r.lines[Math.floor(at / 3000) % r.lines.length]!;
}
