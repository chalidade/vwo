import "server-only";
import { readFairStateKey, seminarRegistrantIds } from "@vwo/db";
import { type SeminarPushKind, type SeminarSlot, seminarPushMark, seminarPushMessage, seminarPushesDue, seminarSlots } from "@vwo/shared";
import { after } from "next/server";
import { db } from "./db";
import { sendPush } from "./push";
import { allow } from "./ratelimit";

/** Long enough to outlast the push windows, so each mark is only ever used once. */
const MARK_MS = 48 * 3_600_000;
/** Going live up to this long before the scheduled start counts as the session starting. */
const EARLY_MS = 30 * 60_000;
/** Marks this instance already used (or saw used): no database round trip for them again. */
const used = new Set<string>();

/** The organiser's seminar sessions as saved on the server. */
export async function orgSeminars(): Promise<SeminarSlot[]> {
  return seminarSlots((await readFairStateKey(db, "org"))?.data);
}

/** Take a push's mark: true for exactly one caller across every instance. */
async function claim(mark: string) {
  if (used.has(mark)) return false;
  used.add(mark);
  if (used.size > 500) used.delete(used.values().next().value!);
  return allow(mark, 1, MARK_MS);
}

/** Push one session's message to everyone registered for it. */
async function pushSession(slot: SeminarSlot, kind: SeminarPushKind, now: number) {
  const ids = (await seminarRegistrantIds(db, [slot.id]))[slot.id] ?? [];
  if (ids.length) await sendPush(ids, seminarPushMessage(slot, kind, now));
  return ids.length;
}

/** "15 minutes to go" and "starting now" for the sessions due at `now`, each once. Returns how many people were sent to. */
export async function sendSeminarPushes(slots: SeminarSlot[], now: number) {
  let sent = 0;
  for (const d of seminarPushesDue(slots, now)) if (await claim(d.mark)) sent += await pushSession(d.slot, d.kind, now);
  return sent;
}

/**
 * Vercel Hobby only runs cron once a day, too coarse for "15 minutes before". So every visitor's read
 * of the event setup also checks the clock, from the organiser document it has in hand, and sends
 * what is due after the response has gone. /api/cron/seminars does the same on a schedule.
 */
export function kickSeminarPushes(org: unknown, now = Date.now()) {
  const due = seminarPushesDue(seminarSlots(org), now).filter((d) => !used.has(d.mark));
  if (!due.length) return;
  after(() => sendSeminarPushes(seminarSlots(org), now).catch((e: Error) => console.warn("seminar push failed", e.message)));
}

/**
 * The speaker went live: everyone registered hears it is starting, once. Going live early also uses up
 * the "15 minutes to go" push, which would only confuse once the talk is on.
 */
export async function announceSeminarStart(slot: SeminarSlot, now: number) {
  // A rehearsal hours before isn't the session starting.
  if (slot.startAt === undefined || now < slot.startAt - EARLY_MS || now >= slot.startAt + slot.minutes * 60_000) return 0;
  await claim(seminarPushMark(slot, "soon"));
  if (!(await claim(seminarPushMark(slot, "start")))) return 0;
  return pushSession(slot, "start", now);
}
