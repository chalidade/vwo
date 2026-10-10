import { addEvents, addStats, boothsOf, recentEvents, statTotals } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { maybeCleanup } from "@/lib/cleanup";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ID = "[\\w-]{1,80}";
const KEY = new RegExp(`^(visit:${ID}|sponsor:${ID}|acc:${ID}:[\\w-]{1,40}|promo:${ID}|stall:${ID}|seminar:${ID})$`);
const hit = z
  .object({ key: z.string().regex(KEY), what: z.enum(["view", "click", "sold"]), coins: z.number().int().min(0).max(500).optional() })
  // Sales are vouchers bought at a stall and free coffee; merchandise goes through /api/jobfair/merch.
  .refine((h) => h.what !== "sold" || h.key.startsWith("stall:") || h.key.endsWith(":coffee"))
  .refine((h) => !h.coins || (h.what === "sold" && h.key.startsWith("stall:")));
const event = z.object({
  type: z.enum(["arrive", "visit", "apply", "leave", "sponsor", "rate", "review", "room", "coins"]),
  name: z.string().trim().min(1).max(40),
  company: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(80).optional(),
});
const schema = z.object({ hits: z.array(hit).max(50).default([]), events: z.array(event).max(10).default([]) });

/**
 * Reach counters. Everyone gets booth visits, seminar attendance and how much merchandise is gone;
 * a company also its own booth's decorations and promoter; event admins everything, with the live feed.
 */
export async function GET() {
  const user = await currentUser();
  const admin = isFairAdmin(user);
  const all = await statTotals(db);
  if (admin) return NextResponse.json({ stats: all, events: await recentEvents(db) }, { headers: { "Cache-Control": "no-store" } });
  const mine = user ? await boothsOf(db, user.id) : [];
  const own = (k: string) => mine.some((b) => k.startsWith(`acc:${b}:`) || k === `promo:co-${b}`);
  const stats = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("visit:") || k.startsWith("seminar:") || (k.startsWith("acc:") && k.endsWith(":giveaway")) || own(k)));
  return NextResponse.json({ stats }, { headers: { "Cache-Control": "no-store" } });
}

/** What the signed-in player did since the last send: views, clicks and sales, and lines for the live feed. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  maybeCleanup();
  if (!(await allow(`stats:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const day = new Date().toISOString().slice(0, 10);
  await addStats(db, user.id, day, body.data.hits);
  await addEvents(db, user.id, body.data.events);
  return NextResponse.json({ ok: true });
}
