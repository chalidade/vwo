import { createSession, googleSignIn } from "@vwo/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GOOGLE_COOKIE, finishGoogle, googleEnabled } from "@/lib/google";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Google sends the person back here: check the state, sign them in, and return to the fair. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const saved = (await cookies()).get(GOOGLE_COOKIE)?.value ?? "";
  const [state, verifier, to] = saved.split(".");
  const page = to === "company" ? "#/jobfair/company" : "#/jobfair";
  const done = (ok: boolean) => NextResponse.redirect(new URL(ok ? `/play/${page}` : `/play/?login=google_failed${page}`, req.url));
  const code = url.searchParams.get("code");
  if (!googleEnabled() || !code || !state || !verifier || url.searchParams.get("state") !== state) return clear(done(false));
  const person = await finishGoogle(req, code, verifier).catch(() => null);
  if (!person) return clear(done(false));
  const { userId } = await googleSignIn(db, person);
  const session = await createSession(db, userId, req.headers.get("user-agent"));
  const res = done(true);
  setSessionCookie(res, session.token, session.expiresAt);
  return clear(res);
}

function clear(res: NextResponse) {
  res.cookies.set(GOOGLE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}
