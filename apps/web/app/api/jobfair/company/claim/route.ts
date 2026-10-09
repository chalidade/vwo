import { addBoothMember, removeBoothMember } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boothPin, samePin } from "@/lib/booth-pins";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

const claimSchema = z.object({ boothId: z.string().regex(/^[\w-]{1,80}$/), pin: z.string().trim().min(4).max(12) });

/** A company account joins its booth with the code and PIN the organiser gave it. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  // A four-digit PIN must not be guessable: a handful of tries per account, then a wait.
  if (!(await allow(`claim:${user.id}`, 6, 900_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, claimSchema);
  if ("error" in body) return body.error;
  const pin = await boothPin(body.data.boothId);
  if (!pin) return fail(409, "no_pin");
  if (!samePin(pin, body.data.pin)) return fail(403, "wrong_pin");
  await addBoothMember(db, body.data.boothId, user.id);
  return NextResponse.json({ ok: true, boothId: body.data.boothId });
}

/** Leave a booth (this account stops seeing its applicants). */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const booth = new URL(req.url).searchParams.get("booth") ?? "";
  if (!/^[\w-]{1,80}$/.test(booth)) return fail(400, "invalid_input");
  await removeBoothMember(db, booth, user.id);
  return NextResponse.json({ ok: true });
}
