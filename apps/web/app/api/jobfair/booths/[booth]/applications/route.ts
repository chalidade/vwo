import { boothFairApplications, setFairApplicationStatus } from "@vwo/db";
import { fairApplicationStatusSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applicationOut, canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;

/** Applicants at one booth. Their contact details are personal data: only that company's accounts and event admins see them. */
export async function GET(_req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  const rows = await boothFairApplications(db, booth);
  return NextResponse.json({ applications: rows.map(applicationOut) });
}

/** The company moves an application along (seen, shortlisted, invited...). */
export async function PATCH(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  const body = await readBody(req, fairApplicationStatusSchema);
  if ("error" in body) return body.error;
  if (!(await setFairApplicationStatus(db, { id: body.data.id, boothKey: booth, status: body.data.status }))) return fail(404, "not_found");
  return NextResponse.json({ ok: true });
}
