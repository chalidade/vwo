import { boothsOf, readFairState, writeFairState } from "@vwo/db";
import { NextResponse } from "next/server";
import { guardCompanyDoc } from "@/lib/company-doc";
import { db } from "@/lib/db";
import { canManageBooth, isFairAdmin } from "@/lib/fair";
import { fail, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { rentedOut } from "@/lib/stalls";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const KEY = /^(org|company:[\w-]{1,80})$/;
/** Logos and booth media are small inline images; a whole setup stays well under this. */
const MAX_BYTES = 2_000_000;

type Doc = Record<string, unknown>;

/**
 * The event as the organiser and the companies set it up, for every visitor's game.
 * Company PINs and stand bookings (contact details) go to event admins only, and a company's
 * invoices to that company's accounts and the admins.
 */
export async function GET() {
  const user = await currentUser();
  const admin = isFairAdmin(user);
  const mine = new Set(user ? await boothsOf(db, user.id) : []);
  const rows = await readFairState(db);
  let org: Doc | null = null;
  const companies: Record<string, Doc> = {};
  const bookings: Doc[] = [];
  const stalls: unknown[] = [];
  let version = 0;
  for (const r of rows) {
    version = Math.max(version, r.updatedAt.getTime());
    const data = r.data as Doc;
    if (r.key === "org") {
      const { pins, bookings: _b, ...rest } = data;
      org = admin ? data : rest;
    } else if (r.key.startsWith("booking:")) {
      // A stand a company booked itself: everyone sees the booth, admins also the booking and PIN.
      bookings.push(admin ? { booth: data.booth, booking: data.booking, pin: data.pin } : { booth: data.booth });
    } else if (r.key.startsWith("stall:")) {
      // A food court stand a business paid for: everyone sees it, admins also who paid.
      stalls.push(rentedOut(data, admin));
    } else if (r.key.startsWith("company:")) {
      const id = r.key.slice("company:".length);
      const { invoices, ...rest } = data;
      companies[id] = admin || mine.has(id) ? data : { ...rest, invoices: [] };
    }
  }
  return NextResponse.json({ org, companies, bookings, stalls, version, admin, booths: [...mine] }, { headers: { "Cache-Control": "no-store" } });
}

/** Save the organiser's setup (event admins) or one company's booth (its accounts, or admins). */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`state:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const text = await req.text();
  if (text.length > MAX_BYTES) return fail(413, "too_large");
  let body: { key?: unknown; data?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, "invalid_input");
  }
  if (typeof body.key !== "string" || !KEY.test(body.key) || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) return fail(400, "invalid_input");
  const admin = isFairAdmin(user);
  const booth = body.key.startsWith("company:") ? body.key.slice("company:".length) : null;
  if (!admin && !(booth && (await canManageBooth(user, booth)))) return fail(403, "not_allowed");
  // A company's own save can't mark bills paid or unlock products; only confirmed payments do.
  const data = admin || !booth ? body.data : await guardCompanyDoc(booth, body.data as Parameters<typeof guardCompanyDoc>[1]);
  await writeFairState(db, { key: body.key, data, userId: user.id });
  return NextResponse.json({ ok: true });
}
