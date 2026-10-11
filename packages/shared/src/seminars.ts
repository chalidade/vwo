// The seminar programme's schedule: when each session starts (WIB), how long it runs, how many seats
// it has, who registered, and the reminders that follow from it. The organiser sets the sessions in
// the "org" document; registrations live on the server, one private document per session.
import { type Reminder, nextDay, wibClock, wibDay } from "./reminders";

const ID = /^[\w-]{1,80}$/;
/** Sessions far outside the event are a typo, not a plan. */
const EARLIEST = Date.UTC(2024, 0, 1);
const LATEST = Date.UTC(2040, 0, 1);
export const SEMINAR_MINUTES = { min: 5, max: 600, default: 60 } as const;
export const SEMINAR_CAPACITY_MAX = 10_000;
/** A session with no seat limit still stops at this many registrations (one server document). */
export const SEMINAR_REG_MAX = 5_000;

/** A session as far as the schedule cares; the rest (slides, speaker's role) is the game's. */
export interface SeminarSlot {
  id: string;
  title: string;
  speaker: string;
  /** Start, epoch ms; absent while the organiser hasn't set a date ("Jadwal belum ditentukan"). */
  startAt?: number;
  /** How long it runs, in minutes. */
  minutes: number;
  /** Seats; absent means no limit. */
  capacity?: number;
}

/** The schedule fields of a session as saved, cleaned: anything malformed is dropped. */
export function cleanSchedule(raw: { startAt?: unknown; minutes?: unknown; capacity?: unknown }): Pick<SeminarSlot, "startAt" | "minutes" | "capacity"> {
  const startAt = typeof raw.startAt === "number" && Number.isFinite(raw.startAt) && raw.startAt >= EARLIEST && raw.startAt < LATEST ? Math.floor(raw.startAt) : undefined;
  const m = typeof raw.minutes === "number" && Number.isFinite(raw.minutes) ? Math.round(raw.minutes) : SEMINAR_MINUTES.default;
  const minutes = Math.min(SEMINAR_MINUTES.max, Math.max(SEMINAR_MINUTES.min, m));
  const c = typeof raw.capacity === "number" && Number.isFinite(raw.capacity) ? Math.floor(raw.capacity) : 0;
  const capacity = c >= 1 ? Math.min(SEMINAR_CAPACITY_MAX, c) : undefined;
  return { startAt, minutes, capacity };
}

/** The organiser's sessions as saved in the "org" document (only well-formed ones), or none. */
export function seminarSlots(org: unknown): SeminarSlot[] {
  const list = org && typeof org === "object" ? (org as { seminars?: unknown }).seminars : undefined;
  if (!Array.isArray(list)) return [];
  const out: SeminarSlot[] = [];
  for (const s of list as Record<string, unknown>[]) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || !ID.test(s.id) || typeof s.title !== "string") continue;
    out.push({ id: s.id, title: s.title.slice(0, 120), speaker: typeof s.speaker === "string" ? s.speaker.slice(0, 60) : "", ...cleanSchedule(s) });
  }
  return out;
}

/** Sessions with a date first, earliest first; the undated ones after, in the organiser's order. */
export function sortByStart<T extends { startAt?: number }>(list: T[]): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.startAt ?? Infinity) - (b.s.startAt ?? Infinity) || a.i - b.i)
    .map((x) => x.s);
}

export type SeminarPhase = "unscheduled" | "upcoming" | "live" | "ended";

export function seminarPhase(s: Pick<SeminarSlot, "startAt" | "minutes">, now: number): SeminarPhase {
  if (s.startAt === undefined) return "unscheduled";
  if (now < s.startAt) return "upcoming";
  return now < s.startAt + s.minutes * 60_000 ? "live" : "ended";
}

/** Why a seeker can't register now, or null when they can. Registration stays open until the session ends. */
export function registerBlock(s: Pick<SeminarSlot, "startAt" | "minutes" | "capacity">, count: number, now: number): "unscheduled" | "ended" | "full" | null {
  const phase = seminarPhase(s, now);
  if (phase === "unscheduled" || phase === "ended") return phase;
  if (count >= (s.capacity ?? SEMINAR_REG_MAX)) return "full";
  return null;
}

