import { boothsOf } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { mailEnabled } from "@/lib/mail";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: !!user.emailVerifiedAt, fairAdmin: isFairAdmin(user), booths: await boothsOf(db, user.id), mustVerify: mailEnabled() && !user.emailVerifiedAt } });
}
