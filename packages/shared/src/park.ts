// The park outside the building: a lawn with paths, trees, benches and a fountain, reached through a
// door in the lobby. The event's own building stands at the top with its entrance back into the
// lobby; the plots beside it hold the organiser's next events, drawn under construction with a
// "Coming soon" banner until they are ready. Coordinates are tiles, like the halls.
import type { FloorView, MapObjectView, SeatView } from "./venue-view";

type Box = { x: number; y: number; width: number; height: number };

/** One plot: a building's footprint. Its front (where you walk up to it) is the bottom edge. */
const plot = (x: number, y: number): Box => ({ x, y, width: 8.6, height: 4.6 });

/** The park's layout: shared by the floor plan (what blocks) and the drawings (ui Park.tsx). */
export const PARK = {
  width: 56,
  height: 24,
  /** The event's building, top middle. Its door is the way back into the lobby. */
  main: { x: 19, y: 0, width: 18, height: 4.6 },
  door: { x: 26.6, width: 2.8 },
  /** Where you step out of the building into the park, and where you stand to go back in. */
  arrive: { x: 28, y: 5.4 },
  /** Plots for other events' buildings, nearest to the event's own building first. */
  plots: [plot(9.9, 0), plot(37.5, 0), plot(0.8, 0), plot(46.6, 0), plot(0.8, 11.4)],
  fountain: { x: 25.8, y: 12.2, width: 4.4, height: 3.2 },
  /** Walkways drawn on the grass (walkable, only looks). */
  paths: [
    { x: 0.4, y: 5.0, width: 55.2, height: 2.2 },
    { x: 26.6, y: 7.2, width: 2.8, height: 16.8 },
    { x: 0.4, y: 19.2, width: 55.2, height: 1.8 },
    { x: 4.2, y: 16.0, width: 1.8, height: 3.2 },
  ],
  /** The round plaza around the fountain. */
  plaza: { x: 21.6, y: 9.6, width: 12.8, height: 8.6 },
  /** Tree trunks, by the point where they meet the ground. */
  trees: [
    { x: 3, y: 9.4 },
    { x: 7.6, y: 8.8 },
    { x: 14, y: 9.6 },
    { x: 19.4, y: 10.4 },
    { x: 36.6, y: 10.4 },
    { x: 42, y: 9.4 },
    { x: 48, y: 9.0 },
    { x: 53.2, y: 9.8 },
    { x: 46.2, y: 14.2 },
    { x: 52.6, y: 14.6 },
    { x: 12, y: 14.4 },
    { x: 2.4, y: 22.8 },
    { x: 11.6, y: 23.2 },
    { x: 20, y: 23.0 },
    { x: 36, y: 23.0 },
    { x: 44.4, y: 23.2 },
    { x: 53.6, y: 22.8 },
  ],
  /** Benches facing the walkways (two seats each); their backrest is along the top. */
  benches: [
    { x: 15.6, y: 7.5 },
    { x: 38.4, y: 7.5 },
    { x: 22.2, y: 16.6 },
    { x: 31.8, y: 16.6 },
    { x: 8.4, y: 17.2 },
    { x: 45.6, y: 17.2 },
  ],
  lamps: [
    { x: 10.2, y: 7.6 },
    { x: 24.4, y: 7.6 },
    { x: 31.6, y: 7.6 },
    { x: 45.8, y: 7.6 },
    { x: 24.6, y: 19.0 },
    { x: 31.4, y: 19.0 },
  ],
  /** Flower beds. */
  beds: [
    { x: 22.4, y: 11.2, width: 2.2, height: 1 },
    { x: 31.4, y: 11.2, width: 2.2, height: 1 },
    { x: 47, y: 11.4, width: 5.4, height: 1.1 },
  ],
  /** The public phone box by the plaza: step in front of it to call a friend. */
  phoneBox: { x: 35, y: 7.4, width: 1.3, height: 0.9 },
  /** A street vendor's cart on the lawn (the vendor stands at its right end). */
  cart: { x: 16.4, y: 12.2, width: 2.2, height: 1 },
  /** A bicycle rack by the top walkway. */
  bikes: { x: 11.5, y: 7.5, width: 2.4, height: 0.45 },
  /** The park's map board by the bottom walkway. */
  signboard: { x: 30, y: 21.3, width: 1.4, height: 0.35 },
  /** The playground: a slide and a swing (what blocks), and a sandbox you can walk in. */
  playground: {
    slide: { x: 39, y: 13, width: 1.4, height: 1.2 },
    swing: { x: 41.6, y: 13.2, width: 2.8, height: 0.35 },
    sandbox: { x: 39.2, y: 14.8, width: 3.6, height: 1.6 },
  },
} as const;

