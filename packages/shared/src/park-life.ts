// Life in the park: the time of day (the park follows the clock in Jakarta), and the people who are
// always about: a jogger on the path loop, someone walking a dog, a reader and a lunch on the benches,
// a lady feeding the pigeons, kids in the playground, the vendor at his cart and two friends chatting.
// They are worked out from the clock alone, so every visitor sees roughly the same people in the same
// places without anything sent between devices, and they are never counted as visitors.
import type { Facing } from "./protocol";
import { PARK } from "./park";

// ---- Day and night, Jakarta time (WIB, UTC+7).

export type DayPhase = "dawn" | "day" | "dusk" | "night";

/** Minutes past midnight in Jakarta at a moment. */
export function wibMinute(at: number) {
  const d = new Date(at + 7 * 3_600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

const DAWN = 5 * 60; // 05.00
const DAY = 6 * 60; // 06.00
const DUSK = 17 * 60 + 30; // 17.30
const NIGHT = 18 * 60 + 30; // 18.30

/** Dawn 05.00–06.00, day 06.00–17.30, dusk 17.30–18.30, night 18.30–05.00 (WIB). */
export function dayPhase(at: number): DayPhase {
  const m = wibMinute(at);
  if (m >= NIGHT || m < DAWN) return "night";
  if (m < DAY) return "dawn";
  if (m < DUSK) return "day";
  return "dusk";
}

/** How dark the park is, 0 (day) to 1 (night): it fades in over dusk and out over dawn. */
export function darkness(at: number) {
  const d = new Date(at + 7 * 3_600_000);
  const m = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  if (m >= NIGHT || m < DAWN) return 1;
  if (m < DAY) return 1 - (m - DAWN) / (DAY - DAWN);
  if (m < DUSK) return 0;
  return (m - DUSK) / (NIGHT - DUSK);
}

/** The lamps are on from dusk to dawn. */
export const lampsOn = (at: number) => dayPhase(at) !== "day";

// ---- The people in the park.

type Pt = { x: number; y: number };

/** What one of them is doing; the drawing picks a look and a prop from it. */
export type ParkActivity = "jog" | "dog" | "read" | "eat" | "feed" | "play" | "vendor" | "chat" | "patrol";

interface Routine {
  id: string;
  name: string;
  activity: ParkActivity;
  /** Out by day (dawn to dusk) or at night. */
  when: "day" | "night";
  /** A closed loop walked at `speed` tiles a second, starting `offset` tiles along it. */
  loop?: readonly Pt[];
  speed?: number;
  offset?: number;
  /** A bench seat: [bench index, 0 left or 1 right]. */
  seat?: readonly [number, 0 | 1];
  /** Standing still. */
  at?: Pt;
  facing?: Facing;
  small?: boolean;
  /** What they say now and then, in turn. */
  lines: readonly string[];
}

/** The jogging loop round the right half: top walkway, the right edge, the bottom walkway, back up past the plaza. */
const RIGHT_LOOP: readonly Pt[] = [
  { x: 30.8, y: 6.2 },
  { x: 54.7, y: 6.2 },
  { x: 54.7, y: 20.1 },
  { x: 30.8, y: 20.1 },
];
/** The loop round the left half, between the walkways, the lawn by the trees and the plaza's left side. */
const LEFT_LOOP: readonly Pt[] = [
  { x: 25.2, y: 6.2 },
  { x: 25.2, y: 20.1 },
  { x: 10.9, y: 20.1 },
  { x: 10.9, y: 6.2 },
];
/** Kids running round the sandbox. */
const PLAY_LOOP: readonly Pt[] = [
  { x: 39.4, y: 14.6 },
  { x: 43.2, y: 14.6 },
  { x: 43.2, y: 16.7 },
  { x: 39.4, y: 16.7 },
];

const p = PARK;
const vendorAt = { x: p.cart.x + p.cart.width + 0.5, y: p.cart.y + p.cart.height + 0.15 };

const ROUTINES: readonly Routine[] = [
  {
    id: "jogger",
    name: "Mas Dimas",
    activity: "jog",
    when: "day",
    loop: RIGHT_LOOP,
    speed: 2.4,
    lines: ["Pagi! Eh, siang ya 😅", "Satu putaran lagi!", "Habis lari, lanjut lamar kerja 💪", "Hosh... hosh..."],
  },
  {
    id: "dogwalker",
    name: "Kak Laras",
    activity: "dog",
    when: "day",
    loop: LEFT_LOOP,
    speed: 0.9,
    offset: 12,
    lines: ["Mochi, jangan lari-lari!", "Boleh dielus kok, dia jinak 🐶", "Mochi suka banget ke taman"],
  },
  {
    id: "reader",
    name: "Bu Rina",
    activity: "read",
    when: "day",
    seat: [0, 0],
    lines: ["Bukunya seru, tentang wawancara kerja", "Tips nomor 7: datang lebih awal", "Sst... lagi bab seru nih 📖"],
  },
  {
    id: "eater",
    name: "Bang Ucok",
    activity: "eat",
    when: "day",
    seat: [3, 1],
    lines: ["Makan dulu, biar kuat antre interview", "Enak nih roti isinya 🥪", "Awas, ada tupai suka nyolong roti!"],
  },
  {
    id: "feeder",
    name: "Oma Lies",
    activity: "feed",
    when: "day",
    at: { x: 26.2, y: 16.5 },
    facing: "front",
    lines: ["Kur kur kur... sini merpati 🕊️", "Jangan dikagetin ya, nanti terbang", "Tiap sore Oma ke sini"],
  },
  { id: "kid1", name: "Tio", activity: "play", when: "day", loop: PLAY_LOOP, speed: 1.6, small: true, lines: ["Kejar aku!", "Main perosotan yuk!", "Hore! 🎉"] },
  { id: "kid2", name: "Nala", activity: "play", when: "day", loop: PLAY_LOOP, speed: 1.6, offset: 4.4, small: true, lines: ["Tunggu!", "Aku yang ayunan duluan!", "Hihihi"] },
  {
    id: "vendor",
    name: "Pak Darto",
    activity: "vendor",
    when: "day",
    at: vendorAt,
    facing: "left",
    lines: ["Es cendol! Es cendol seger!", "Cilok, cilok, anget!", "Mampir dulu, Kak!"],
  },
  { id: "chat-a", name: "Sinta", activity: "chat", when: "day", seat: [2, 0], lines: [] },
  { id: "chat-b", name: "Dewi", activity: "chat", when: "day", seat: [2, 1], lines: [] },
  // At night: a runner, the dog's evening walk, nasi goreng at the cart and the neighbourhood watch.
  { id: "runner", name: "Mbak Tari", activity: "jog", when: "night", loop: RIGHT_LOOP, speed: 2.2, offset: 20, lines: ["Lari malam, adem!", "Lampunya terang, aman kok"] },
  {
    id: "dogwalker",
    name: "Kak Laras",
    activity: "dog",
    when: "night",
    loop: LEFT_LOOP,
    speed: 0.9,
    offset: 30,
    lines: ["Mochi, pelan-pelan, sudah malam", "Kok semaknya gerak-gerak ya..."],
  },
  {
    id: "vendor",
    name: "Pak Darto",
    activity: "vendor",
    when: "night",
    at: vendorAt,
    facing: "left",
    lines: ["Nasi goreng! Tek tek tek!", "Mi goreng, nasi goreng, anget!", "Lapar malam-malam? Mampir!"],
  },
  { id: "ronda-a", name: "Pak RT", activity: "chat", when: "night", seat: [2, 0], lines: [] },
  { id: "ronda-b", name: "Pak Yusuf", activity: "chat", when: "night", seat: [2, 1], lines: [] },
  {
    id: "guard",
    name: "Pak Satpam",
    activity: "patrol",
    when: "night",
    loop: LEFT_LOOP,
    speed: 0.8,
    offset: 50,
    lines: ["Malam, Kak. Hati-hati di jalan", "Tadi ada yang lihat pocong? Ah, iseng saja itu"],
  },
];

/** Small talk on the bench, by day and by night: the two take turns. */
const BENCH_TALK: Record<"day" | "night", readonly (readonly string[])[]> = {
  day: [
    ["Kamu sudah lamar ke mana?", "Tiga stand! Kamu?", "Baru dua, habis ini lanjut", "Semangat kita! 💪"],
    ["Gedung yang dibangun itu buat apa?", "Katanya job fair berikutnya", "Wah, catat tanggalnya ah"],
    ["Panas ya hari ini", "Beli es cendol yuk", "Ayo! Pak Darto, dua ya!"],
    ["Tadi interviewnya gimana?", "Deg-degan, tapi lancar", "Kabari ya kalau lolos!"],
  ],
  night: [
    ["Malam ini sepi ya, Pak", "Iya, tapi tadi lampu kedip-kedip sendiri", "Ah, paling korslet", "...semoga 😅"],
    ["Kopi, Pak?", "Boleh, biar melek ronda", "Nasi goreng sekalian?"],
    ["Pak, dengar suara ketawa nggak?", "Itu kunang-kunang, bukan apa-apa", "Kunang-kunang kok ketawa..."],
  ],
};

/** The most people about at once, day or night (they are drawn on every visitor's phone). */
export const PARK_NPC_MAX = 10;

/** One of the park's people at a moment: where, which way, sitting or not, and what they say. */
export interface ParkNpc {
  id: string;
  name: string;
  activity: ParkActivity;
  x: number;
  y: number;
  facing: Facing;
  seated?: boolean;
  small?: boolean;
  /** Walking (legs move). */
  moving?: boolean;
  /** Said now, for a few seconds. */
  say?: string;
  /** The dog on its lead, a step ahead. */
  pet?: { x: number; y: number; facing: Facing };
}

const segLen = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

function facingFor(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "back" : "front";
}

/** Where on a closed loop someone is after walking `d` tiles. */
export function alongLoop(loop: readonly Pt[], d: number): Pt & { facing: Facing } {
  const total = loop.reduce((n, a, i) => n + segLen(a, loop[(i + 1) % loop.length]!), 0);
  let left = ((d % total) + total) % total;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const l = segLen(a, b);
    if (left <= l) {
      const k = l ? left / l : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, facing: facingFor(b.x - a.x, b.y - a.y) };
    }
    left -= l;
  }
  return { ...loop[0]!, facing: "front" };
}

