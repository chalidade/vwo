import { applyConsultant, readConsultants, readPrices, setConsultantOpen, updateConsultantProfile } from "@vwo/db";
import { BOT_CONSULTANTS, freeConsultDesks, isOpenNow, priceFrom } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consultContact, consultProfile } from "@/lib/consultants";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const applySchema = z.object({ profile: consultProfile, contact: consultContact });
const profileSchema = z.object({ profile: consultProfile });
const openSchema = z.object({ open: z.boolean() });

/** This account as a consultant: its desk (if any), its application, and the free desks with the slot price. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const s = await readConsultants(db);
  const mine = s.placed.find((p) => p.by === user.id);
  const request = s.requests.find((r) => r.userId === user.id) ?? null;
  return NextResponse.json(
    {
      consultant: mine ? { ...mine, open: isOpenNow(mine, Date.now()) } : null,
      request,
      freeDesks: freeConsultDesks(BOT_CONSULTANTS, s.botsOff, s.placed),
      price: priceFrom(await readPrices(db), "consult.slot"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Apply to the organiser for a desk (free; the organiser approves it), or change an application still waiting. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`consult-apply:${user.id}`, 10, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, applySchema);
  if ("error" in body) return body.error;
  const r = await applyConsultant(db, { userId: user.id, email: body.data.contact.email, phone: body.data.contact.phone, profile: body.data.profile });
  if ("error" in r) return fail(409, r.error);
  return NextResponse.json({ ok: true, request: r.result }, { status: 201 });
}

/** The desk owner edits the profile visitors see. */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`consult-edit:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, profileSchema);
  if ("error" in body) return body.error;
  const r = await updateConsultantProfile(db, user.id, body.data.profile);
  if ("error" in r) return fail(404, r.error);
  return NextResponse.json({ ok: true });
}

/** The desk owner opens the desk (the page repeats this every minute while it is open) or closes it. */
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`consult-open:${user.id}`, 150, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, openSchema);
  if ("error" in body) return body.error;
  const r = await setConsultantOpen(db, user.id, body.data.open);
  if ("error" in r) return fail(404, r.error);
  return NextResponse.json({ ok: true, open: body.data.open, until: r.result.openUntil ?? 0 });
}
