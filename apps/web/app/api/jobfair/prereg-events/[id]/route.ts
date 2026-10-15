import { deletePreregEvent, preregEventBySlug, preregEventById, updatePreregEvent } from "@vwo/db";
import { preregEventInput } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { UUID, adminEvent } from "../view";

export const dynamic = "force-dynamic";

/** Change an event: its details, its link, opening or closing the form. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "not_found");
  const body = await readSizedBody(req, preregEventInput, 320_000);
  if ("error" in body) return body.error;
  const row = await updatePreregEvent(db, id, body.data);
  if (row === "slug_taken") return fail(409, "slug_taken");
  if (!row) return fail(404, "not_found");
  const found = await preregEventBySlug(db, row.slug);
  return NextResponse.json({ event: adminEvent(row, found?.count ?? 0) });
}

/** Delete an event nobody signed up for yet; one with sign-ups can only be closed. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "not_found");
  if (await deletePreregEvent(db, id)) return NextResponse.json({ ok: true });
  return (await preregEventById(db, id)) ? fail(409, "has_registrants") : fail(404, "not_found");
}
