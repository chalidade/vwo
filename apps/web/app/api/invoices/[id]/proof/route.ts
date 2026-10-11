import { addTransferProof } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { fileFromDataUrl, visibleInvoice } from "@/lib/invoices";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** A photo of the transfer receipt, at most this big (the page shrinks pictures before sending). */
const MAX_IMAGE = 400_000;

const schema = z.object({
  ref: z.string().trim().min(3).max(80),
  note: z.string().trim().max(300).default(""),
  image: z.object({ name: z.string().max(120), data: z.string().max(600_000) }).optional(),
});

/** The buyer says the money was sent: the bank reference number, and optionally a photo of the receipt. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`invoice-proof:${user.id}`, 20, 3_600_000))) return fail(429, "too_many_requests");
  const row = await visibleInvoice(user, (await params).id);
  if (!row) return fail(404, "not_found");
  const body = await readSizedBody(req, schema, 700_000);
  if ("error" in body) return body.error;
  const image = body.data.image ? fileFromDataUrl(body.data.image, ["image/jpeg", "image/png"], MAX_IMAGE) : null;
  if (body.data.image && !image) return fail(400, "bad_file");
  const res = await addTransferProof(db, row.id, { ref: body.data.ref, note: body.data.note, image });
  if (res !== "ok") return fail(409, res);
  return NextResponse.json({ ok: true });
}