/** A bench seat's spot, as the floor plan has it. */
export const benchSeat = (bench: number, side: 0 | 1) => ({ x: PARK.benches[bench]!.x + 0.5 + side, y: PARK.benches[bench]!.y + 0.5 });

/** A steady number per id, to spread out when each one talks. */
function spread(id: string) {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0) % 997;
}

/** The line someone says at `at`: one every 20 to 30 seconds, shown for 4. */
function lineAt(r: Routine, at: number) {
  if (!r.lines.length) return undefined;
  const cycle = 20_000 + (spread(r.id) % 10) * 1000;
  const t = at + spread(r.id) * 1000;
  if (t % cycle >= 4000) return undefined;
  return r.lines[Math.floor(t / cycle) % r.lines.length];
}

/** The bench pair's conversation at `at`: a line every 4.5 seconds, then a pause. */
function benchTalkAt(when: "day" | "night", at: number): { who: 0 | 1; text: string } | null {
  const talks = BENCH_TALK[when];
  const round = 45_000;
  const n = Math.floor(at / round);
  const talk = talks[n % talks.length]!;
  const i = Math.floor((at % round) / 4500);
  if (i >= talk.length) return null;
  return { who: (i % 2) as 0 | 1, text: talk[i]! };
}

/**
 * The park's people at a moment: by day the full cast, at night a few. `seatTaken` says whether a
 * visitor sits on a bench seat already: then whoever would sit there stands beside the bench.
 */
