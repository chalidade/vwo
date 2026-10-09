import { readFairState, writeFairState } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const KEY = /^(org|company:[\w-]{1,80})$/;
/** Logos and booth media are small inline images; a whole setup stays well under this. */
const MAX_BYTES = 2_000_000;

type Doc = Record<string, unknown>;

/**
 * The event as the organiser and the companies set it up, for every visitor's game.
 * Company PINs, stand bookings (contact details) and invoices go to event admins only.
 */
export async function GET() {
  const admin = isFairAdmin(await currentUser());
  const rows = await readFairState(db);
  let org: Doc | null = null;
  const companies: Record<string, Doc> = {};
  let version = 0;
  for (const r of rows) {
    version = Math.max(version, r.updatedAt.getTime());
    const data = r.data as Doc;
    if (r.key === "org") {
      const { pins, bookings, ...rest } = data;
      org = admin ? data : rest;
    } else {
      const { invoices, ...rest } = data;
      companies[r.key.slice("company:".length)] = admin ? data : { ...rest, invoices: [] };
    }
  }
  return NextResponse.json({ org, companies, version, admin }, { headers: { "Cache-Control": "no-store" } });
}

/** Save the organiser's setup or one company's booth. Event admins only during the trial. */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
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
  await writeFairState(db, { key: body.key, data: body.data, userId: user.id });
  return NextResponse.json({ ok: true });
}
