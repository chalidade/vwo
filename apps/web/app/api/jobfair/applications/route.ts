import { AlreadyAppliedError, TooManyApplicationsError, myFairApplications, submitFairApplication } from "@vwo/db";
import { fairApplicationSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applicationOut } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { mailEnabled } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";
import { liveCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** The signed-in seeker's applications, so every device shows the same list. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const rows = await myFairApplications(db, user.id);
  return NextResponse.json({ applications: rows.map(applicationOut) });
}

/** Send an application to a booth. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  // Once email really goes out, only verified addresses can apply: a bot can make accounts, not inboxes.
  if (mailEnabled() && !user.emailVerifiedAt) return fail(403, "email_not_verified");
  if (!(await allow(`apply:${user.id}`, 30, 3600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, fairApplicationSchema);
  if ("error" in body) return body.error;
  const { boothId, jobId, ...rest } = body.data;
  try {
    // The blue check companies see comes from the coin ledger, not from what the browser says.
    const { verified } = await liveCoins(user.id);
    const row = await submitFairApplication(db, { userId: user.id, boothKey: boothId, jobKey: jobId, data: { boothId, jobId, ...rest, verified } });
    return NextResponse.json({ application: applicationOut(row) }, { status: 201 });
  } catch (e) {
    if (e instanceof AlreadyAppliedError) return fail(409, "already_applied");
    if (e instanceof TooManyApplicationsError) return fail(429, "too_many_applications");
    throw e;
  }
}
