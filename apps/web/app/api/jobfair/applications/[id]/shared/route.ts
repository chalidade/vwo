import { updateFairApplicationShared } from "@vwo/db";
import { applicationSharedPutSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chat, interview, rating and call log on one application, from the applicant or the company. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`shared:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, applicationSharedPutSchema);
  if ("error" in body) return body.error;
  if (body.data.as === "company" && !isFairAdmin(user)) return fail(403, "not_allowed");
  const ok = await updateFairApplicationShared(db, { id, as: body.data.as, userId: user.id, incoming: body.data.shared });
  return ok ? NextResponse.json({ ok: true }) : fail(404, "not_found");
}
