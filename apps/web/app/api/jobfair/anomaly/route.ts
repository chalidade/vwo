import { anomalyAt, anomalyCollection, boothsOf, claimAnomaly, readFairStateKey, readPrices } from "@vwo/db";
import { anomalySettings, priceFrom } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { liveCoins } from "@/lib/coins";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Signs the anomalies: a dedicated secret when set, otherwise the database URL (secret and server-only), like the preview pass. */
const secret = () => process.env.PREVIEW_SECRET || process.env.DATABASE_URL || "";

/** The organiser's switch and cap, read at most every 20 seconds per instance: every visitor asks for the anomaly. */
let cached: { at: number; value: ReturnType<typeof anomalySettings> } | null = null;
async function settings() {
  if (cached && Date.now() - cached.at < 20_000) return cached.value;
  const row = await readFairStateKey(db, "org");
  cached = { at: Date.now(), value: anomalySettings(row?.data) };
  return cached.value;
}

/** The anomaly out right now (the same for everyone), and when to ask again. With `?mine=1`, the
 *  signed-in account's collection instead: the kinds it caught and when. */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("mine") === "1") {
    const user = await currentUser();
    if (!user) return fail(401, "not_signed_in");
    if (!(await allow(`anomaly-mine:${user.id}`, 30, 600_000))) return fail(429, "too_many_requests");
    return NextResponse.json({ caught: await anomalyCollection(db, user.id) }, { headers: { "Cache-Control": "no-store" } });
  }
  const s = await settings();
  const now = Date.now();
  if (!s.on || !secret()) return NextResponse.json({ on: false, spawn: null, next: now + 5 * 60_000, now }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ on: true, cap: s.cap, now, ...anomalyAt(secret(), now) }, { headers: { "Cache-Control": "no-store" } });
}

const schema = z.object({
  id: z.string().regex(/^a\d{1,12}$/),
  floor: z.number().int().min(0).max(0xffffffff),
  exp: z.number().int().min(0).max(1e14),
  token: z.string().regex(/^[\w-]{20,64}$/),
});

/** A seeker tapped the anomaly: the server checks it and decides the reward. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`anomaly:${user.id}`, 12, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const s = await settings();
  if (!s.on || !secret()) return fail(409, "off");
  // Company accounts run a booth; the treats are for job seekers.
  if ((await boothsOf(db, user.id)).length) return fail(403, "seekers_only");
  await liveCoins(user.id);
  const applyCoins = priceFrom(await readPrices(db), "coin.apply");
  const r = await claimAnomaly(db, { secret: secret(), userId: user.id, claim: body.data, cap: s.cap, applyCoins });
  if (!r.ok) return fail(r.error === "daily_cap" ? 429 : r.error === "bad_token" ? 400 : 409, r.error, r.kind ? { cap: s.cap, kind: r.kind } : { cap: s.cap });
  return NextResponse.json({ reward: r.reward, kind: r.spawn.kind, ...(await liveCoins(user.id)) });
}
