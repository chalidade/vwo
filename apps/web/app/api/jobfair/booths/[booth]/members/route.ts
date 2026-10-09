import { boothMembers, removeBoothMember } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The accounts that run a booth, for the organiser. */
export async function GET(_req: Request, { params }: { params: Promise<{ booth: string }> }) {
  const { booth } = await params;
  if (!BOOTH.test(booth)) return fail(404, "not_found");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const rows = await boothMembers(db, booth);
  return NextResponse.json({ members: rows.map((r) => ({ id: r.userId, email: r.email, name: r.name, since: r.since.getTime() })) });
}

/** The organiser takes an account off a booth. */
export async function DELETE(req: Request, { params }: { params: Promise<{ booth: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const { booth } = await params;
  const id = new URL(req.url).searchParams.get("user") ?? "";
  if (!BOOTH.test(booth) || !UUID.test(id)) return fail(400, "invalid_input");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  return (await removeBoothMember(db, booth, id)) ? NextResponse.json({ ok: true }) : fail(404, "not_found");
}
