import { voidInvoice } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isOwnerAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { invoiceOut, visibleInvoice } from "@/lib/invoices";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ note: z.string().trim().max(200).default("") });

/** Cancel an unpaid transfer or termin invoice: its buyer, or the organiser. Nothing may be paid on it yet. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`invoice-void:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const row = await visibleInvoice(user, (await params).id);
  if (!row) return fail(404, "not_found");
  if (row.userId !== user.id && !isOwnerAdmin(user)) return fail(403, "not_allowed");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const out = await voidInvoice(db, row.id, body.data.note || (row.userId === user.id ? "Dibatalkan pembeli" : "Dibatalkan panitia"));
  if (!out) return fail(409, "not_open");
  return NextResponse.json({ invoice: invoiceOut(out) });
}
