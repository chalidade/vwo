// Reminders for a seeker's interviews, office visits and the Aula programme they asked to be
// reminded of: the server's morning email and push, and the game's own alerts shortly before.
// Times are Indonesian Western Time (WIB, UTC+7, no daylight saving), whatever the device's zone.
import { type AulaEvent, DEFAULT_RUNDOWN } from "./aula";
import type { ApplicationShared } from "./fair-api";

const WIB_MS = 7 * 3_600_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^(\d{2})[.:](\d{2})$/;
const ID = /^[\w-]{1,80}$/;

/** The day in WIB ("2026-10-11") at time `t`. */
export const wibDay = (t: number) => new Date(t + WIB_MS).toISOString().slice(0, 10);

/** "09.30", the clock in WIB at time `t`. */
export function wibClock(t: number) {
  const d = new Date(t + WIB_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** The moment `hhmm` ("09.30") happens in WIB on `day`, or null when either is malformed. */
export function wibTime(day: string, hhmm: string): number | null {
  const m = CLOCK.exec(hhmm);
  if (!DAY.test(day) || !m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) ? null : t - WIB_MS + (h * 60 + min) * 60_000;
}

/** The day after `day`. */
export const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** One thing on a seeker's schedule. */
export interface Reminder {
  kind: "interview" | "visit" | "aula";
  /** Stable per event and time, so an alert for it fires once. */
  key: string;
  at: number;
  title: string;
  /** Where: an address, a video call link, or a room at the fair. */
  where?: string;
}

/** An application as far as reminders care. */
export interface ReminderApplication {
  id: string;
  company: string;
  jobTitle: string;
  status: string;
  interview?: ApplicationShared["interview"];
  visit?: ApplicationShared["visit"];
}

/** Rundown ids the seeker wants to be reminded of, per WIB day: { "2026-10-11": ["talk1"] }. */
export type RemindList = Record<string, string[]>;

/** At most this many days and items per day are kept; older days go when a new one is added. */
const REMIND_DAYS = 7;
const REMIND_PER_DAY = 30;

/** The seeker's remind list as saved (anything else is dropped): it comes back from their own device. */
export function cleanRemind(raw: unknown): RemindList {
  const out: RemindList = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [day, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!DAY.test(day) || !Array.isArray(ids)) continue;
    const ok = [...new Set(ids.filter((x): x is string => typeof x === "string" && ID.test(x)))].slice(0, REMIND_PER_DAY);
    if (ok.length) out[day] = ok;
  }
  return out;
}

/** Turn the reminder for rundown item `id` on `day` on or off; days before `today` are dropped. */
export function toggleRemind(raw: unknown, day: string, id: string, today: string): RemindList {
  const list = cleanRemind(raw);
  const ids = list[day] ?? [];
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-REMIND_PER_DAY);
  if (next.length) list[day] = next;
  else delete list[day];
  const days = Object.keys(list)
    .filter((d) => d >= today)
    .sort()
    .slice(0, REMIND_DAYS);
  return Object.fromEntries(days.map((d) => [d, list[d]!]));
}

/**
 * The day a reminder for rundown item `e` is for: today while it hasn't started yet, otherwise
 * tomorrow (the rundown is the same every day until the organiser changes it).
 */
export function remindDayFor(e: Pick<AulaEvent, "start">, now: number) {
  const today = wibDay(now);
  const at = wibTime(today, e.start);
  return at !== null && at > now ? today : nextDay(today);
}

/** The interview and office visit of each application that happen on `day` (WIB). */
export function applicationReminders(list: ReminderApplication[], day: string): Reminder[] {
  const out: Reminder[] = [];
  for (const a of list) {
    if (a.status === "Belum cocok") continue;
    const iv = a.interview;
    if (iv && validAt(iv.at) && wibDay(iv.at) === day && iv.reply !== "jadwal-ulang") {
      out.push({ kind: "interview", key: `iv:${a.id}:${iv.at}`, at: iv.at, title: `Interview ${a.jobTitle} · ${a.company}`, where: [iv.mode, iv.place].filter(Boolean).join(" · ") || undefined });
    }
    const v = a.visit;
    if (v && validAt(v.at) && wibDay(v.at) === day && v.reply !== "jadwal-ulang") {
      out.push({ kind: "visit", key: `visit:${a.id}:${v.at}`, at: v.at, title: `Kunjungan kantor ${a.company}`, where: v.address });
    }
  }
  return out;
}

