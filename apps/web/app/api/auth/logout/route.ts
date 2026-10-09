import { endSession } from "@vwo/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, sameOrigin } from "@/lib/http";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await endSession(db, token);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