export const BENCH_W = 2;
export const BENCH_H = 0.8;

/** Most other events the organiser can put in the park: one per plot. */
export const PARK_MAX_BUILDINGS = PARK.plots.length;

/** Another event's building in the park. "soon" stands under construction with a banner; "hidden" is
 *  kept in the organiser's list but not shown to anyone. */
export interface ParkBuilding {
  id: string;
  name: string;
  /** First and last day (YYYY-MM-DD), picked on a calendar. A one-day event has no end. */
  startDate?: string;
  endDate?: string;
  /** Older buildings: the date as the organiser typed it ("Maret 2027"). Shown until it is edited. */
  date?: string;
  /** A line or two about it, shown when someone walks up. */
  about?: string;
  status: "soon" | "hidden";
}

export const parkFloorId = (fair: { slug: string }) => `${fair.slug}-taman`;
export const isParkFloor = (floorId: string) => floorId.endsWith("-taman");

const text = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** The organiser's list as stored, made safe: at most one per plot, every field trimmed to size, no
 *  duplicate or odd ids, and anything without a name dropped. Anything that is not a list is none. */
export function cleanParkBuildings(raw: unknown): ParkBuilding[] {
  if (!Array.isArray(raw)) return [];
  const out: ParkBuilding[] = [];
  const ids = new Set<string>();
  for (const item of raw.slice(0, 50)) {
    if (out.length >= PARK_MAX_BUILDINGS) break;
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const id = typeof b.id === "string" && /^[\w-]{1,40}$/.test(b.id) ? b.id : "";
    const name = text(b.name, 40);
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);
    const range = cleanDateRange(b.startDate, b.endDate);
    // A picked range replaces the old typed date.
    const date = range ? "" : text(b.date, 40);
    const about = text(b.about, 200);
    out.push({ id, name, ...(range ?? {}), ...(date ? { date } : {}), ...(about ? { about } : {}), status: b.status === "hidden" ? "hidden" : "soon" });
  }
  return out;
}

/** A calendar day "YYYY-MM-DD" that exists, in a sane year; anything else is "". */
export function cleanDay(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  if (y < 2000 || y > 2100) return "";
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? v : "";
}

/** The longest an event's range may run. */
export const PARK_MAX_RANGE_DAYS = 366;

const dayNo = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/** A start and end day, made safe: the end only when it is after the start and within a year of it.
 *  Only an end counts as a one-day event. Null without a usable day. */
