import { InvalidTokenError, verifyEmail } from "@vwo/db";
import { verifySchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!(await allow(`verify:${clientIp(req)}`, 30, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, verifySchema);
  if ("error" in body) return body.error;
  try {
    await verifyEmail(db, body.data.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof InvalidTokenError) return fail(400, "invalid_or_expired_link");
    throw e;
  }
}
