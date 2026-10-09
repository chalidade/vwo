import { NextResponse } from "next/server";
import { GOOGLE_COOKIE, googleEnabled, startGoogle } from "@/lib/google";
import { clientIp } from "@/lib/http";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Send the person to Google's account picker. */
export async function GET(req: Request) {
  const back = new URL("/play/#/jobfair", req.url);
  if (!googleEnabled() || !(await allow(`google:${clientIp(req)}`, 30, 600_000))) return NextResponse.redirect(back);
  const { url, cookie } = startGoogle(req);
  // Where to land after signing in: only known pages, never a URL from the query.
  const asked = new URL(req.url).searchParams.get("to") ?? "";
  const to = ["company", "admin", "register"].includes(asked) ? asked : "fair";
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_COOKIE, `${cookie}.${to}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  return res;
}
