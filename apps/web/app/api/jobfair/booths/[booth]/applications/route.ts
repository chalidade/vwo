import { boothFairApplications, setFairApplicationNotes, setFairApplicationStatus } from "@vwo/db";
import { fairApplicationStatusSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { applicationOut, canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
const patchSchema = z.union([fairApplicationStatusSchema, z.object({ id: z.string().uuid(), notes: z.string().max(1000) })]);

/** Applicants at one booth. Their contact details are personal data: only that company's accounts and event admins see them. */
export async function GET(_req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  const rows = await boothFairApplications(db, booth);
  // The company's own notes go only to the company, never back to the applicant.
  return NextResponse.json({ applications: rows.map((r) => ({ ...applicationOut(r), notes: r.companyNotes })) });
}

/** The company moves an application along (seen, shortlisted, invited...), or saves its private notes on it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await canManageBooth(user, booth))) return fail(403, "not_allowed");
  const body = await readBody(req, patchSchema);
  if ("error" in body) return body.error;
  const b = body.data;
  const ok = "notes" in b ? await setFairApplicationNotes(db, { id: b.id, boothKey: booth, notes: b.notes }) : await setFairApplicationStatus(db, { id: b.id, boothKey: booth, status: b.status });
  if (!ok) return fail(404, "not_found");
  return NextResponse.json({ ok: true });
}
