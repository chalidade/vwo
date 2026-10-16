import { SELLER_KEY, writeFairState } from "@vwo/db";
import { cleanSeller } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwnerAdmin } from "@/lib/fair";
import { fail, readCapped, sameOrigin } from "@/lib/http";
import { readSeller } from "@/lib/invoices";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The organiser as seller on invoices: name, address, NPWP, PKP, PPN rate and bank account. Only
 * the event's own admins (not early-access panitia testers) read and change it here; buyers see the
 * parts that go on their invoice through /api/invoices.
 */
export async function GET() {
  const user = await currentUser();
  if (!isOwnerAdmin(user)) return fail(403, "not_allowed");
  return NextResponse.json({ seller: await readSeller() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user || !isOwnerAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`invoice-seller:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const text = await readCapped(req, 4_000);
  if (text === null) return fail(413, "too_large");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, "invalid_input");
  }
  const seller = cleanSeller(raw);
  if (!seller) return fail(400, "invalid_input", { field: "npwp" });
  await writeFairState(db, { key: SELLER_KEY, data: seller, userId: user.id });
  return NextResponse.json({ seller });
}
