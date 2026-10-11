import { setTaxInvoice } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isOwnerAdmin } from "@/lib/fair";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { fileFromDataUrl, invoiceOut } from "@/lib/invoices";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The faktur pajak PDF from Coretax/e-Faktur, at most this big. */
const MAX_PDF = 1_000_000;

const schema = z.object({
  number: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^[\w.\-/ ]+$/),
  file: z.object({ name: z.string().max(120), data: z.string().max(1_400_000) }).optional(),
});

/** The organiser records the faktur pajak number on an invoice, and may attach its PDF for the buyer. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user || !isOwnerAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`invoice-tax:${user.id}`, 60, 600_000))) return fail(429, "too_many_requests");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const body = await readSizedBody(req, schema, 1_500_000);
  if ("error" in body) return body.error;
  const file = body.data.file ? fileFromDataUrl(body.data.file, ["application/pdf"], MAX_PDF) : null;
  if (body.data.file && !file) return fail(400, "bad_file");
  const row = await setTaxInvoice(db, id, { number: body.data.number, file });
  if (!row) return fail(409, "not_open");
  return NextResponse.json({ invoice: invoiceOut(row) });
}