/** The rundown items the seeker asked to be reminded of on `day`. Items the organiser removed are skipped. */
export function aulaReminders(remind: unknown, rundown: AulaEvent[], day: string): Reminder[] {
  const ids = cleanRemind(remind)[day] ?? [];
  const out: Reminder[] = [];
  for (const id of ids) {
    const e = rundown.find((x) => x.id === id);
    const at = e ? wibTime(day, e.start) : null;
    if (!e || at === null) continue;
    out.push({ kind: "aula", key: `aula:${id}:${at}`, at, title: e.title, where: e.place || "Panggung Aula · Lantai 1" });
  }
  return out;
}

/** Everything on one seeker's schedule on `day`, earliest first. */
export function dueReminders(input: { day: string; applications: ReminderApplication[]; remind: unknown; rundown: AulaEvent[] }): Reminder[] {
  return [...applicationReminders(input.applications, input.day), ...aulaReminders(input.remind, input.rundown, input.day)].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/** The organiser's rundown as saved in the "org" document, or the default one. */
export function rundownOf(org: unknown): AulaEvent[] {
  const list = org && typeof org === "object" ? (org as { rundown?: unknown }).rundown : undefined;
  if (!Array.isArray(list)) return DEFAULT_RUNDOWN;
  return list.filter((e): e is AulaEvent => !!e && typeof e === "object" && typeof e.id === "string" && typeof e.start === "string" && typeof e.title === "string");
}

/** In the game, alerts this long before an event starts (minutes). */
export const ALERT_MINUTES = [60, 10] as const;

/**
 * The alerts to show now: for each event not started yet, the latest of its alert marks that has
 * passed, unless it was shown already (`shown` holds "<key>@<minutes>"). Opening the game five
 * minutes before an interview shows only the ten-minute alert, not both.
 */
export function alertsDue(list: Reminder[], now: number, shown: ReadonlySet<string>) {
  const out: { reminder: Reminder; mark: string; minutes: number }[] = [];
  for (const r of list) {
    if (now >= r.at) continue;
    const passed = ALERT_MINUTES.filter((m) => now >= r.at - m * 60_000);
    if (!passed.length) continue;
    const latest = Math.min(...passed);
    if (shown.has(`${r.key}@${latest}`)) continue;
    out.push({ reminder: r, mark: `${r.key}@${latest}`, minutes: Math.max(1, Math.ceil((r.at - now) / 60_000)) });
  }
  return out;
}

const KIND_EMOJI: Record<Reminder["kind"], string> = { interview: "💼", visit: "🏢", aula: "🎤" };

/** The morning message: an email (subject and text) and a short push notification. */
export function reminderMessage(name: string, day: string, list: Reminder[], url: string) {
  const date = new Date(Date.parse(`${day}T12:00:00Z`)).toLocaleDateString("id-ID", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const lines = list.map((r) => `${KIND_EMOJI[r.kind]} ${wibClock(r.at)} WIB · ${r.title}${r.where ? `\n   ${r.where}` : ""}`);
  const n = list.length;
  const subject = n === 1 ? `Pengingat: ${list[0]!.title} jam ${wibClock(list[0]!.at)} hari ini` : `Pengingat: ${n} jadwal kamu hari ini`;
  const text = [
    `Halo ${name || "kamu"},`,
    "",
    `Ini jadwal kamu hari ini, ${date}:`,
    "",
    ...lines,
    "",
    "Datang tepat waktu ya. Untuk interview online, buka job fair beberapa menit sebelumnya supaya HR bisa menelepon kamu.",
    `Buka job fair: ${url}`,
    "",
    "Semoga lancar!",
    "",
    "Kamu menerima email ini karena punya jadwal interview atau minta diingatkan acara di jobfair.",
  ].join("\n");
  const push = {
    title: n === 1 ? `⏰ Hari ini ${wibClock(list[0]!.at)}: ${list[0]!.title}` : `⏰ ${n} jadwal kamu hari ini`,
    body: n === 1 ? (list[0]!.where ?? "Semoga lancar!") : list.map((r) => `${wibClock(r.at)} ${r.title}`).join(" · "),
  };
  return { subject, text, push };
}

function validAt(t: unknown): t is number {
  return typeof t === "number" && Number.isFinite(t) && t > 0;
}
