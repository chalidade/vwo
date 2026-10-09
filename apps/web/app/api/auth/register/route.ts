import { EmailTakenError, createSession, sessionUser, register } from "@vwo/db";
import { registerSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { passwordLogin } from "@/lib/auth-options";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { sendVerifyMail } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";
import { setPreview } from "@/lib/preview-grant";
import { setSessionCookie } from "@/lib/session";
import { isHuman } from "@/lib/turnstile";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!passwordLogin()) return fail(403, "password_login_off");
  const ip = clientIp(req);
  if (!(await allow(`register:${ip}`, 10, 3600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, registerSchema);
  if ("error" in body) return body.error;
  const { email, password, name, website, captcha } = body.data;
  // A filled hidden field or a failed Turnstile check means a script, not a person.
  if (website || !(await isHuman(captcha, ip))) return fail(400, "not_human");
  try {
    const { userId, verifyToken } = await register(db, { email, password, name });
    const session = await createSession(db, userId, req.headers.get("user-agent"));
    // The account exists either way; a mail outage must not leave the new seeker signed out.
    await sendVerifyMail(email, name, verifyToken).catch((e) => console.error("[mail] verification email failed", e));
    const res = NextResponse.json({ ok: true, user: { id: userId, email, name, emailVerified: false } }, { status: 201 });
    setSessionCookie(res, session.token, session.expiresAt);
    await setPreview(res, await sessionUser(db, session.token));
    return res;
  } catch (e) {
    if (e instanceof EmailTakenError) return fail(409, "email_taken");
    throw e;
  }
}
