import { findPrereg, preregByCode, preregEventBySlug } from "@vwo/db";
import { emailKey, isPreregSlug, normalizePreregCode, preregLookup } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readSizedBody, sameOrigin } from "@/lib/http";
import { ownRegistration } from "@/lib/prereg";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * See one's own sign-up again (to change it, or to show the code): the email and the code together.
 * Any mismatch, an unknown event included, answers the same 404, and tries are counted per address
 * and per email, so neither emails nor codes can be found by trying.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { slug } = await params;
  const ip = clientIp(req);
  if (!(await allow(`prereg-lookup:ip:${ip}`, 20, 600_000))) return fail(429, "too_many_requests");
  const body = await readSizedBody(req, preregLookup, 1_000);
  if ("error" in body) return body.error;
  if (!(await allow(`prereg-lookup:email:${body.data.email}`, 8, 600_000))) return fail(429, "too_many_requests");
  const code = normalizePreregCode(body.data.code);
  const found = isPreregSlug(slug) && code ? await preregEventBySlug(db, slug) : null;
  let row = found && code ? await findPrereg(db, found.event.id, body.data.email, code) : null;
  // The same Gmail inbox written another way (dots, +tag) is the same person: the code still has to match.
  if (found && code && !row) {
    const byCode = await preregByCode(db, found.event.id, code);
    if (byCode && emailKey(byCode.email) === emailKey(body.data.email)) row = byCode;
  }
  if (!found || !row) return fail(404, "not_found");
  return NextResponse.json({ registration: ownRegistration(row, found.event) }, { headers: { "Cache-Control": "no-store" } });
}
