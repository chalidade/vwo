import { claimMerch } from "@vwo/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boothNow } from "@/lib/booths";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ booth: z.string().regex(/^[\w-]{1,80}$/) });

/** Take one of a booth's free merchandise: one per account, while the company's stock lasts. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`merch:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const booth = await boothNow(body.data.booth);
  if (!booth?.accessories?.includes("giveaway")) return fail(404, "not_found");
  const stock = Math.max(0, Math.round(booth.media?.merch?.stock ?? 50));
  const r = await claimMerch(db, { userId: user.id, boothKey: booth.id, stock, day: new Date().toISOString().slice(0, 10) });
  return r === "ok" ? NextResponse.json({ ok: true }) : fail(409, r === "claimed" ? "already_claimed" : "out_of_stock");
}
