import { NextResponse } from "next/server";

/** The link in the verification email: sign in with Google, then the company portal. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/api/auth/google/start?to=company", req.url));
}
