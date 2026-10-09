import { NextResponse } from "next/server";

/** The link in an early-access invite: sign in with Google, then the job fair. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/api/auth/google/start?to=fair", req.url));
}
