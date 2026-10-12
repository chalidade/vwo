import { editLead } from "@vwo/db";
import { leadPatch } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";

/** The organiser moves a request along (Baru, Dihubungi, Selesai, Ditolak) or keeps notes from the calls. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const body = await readBody(req, leadPatch);
  if ("error" in body) return body.error;
  const out = await editLead(db, id, user!.id, body.data);
  if ("error" in out) return fail(out.error === "not_found" ? 404 : 409, out.error);
  return NextResponse.json({ lead: out.result });
}
