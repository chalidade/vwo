import "server-only";
import { addBoothMember, boothsOf, earlyAccessFor, hasVerifiedRegistration } from "@vwo/db";
import type { NextResponse } from "next/server";
import { db } from "./db";
import { isFairAdmin } from "./fair";
import { PREVIEW_COOKIE, PREVIEW_DAYS, signPreview } from "./preview";

/**
 * Organisers, early-access testers, accounts that run a booth, and companies the organiser verified
 * may use the app before launch. A company tester is given their trial booth here, on sign-in.
 */
export async function mayPreview(user: { id: string; email: string; role: string } | null) {
  if (!user) return false;
  if (isFairAdmin(user)) return true;
  const early = await earlyAccessFor(db, user.email);
  if (early) {
    if (early.role === "company" && early.boothKey) await addBoothMember(db, early.boothKey, user.id);
    return true;
  }
  if ((await boothsOf(db, user.id)).length) return true;
  return hasVerifiedRegistration(db, user.id);
}

/** Give (or renew) the pre-launch pass when the account may have one; take it away when not. */
export async function setPreview(res: NextResponse, user: { id: string; email: string; role: string } | null, may?: boolean) {
  const value = (may ?? (await mayPreview(user))) ? await signPreview(user!.id) : null;
  if (value) res.cookies.set(PREVIEW_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: PREVIEW_DAYS * 86400 });
  else res.cookies.set(PREVIEW_COOKIE, "", { path: "/", maxAge: 0 });
  return !!value;
}
