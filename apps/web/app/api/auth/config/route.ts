import { NextResponse } from "next/server";
import { passwordLogin } from "@/lib/auth-options";
import { googleEnabled } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Which sign-in options this server offers, so the game shows only the working ones. */
export function GET() {
  return NextResponse.json({ google: googleEnabled(), password: passwordLogin() });
}
