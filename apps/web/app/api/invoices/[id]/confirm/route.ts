import { confirmInvoicePayment } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isOwnerAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { invoiceOut } from "@/lib/invoices";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ index: z.number().int().min(0).max(2) });

/**
 * The organiser saw a transfer (or one instalment) arrive in the bank account. The last one marks the
 * invoice paid and puts its coins in the buyer's ledger, once, whoever clicks and however often.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user || !isOwnerAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`invoice-confirm:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const done = await confirmInvoicePayment(db, { id, index: body.data.index, by: user.id });
  if (!done) return fail(409, "not_open");
  return NextResponse.json({ invoice: invoiceOut(done.invoice), paid: done.paid, delivered: done.delivered });
}
