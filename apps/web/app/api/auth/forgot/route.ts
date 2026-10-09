import { requestPasswordReset } from "@vwo/db";
import { forgotSchema } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { appUrl, sendMail } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";

/** Always answers the same, so the form can't be used to find out which emails have accounts. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const body = await readBody(req, forgotSchema);
  if ("error" in body) return body.error;
  const { email } = body.data;
  if (!allow(`forgot:ip:${clientIp(req)}`, 10, 3600_000) || !allow(`forgot:email:${email}`, 3, 3600_000)) return fail(429, "too_many_requests");
  const token = await requestPasswordReset(db, email);
  if (token) await sendMail(email, "Reset password VWO Job Fair", `Klik link ini untuk membuat password baru (berlaku 1 jam):\n${appUrl()}/reset?token=${token}\n\nAbaikan email ini kalau kamu tidak memintanya.`);
  return NextResponse.json({ ok: true });
}
