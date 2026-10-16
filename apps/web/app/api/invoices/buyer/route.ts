import { buyerKey, writeFairState } from "@vwo/db";
import { cleanBuyer } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, readCapped, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Save who this account's invoices are made out to: company or agency, NPWP, address, email. */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`invoice-buyer:${user.id}`, 20, 600_000))) return fail(429, "too_many_requests");
  const text = await readCapped(req, 4_000);
  if (text === null) return fail(413, "too_large");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, "invalid_input");
  }
  const got = cleanBuyer(raw);
  if ("error" in got) return fail(400, "invalid_input", { field: got.error });
  await writeFairState(db, { key: buyerKey(user.id), data: got.buyer, userId: user.id });
  return NextResponse.json({ buyer: got.buyer });
}
