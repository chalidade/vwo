import { allRegistrations } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail } from "@/lib/http";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Every company registration, for the organiser to check. */
export async function GET() {
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  return NextResponse.json({ registrations: await allRegistrations(db) });
}