export function parkNpcsAt(at: number, seatTaken: (bench: number, side: 0 | 1) => boolean = () => false): ParkNpc[] {
  const when = dayPhase(at) === "night" ? "night" : "day";
  const talk = benchTalkAt(when, at);
  const out: ParkNpc[] = [];
  for (const r of ROUTINES) {
    if (r.when !== when || out.length >= PARK_NPC_MAX) continue;
    const base = { id: `park:${r.id}`, name: r.name, activity: r.activity, ...(r.small ? { small: true } : {}) };
    let say = lineAt(r, at);
    if (r.activity === "chat" && r.seat && talk && talk.who === r.seat[1]) say = talk.text;
    const sayIt = say ? { say } : {};
    if (r.loop) {
      const d = (r.offset ?? 0) + (at / 1000) * (r.speed ?? 1);
      const pos = alongLoop(r.loop, d);
      const pet = r.activity === "dog" ? { pet: alongLoop(r.loop, d + 0.9) } : {};
      out.push({ ...base, x: pos.x, y: pos.y, facing: pos.facing, moving: true, ...sayIt, ...pet });
    } else if (r.seat) {
      const [bench, side] = r.seat;
      const s = benchSeat(bench, side);
      if (seatTaken(bench, side)) out.push({ ...base, x: s.x + (side ? 0.9 : -0.9), y: s.y + 0.7, facing: side ? "left" : "right", ...sayIt });
      else out.push({ ...base, x: s.x, y: s.y, facing: r.activity === "chat" ? (side ? "left" : "right") : "front", seated: true, ...sayIt });
    } else if (r.at) out.push({ ...base, x: r.at.x, y: r.at.y, facing: r.facing ?? "front", ...sayIt });
  }
  return out;
}

/** What one of the park's people says when tapped: one of their lines, or a greeting from the two on
 *  the bench. */
export function parkNpcHello(id: string, at: number) {
  const when = dayPhase(at) === "night" ? "night" : "day";
  const r = ROUTINES.find((x) => `park:${x.id}` === id && x.when === when);
  if (!r?.lines.length) return when === "night" ? "Malam! Jangan pulang terlalu larut ya" : "Halo! Lagi istirahat di taman juga? 😄";
  return r.lines[Math.floor(at / 3000) % r.lines.length]!;
}

/** The bench seats the park's people sit on at a moment, as [bench, side]: kept free for them. */
export function parkNpcSeats(at: number): (readonly [number, 0 | 1])[] {
  const when = dayPhase(at) === "night" ? "night" : "day";
  return ROUTINES.filter((r) => r.when === when && r.seat).map((r) => r.seat!);
}

/** Every loop walked in the park, for checking that nobody walks through a tree. */
export const PARK_LOOPS = { right: RIGHT_LOOP, left: LEFT_LOOP, play: PLAY_LOOP } as const;

// ---- Pigeons, by the lady feeding them and by the bench on the top walkway: they fly off when
// someone walks up, and come back once they have gone.

export const PIGEON_FLOCKS: readonly Pt[] = [
  { x: 26.3, y: 17.4 },
  { x: 40.6, y: 8.9 },
];

/** How close someone may come before a flock takes off, in tiles. */
export const PIGEON_SHY = 2.2;

/** Which flocks are startled by someone standing at (x, y). */
export const scaredFlocks = (x: number, y: number) => PIGEON_FLOCKS.map((f) => Math.hypot(f.x - x, f.y - y) < PIGEON_SHY);
