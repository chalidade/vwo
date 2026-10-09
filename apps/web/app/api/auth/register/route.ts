import { EmailTakenError, createSession, register } from "@vwo/db";
import { registerSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!(await allow(`register:${clientIp(req)}`, 10, 3600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, registerSchema);
  if ("error" in body) return body.error;
  const { email, password, name } = body.data;
  try {
    const { userId, verifyToken } = await register(db, { email, password, name });
    const session = await createSession(db, userId, req.headers.get("user-agent"));
    // The account exists either way; a mail outage must not leave the new seeker signed out.
    await sendMail(email, "Verifikasi email VWO Job Fair", `Halo ${name},\n\nKlik link ini untuk memverifikasi email kamu (berlaku 48 jam):\n${appUrl()}/verify?token=${verifyToken}\n`).catch((e) =>
      console.error("[mail] verification email failed", e),
    );
    const res = NextResponse.json({ ok: true, user: { id: userId, email, name, emailVerified: false } }, { status: 201 });
    setSessionCookie(res, session.token, session.expiresAt);
    return res;
  } catch (e) {
    if (e instanceof EmailTakenError) return fail(409, "email_taken");
    throw e;
  }
}
