import { NextResponse } from "next/server";

/** The organisers' way in before launch: sign in with Google, then the organiser pages. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/api/auth/google/start?to=admin", req.url));
}
