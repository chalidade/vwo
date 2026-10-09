import { claimPayment } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, sameOrigin } from "@/lib/http";
import { paymentOut } from "@/lib/payments";
import { currentUser } from "@/lib/session";

/** The game took what a paid payment bought (coins). Succeeds once per payment. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found");
  const row = await claimPayment(db, id, user.id);
  return row ? NextResponse.json({ payment: paymentOut(row) }) : fail(409, "not_claimable");
}