/** "Senin, 12 Oktober 2026" for a WIB day. */
export const wibDate = (t: number, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  new Date(t).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", ...opts });

/** "Sen, 12 Okt · 10.00–11.00 WIB", or "Jadwal belum ditentukan". */
export function seminarWhen(s: Pick<SeminarSlot, "startAt" | "minutes">) {
  if (s.startAt === undefined) return "Jadwal belum ditentukan";
  return `${wibDate(s.startAt, { weekday: "short", day: "numeric", month: "short" })} · ${wibClock(s.startAt)}–${wibClock(s.startAt + s.minutes * 60_000)} WIB`;
}

/** The registrants in a session's document: { users: { "<user id>": <registered at> } }. */
export function registrantsOf(data: unknown): Record<string, number> {
  const users = data && typeof data === "object" ? (data as { users?: unknown }).users : undefined;
  if (!users || typeof users !== "object" || Array.isArray(users)) return {};
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(users as Record<string, unknown>)) if (ID.test(id) && typeof at === "number") out[id] = at;
  return out;
}

/** The registered sessions happening on `day` (WIB), as reminders. */
export function seminarReminders(slots: SeminarSlot[], registered: Iterable<string>, day: string): Reminder[] {
  const mine = new Set(registered);
  const out: Reminder[] = [];
  for (const s of slots) {
    if (!mine.has(s.id) || s.startAt === undefined || wibDay(s.startAt) !== day) continue;
    out.push({
      kind: "seminar",
      key: `sem:${s.id}:${s.startAt}`,
      at: s.startAt,
      title: `Seminar: ${s.title}`,
      where: s.speaker ? `Ruang Seminar · ${s.speaker}` : "Ruang Seminar",
    });
  }
  return out;
}

/** The day after today in WIB: the morning message's "besok" (H-1) list is for this day. */
export const tomorrowOf = (now: number) => nextDay(wibDay(now));

/** Pushes the server sends around a session: 15 minutes before, and when it starts. */
export type SeminarPushKind = "soon" | "start";
export const SOON_MINUTES = 15;

/**
 * The pushes due at `now`: "soon" from 15 minutes before the start until it starts, "start" during
 * the first 15 minutes (or the whole session when shorter). Each is sent once (the caller marks it).
 */
export function seminarPushesDue(slots: SeminarSlot[], now: number): { slot: SeminarSlot; kind: SeminarPushKind; mark: string }[] {
  const out: { slot: SeminarSlot; kind: SeminarPushKind; mark: string }[] = [];
  for (const s of slots) {
    if (s.startAt === undefined) continue;
    const kind: SeminarPushKind | null =
      now >= s.startAt - SOON_MINUTES * 60_000 && now < s.startAt ? "soon" : now >= s.startAt && now < s.startAt + Math.min(SOON_MINUTES, s.minutes) * 60_000 ? "start" : null;
    if (kind) out.push({ slot: s, kind, mark: seminarPushMark(s, kind) });
  }
  return out;
}

/** Once per session, time and kind: moving the session to another time sends again. */
export const seminarPushMark = (s: Pick<SeminarSlot, "id" | "startAt">, kind: SeminarPushKind) => `sempush:${s.id}:${s.startAt ?? 0}:${kind}`;

export function seminarPushMessage(s: SeminarSlot, kind: SeminarPushKind, now: number) {
  if (kind === "start")
    return {
      title: `🔴 Seminar dimulai: ${s.title}`,
      body: `${s.speaker ? `${s.speaker} sudah di panggung. ` : ""}Masuk ke Ruang Seminar sekarang.`,
      url: "/play/",
      tag: `sem:${s.id}`,
    };
  const minutes = s.startAt === undefined ? SOON_MINUTES : Math.max(1, Math.ceil((s.startAt - now) / 60_000));
  return {
    title: `⏰ ${minutes} menit lagi: ${s.title}`,
    body: `Jam ${wibClock(s.startAt ?? now)} WIB di Ruang Seminar${s.speaker ? ` bersama ${s.speaker}` : ""}.`,
    url: "/play/",
    tag: `sem:${s.id}`,
  };
}
