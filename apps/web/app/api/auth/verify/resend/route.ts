import { newVerifyToken } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, sameOrigin } from "@/lib/http";
import { sendVerifyMail } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

/** Send the verification email again to the signed-in account. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });
  if (!(await allow(`verify-resend:${user.id}`, 3, 3600_000))) return fail(429, "too_many_requests");
  await sendVerifyMail(user.email, user.name, await newVerifyToken(db, user.id));
  return NextResponse.json({ ok: true });
}
