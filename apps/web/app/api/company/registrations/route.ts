import { createRegistration, myRegistrations, readPrices } from "@vwo/db";
import { priceFrom } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const schema = z.object({
  company: text(2, 60),
  industry: text(2, 60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  website: z.string().trim().max(120).url().or(z.literal("")),
  city: text(2, 60),
  contactName: text(2, 60),
  contactRole: text(2, 60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().regex(/^\+?[0-9 -]{8,20}$/),
  tier: z.enum(["regular", "premium"]),
  /** Hidden field: people leave it empty, bots fill it in. */
  website2: z.string().max(0).optional(),
});

/** What this account registered, with the booth code and PIN once the organiser verified it. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const rows = await myRegistrations(db, user.id);
  return NextResponse.json({ registrations: rows.map(({ verifiedBy: _v, userId: _u, ...r }) => ({ ...r, pin: r.status === "verified" ? r.pin : null })) });
}

/** A company account asks for a booth. The price comes from the organiser's price list. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`register-company:${user.id}`, 5, 86_400_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const open = (await myRegistrations(db, user.id)).filter((r) => r.status === "unpaid" || r.status === "paid");
  if (open.length >= 2) return fail(409, "too_many_open");
  const { website2: _h, ...input } = body.data;
  const price = priceFrom(await readPrices(db), `stand.${input.tier}`);
  const row = await createRegistration(db, { ...input, website: input.website || null, userId: user.id, price });
  return NextResponse.json({ registration: { ...row, pin: null } }, { status: 201 });
}
