import { InvalidTokenError, resetPassword } from "@vwo/db";
import { resetSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { clearSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!(await allow(`reset:${clientIp(req)}`, 20, 3600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, resetSchema);
  if ("error" in body) return body.error;
  try {
    await resetPassword(db, body.data.token, body.data.password);
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (e) {
    if (e instanceof InvalidTokenError) return fail(400, "invalid_or_expired_link");
    throw e;
  }
}
