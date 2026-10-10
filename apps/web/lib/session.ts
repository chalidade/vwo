import "server-only";
import { SESSION_DAYS, sessionUser } from "@vwo/db";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "./db";

export const SESSION_COOKIE = "vwo_session";

/**
 * The signed-in user for this request, or null. `earlyOrganizer` marks an early-access tester the
 * organiser let in as panitia: they run the event like an admin.
 */
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await sessionUser(db, token);
  if (!user) return null;
  const { earlyRole, ...rest } = user;
  return { ...rest, earlyOrganizer: earlyRole === "organizer" };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
