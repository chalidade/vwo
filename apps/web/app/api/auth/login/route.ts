import { InvalidLoginError, checkLogin, createSession } from "@vwo/db";
import { loginSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const body = await readBody(req, loginSchema);
  if ("error" in body) return body.error;
  const { email, password } = body.data;
  // Per address and per account, so one person can't guess passwords and one account can't be hammered.
  if (!allow(`login:ip:${clientIp(req)}`, 30, 600_000) || !allow(`login:email:${email}`, 10, 600_000)) return fail(429, "too_many_requests");
  try {
    const userId = await checkLogin(db, email, password);
    const session = await createSession(db, userId, req.headers.get("user-agent"));
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, session.token, session.expiresAt);
    return res;
  } catch (e) {
    if (e instanceof InvalidLoginError) return fail(401, "wrong_email_or_password");
    throw e;
  }
}
