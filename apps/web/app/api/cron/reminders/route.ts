import { timingSafeEqual } from "node:crypto";
import { applicationsScheduledBetween, playersRemindedOn, readFairStateKey, reminderRecipients } from "@vwo/db";
import { type ApplicationShared, type Reminder, aulaReminders, applicationReminders, reminderMessage, rundownOf, wibDay, wibTime } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Accounts handled at once: each is a few queries, an email and a push. */
const BATCH = 8;
/** Long enough that a second run the same WIB day finds the mark still there. */
const MARK_MS = 36 * 3_600_000;

/**
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set. Without
 * the secret it only runs in development, so nobody else can make the server send email.
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Every morning (06.00 WIB): each seeker with an interview, office visit or Aula item they asked to be
 * reminded of today gets one email and one push listing them. Each account is marked per day before
 * it is sent, so a repeated or overlapping run never sends twice.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return fail(401, "unauthorized");
  if (!(await allow("cron:reminders", 12, 3_600_000))) return fail(429, "too_many_requests");

  const now = Date.now();
  const day = wibDay(now);
  const from = wibTime(day, "00.00")!;
  const [apps, players, org] = await Promise.all([applicationsScheduledBetween(db, from, from + 86_400_000 - 1), playersRemindedOn(db, day), readFairStateKey(db, "org")]);
  const rundown = rundownOf(org?.data);

  const due = new Map<string, Reminder[]>();
  const add = (userId: string, list: Reminder[]) => list.length && due.set(userId, [...(due.get(userId) ?? []), ...list]);
  for (const a of apps) {
    const shared = (a.shared ?? {}) as ApplicationShared;
    add(a.userId, applicationReminders([{ id: a.id, company: a.company, jobTitle: a.jobTitle, status: a.status, interview: shared.interview, visit: shared.visit }], day));
  }
  for (const p of players) add(p.userId, aulaReminders(p.remind, rundown, day));

  const people = await reminderRecipients(db, [...due.keys()]);
  const url = `${appUrl()}/play/`;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < people.length; i += BATCH) {
    await Promise.all(
      people.slice(i, i + BATCH).map(async (u) => {
        const list = due.get(u.id)!.sort((a, b) => a.at - b.at);
        if (!(await allow(`remind:${day}:${u.id}`, 1, MARK_MS))) return void skipped++;
        const msg = reminderMessage(u.name, day, list, url);
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
  return NextResponse.json({ ok: true, day, due: due.size, sent, skipped, failed });
}
