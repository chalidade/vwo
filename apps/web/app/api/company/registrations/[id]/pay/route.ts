import { payRegistration } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";

const schema = z.object({ method: z.enum(["QRIS", "Virtual Account BCA", "Virtual Account Mandiri", "Kartu kredit", "Transfer bank"]) });

/** Demo payment: no money moves. The registration then waits for the organiser. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  return (await payRegistration(db, id, user.id, body.data.method)) ? NextResponse.json({ ok: true }) : fail(409, "not_payable");
}
