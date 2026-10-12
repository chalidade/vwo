import { applicationsScheduledBetween, playersRemindedOn, readFairStateKey, reminderRecipients, seminarRegistrantIds } from "@vwo/db";
import {
  type ApplicationShared,
  type Reminder,
  aulaReminders,
  applicationReminders,
  nextDay,
  reminderMessage,
  rundownOf,
  seminarReminders,
  seminarSlots,
  wibDay,
  wibTime,
} from "@vwo/shared";
import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { reminderBudgetSec } from "@/lib/limits";
import { sendPush } from "@/lib/push";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Accounts handled at once: each is a few queries, an email and a push. */
const BATCH = 8;
/** Long enough that a second run the same WIB day finds the mark still there. */
const MARK_MS = 36 * 3_600_000;

/**
 * Every morning (06.00 WIB): each seeker with an interview, office visit, Aula item they asked to be
 * reminded of or seminar they registered for today gets one email and one push listing them; seminars
 * tomorrow (H-1) are added to it, or sent on their own when that is all. Each account is marked per day before
 * it is sent, so a repeated or overlapping run never sends twice. A run stops after REMINDER_BUDGET_SEC
 * and answers `more: true`: the next run (the scheduler calling again a few minutes later) skips the
 * marked accounts and carries on with the rest.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return fail(401, "unauthorized");
  if (!(await allow("cron:reminders", 12, 3_600_000))) return fail(429, "too_many_requests");

  const now = Date.now();
  const day = wibDay(now);
  const from = wibTime(day, "00.00")!;
  const [apps, players, org] = await Promise.all([applicationsScheduledBetween(db, from, from + 86_400_000 - 1), playersRemindedOn(db, day), readFairStateKey(db, "org")]);
  const rundown = rundownOf(org?.data);
  const tomorrowDay = nextDay(day);
  const slots = seminarSlots(org?.data).filter((s) => s.startAt !== undefined && [day, tomorrowDay].includes(wibDay(s.startAt)));
  const registrants = await seminarRegistrantIds(
    db,
    slots.map((s) => s.id),
  );

  const due = new Map<string, Reminder[]>();
  const add = (userId: string, list: Reminder[]) => list.length && due.set(userId, [...(due.get(userId) ?? []), ...list]);
  for (const a of apps) {
    const shared = (a.shared ?? {}) as ApplicationShared;
    add(a.userId, applicationReminders([{ id: a.id, company: a.company, jobTitle: a.jobTitle, status: a.status, interview: shared.interview, visit: shared.visit }], day));
  }
  for (const p of players) add(p.userId, aulaReminders(p.remind, rundown, day));
  // Seminars: today's join the day's list, tomorrow's (H-1) go in their own section.
  const tomorrow = new Map<string, Reminder[]>();
  for (const s of slots)
    for (const userId of registrants[s.id] ?? []) {
      add(userId, seminarReminders([s], [s.id], day));
      const later = seminarReminders([s], [s.id], tomorrowDay);
      if (later.length) tomorrow.set(userId, [...(tomorrow.get(userId) ?? []), ...later]);
    }

  const people = await reminderRecipients(db, [...new Set([...due.keys(), ...tomorrow.keys()])]);
  const url = `${appUrl()}/play/`;
  const deadline = now + reminderBudgetSec() * 1000;
  let left = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < people.length; i += BATCH) {
    if (Date.now() >= deadline) {
      left = people.length - i;
      break;
    }
    await Promise.all(
      people.slice(i, i + BATCH).map(async (u) => {
        const list = (due.get(u.id) ?? []).sort((a, b) => a.at - b.at);
        const later = (tomorrow.get(u.id) ?? []).sort((a, b) => a.at - b.at);
        if (!(await allow(`remind:${day}:${u.id}`, 1, MARK_MS))) return void skipped++;
        const msg = reminderMessage(u.name, day, list, url, later);
        await sendPush([u.id], { title: msg.push.title, body: msg.push.body, url: "/play/", tag: `remind:${day}` });
        // Only to the account's own address, and only once it is known to be theirs.
        if (u.verified) {
          try {
            await sendMail(u.email, msg.subject, msg.text);
          } catch (e) {
            failed++;
            console.warn("reminder mail failed", (e as Error).message);
            return;
          }
        }
        sent++;
      }),
    );
  }
  return NextResponse.json({ ok: true, day, due: due.size, tomorrow: tomorrow.size, sent, skipped, failed, left, more: left > 0 });
}
