import { readPrices, writePrices } from "@vwo/db";
import { cleanPrices } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The organiser's price list, for everyone: the game shows these prices. */
export async function GET() {
  return NextResponse.json({ prices: cleanPrices(await readPrices(db)) }, { headers: { "Cache-Control": "no-store" } });
}

const bodySchema = z.object({ prices: z.record(z.string().max(60), z.number().int().min(0)) });

/** Event admins change prices. Unknown keys and out-of-range amounts are dropped. */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!isFairAdmin(user)) return fail(403, "not_allowed");
  if (!(await allow(`prices:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, bodySchema);
  if ("error" in body) return body.error;
  const prices = cleanPrices(body.data.prices);
  if (!Object.keys(prices).length) return fail(400, "invalid_input");
  await writePrices(db, prices, user.id);
  return NextResponse.json({ prices: cleanPrices(await readPrices(db)) });
}
