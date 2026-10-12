import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { GOOGLE_COOKIE, googleEnabled, startGoogle } from "@/lib/google";
import { clientIp } from "@/lib/http";
import { googleRatePerDevice, googleRatePerIp } from "@/lib/limits";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** One device (address and browser) starting sign-in over and over is held back long before a whole venue's Wi-Fi is. */
async function mayStart(req: Request) {
  const ip = clientIp(req);
  const ua = createHash("sha256")
    .update(req.headers.get("user-agent") ?? "")
    .digest("base64url")
    .slice(0, 16);
  return (await allow(`google-ua:${ip}:${ua}`, googleRatePerDevice(), 600_000)) && (await allow(`google:${ip}`, googleRatePerIp(), 600_000));
}

/** Send the person to Google's account picker. */
export async function GET(req: Request) {
  const back = new URL("/play/#/jobfair", req.url);
  if (!googleEnabled() || !(await mayStart(req))) return NextResponse.redirect(back);
  const { url, cookie } = startGoogle(req);
  // Where to land after signing in: only known pages, never a URL from the query.
  const asked = new URL(req.url).searchParams.get("to") ?? "";
  const to = ["company", "admin", "register"].includes(asked) ? asked : "fair";
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_COOKIE, `${cookie}.${to}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  return res;
}