export function cleanDateRange(start: unknown, end: unknown): { startDate: string; endDate?: string } | null {
  let s = cleanDay(start);
  let e = cleanDay(end);
  if (!s && e) [s, e] = [e, ""];
  if (!s) return null;
  if (e && (e <= s || dayNo(e) - dayNo(s) > PARK_MAX_RANGE_DAYS)) e = "";
  return e ? { startDate: s, endDate: e } : { startDate: s };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "12 Nov 2026", "12–14 Nov 2026", "30 Nov – 2 Des 2026" or "30 Des 2026 – 2 Jan 2027". */
export function formatDateRange(start: string, end?: string) {
  const [y1, m1, d1] = start.split("-").map(Number) as [number, number, number];
  if (!end || end === start) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  const [y2, m2, d2] = end.split("-").map(Number) as [number, number, number];
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
}

/** When a building's event happens, for the banner and the card: the picked range, or the old typed date. */
export function parkBuildingDate(b: Pick<ParkBuilding, "startDate" | "endDate" | "date">) {
  return b.startDate ? formatDateRange(b.startDate, b.endDate) : (b.date ?? "");
}

const MONTH_WORDS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

/** An old typed date read as a range when it names days ("12 Nov 2026", "12-14 November 2026",
 *  "2026-11-12"), to fill the calendar when the organiser edits it. Null for "Maret 2027" and the like. */
export function readTypedDate(text: string | undefined): { startDate: string; endDate?: string } | null {
  const t = (text ?? "").trim().toLowerCase();
  if (cleanDay(t)) return { startDate: t };
  const m = /^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([a-z]+)\.?\s+(\d{4})$/.exec(t);
  const month = m ? MONTH_WORDS[m[3]!] : undefined;
  if (!m || !month) return null;
  const day = (d: string) => `${m[4]}-${String(month).padStart(2, "0")}-${d.padStart(2, "0")}`;
  return cleanDateRange(day(m[1]!), m[2] ? day(m[2]) : undefined);
}

/** What every visitor may see: only the buildings that are shown. */
export function publicParkBuildings(raw: unknown): ParkBuilding[] {
  return cleanParkBuildings(raw).filter((b) => b.status !== "hidden");
}

/** Which building stands on which plot: the shown ones in list order, the rest of the plots empty. */
export function parkPlots(buildings: ParkBuilding[]) {
  const shown = buildings.filter((b) => b.status !== "hidden");
  return PARK.plots.map((p, i) => ({ plot: p as Box, building: shown[i] ?? null }));
}

/** Where to stand to read about the building on a plot: just in front of it. */
export function plotFront(i: number) {
  const p = PARK.plots[i]!;
  return { x: p.x + p.width / 2, y: p.y + p.height + 0.7 };
}

/** The plot whose front a walker at (x, y) stands at, or -1. */
export function plotAt(x: number, y: number) {
  return PARK.plots.findIndex((p) => x > p.x + 0.3 && x < p.x + p.width - 0.3 && y > p.y + p.height && y < p.y + p.height + 1.5);
}

/** Standing at the event building's door, to go back in. */
export function atParkDoor(x: number, y: number) {
  return Math.abs(x - PARK.arrive.x) < 1.6 && y > PARK.main.y + PARK.main.height && y < PARK.main.y + PARK.main.height + 1.6;
}

/** The lobby's door out to the park, in the bottom wall of the floor everyone comes in on. */
export function lobbyDoor(floor: { height: number }) {
  return { x: 10, y: floor.height - 1, width: 2, height: 1 };
}

/** Where you stand at the lobby door, and where you come back in from the park. */
export function lobbyDoorFront(floor: { height: number }) {
  return { x: 11, y: floor.height - 0.7 };
}

/** Standing at the lobby door, to go out. */
export function atLobbyDoor(floor: { height: number }, x: number, y: number) {
  return Math.abs(x - 11) < 1.4 && y > floor.height - 1.5;
}

/** The lobby door as a map object: a way out to the park. */
export function lobbyDoorObject(fair: { slug: string }, floorId: string, floor: { height: number }): MapObjectView {
  return {
    id: `${floorId}-park-door`,
    type: "door",
    ...lobbyDoor(floor),
    spriteKey: "park",
    isWalkable: true,
    targetFloorId: parkFloorId(fair),
    targetX: PARK.arrive.x,
    targetY: PARK.arrive.y,
  };
}

/** Where to stand to use the phone box: just in front of its door. */
export const PHONE_FRONT = { x: PARK.phoneBox.x + PARK.phoneBox.width / 2, y: PARK.phoneBox.y + PARK.phoneBox.height + 0.6 };

/** Standing at the phone box, to make a call. */
export function atPhoneBox(x: number, y: number) {
  const p = PARK.phoneBox;
  return Math.abs(x - PHONE_FRONT.x) < 1 && y > p.y + p.height && y < p.y + p.height + 1.4;
}

/** The park as a floor: buildings, the fountain, trees, flower beds, lamps and the props block;
 *  benches are seats; the sandbox is walkable. */
export function buildParkFloor(fair: { slug: string }): FloorView {
  const id = parkFloorId(fair);
  const pg = PARK.playground;
  const blocked: Box[] = [PARK.main, ...PARK.plots, PARK.fountain, ...PARK.beds, PARK.phoneBox, PARK.cart, PARK.bikes, PARK.signboard, pg.slide, pg.swing];
  for (const t of PARK.trees) blocked.push({ x: t.x - 0.35, y: t.y - 0.45, width: 0.7, height: 0.45 });
  for (const l of PARK.lamps) blocked.push({ x: l.x - 0.2, y: l.y - 0.3, width: 0.4, height: 0.3 });
  // A bench's backrest blocks; its seat is where you sit.
  for (const b of PARK.benches) blocked.push({ x: b.x, y: b.y, width: BENCH_W, height: 0.22 });
  const objects = blocked.map(
    (b, i): MapObjectView => ({ id: `${id}-obj-${i}`, type: "blocked", ...b, spriteKey: "invisible", isWalkable: false, targetFloorId: null, targetX: null, targetY: null }),
  );
  const seats: SeatView[] = PARK.benches.flatMap((b, n) =>
    [0.5, 1.5].map((dx, k) => ({
      id: `${id}-bench${n + 1}-${"AB"[k]}`,
      label: `Bangku ${n + 1}${"AB"[k]}`,
      tableId: null,
      x: b.x + dx,
      y: b.y + 0.5,
      isActive: true,
      sofa: true,
      facing: "front" as const,
    })),
  );
  return { id, name: "Taman", width: PARK.width, height: PARK.height, tables: [], seats, objects, theme: "park" };
}
