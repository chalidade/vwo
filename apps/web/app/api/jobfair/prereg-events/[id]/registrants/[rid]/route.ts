import { deletePrereg, setPreregEmail } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { UUID, adminRegistrant } from "../../../view";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(120) });

/**
 * Move a sign-up to the email of the person's Google account (they typed another address). It is
 * unlinked, and the account with the new email picks it up when it signs in.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const { id, rid } = await params;
  if (!UUID.test(id) || !UUID.test(rid)) return fail(404, "not_found");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const row = await setPreregEmail(db, id, rid, body.data.email);
  if (row === "taken") return fail(409, "email_taken");
  if (!row) return fail(404, "not_found");
  return NextResponse.json({ registrant: adminRegistrant(row) });
}

/** Remove a sign-up (spam, or the person asked). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const { id, rid } = await params;
  if (!UUID.test(id) || !UUID.test(rid)) return fail(404, "not_found");
  return (await deletePrereg(db, id, rid)) ? NextResponse.json({ ok: true }) : fail(404, "not_found");
}
