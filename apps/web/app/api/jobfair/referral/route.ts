import { claimReferral, readPrices, referralCount, referredBy } from "@vwo/db";
import { priceFrom } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { liveCoins } from "@/lib/coins";
import { db } from "@/lib/db";
import { clientIp, fail, readBody, sameOrigin } from "@/lib/http";
import { mailEnabled } from "@/lib/mail";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(6).max(16) });

/** The signed-in account's invite code (its public fair tag), how many friends it brought, and the reward. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const [count, by, prices] = await Promise.all([referralCount(db, user.id), referredBy(db, user.id), readPrices(db)]);
  return NextResponse.json({ code: user.fairTag, ...count, reward: priceFrom(prices, "coin.referral"), joinedWithCode: !!by }, { headers: { "Cache-Control": "no-store" } });
}

/** A new account takes the code of the friend who invited it: both get coins, once. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`referral:${user.id}`, 10, 3_600_000)) || !(await allow(`referral-ip:${clientIp(req)}`, 30, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  // Where email goes out, only a confirmed address earns coins, so throwaway sign-ups don't pay.
  if (mailEnabled() && !user.emailVerifiedAt) return fail(409, "verify_first");
  await liveCoins(user.id);
  const reward = priceFrom(await readPrices(db), "coin.referral");
  const result = reward > 0 ? await claimReferral(db, { userId: user.id, code: body.data.code, reward }) : "unknown_code";
  if (result === "ok" || result === "cap") return NextResponse.json({ ok: true, reward });
  return fail(result === "unknown_code" ? 404 : 409, result);
}
