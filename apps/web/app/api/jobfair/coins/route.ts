import { coinsUnder, dailyStreakBefore, grantCoins, hasCoinKey, NotEnoughCoinsError, readPrices, spendCoins } from "@vwo/db";
import { GAME_DAILY_CAP, MISSIONS_BONUS, priceFrom, streakBonus, todaysMissions } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dayOk, liveCoins } from "@/lib/coins";
import { db } from "@/lib/db";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonce = z.string().regex(/^[\w-]{6,64}$/);
const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("daily"), day }),
  z.object({ op: z.literal("mission"), day, id: z.string().max(40) }),
  z.object({ op: z.literal("bonus"), day }),
  z.object({ op: z.literal("game"), day, coins: z.number().int().min(1).max(GAME_DAILY_CAP), nonce }),
  z.object({ op: z.literal("balloon"), day, booth: z.string().regex(/^[\w-]{1,80}$/), coins: z.number().int().min(1).max(3) }),
  z.object({ op: z.literal("cashback"), day, coins: z.number().int().min(1).max(3), nonce }),
  z.object({ op: z.literal("verified") }),
  z.object({ op: z.literal("spend"), amount: z.number().int().min(1).max(500), reason: z.string().trim().min(1).max(120), nonce }),
]);

/** Small extras (balloons, food court cashback) can pay at most this much per day. */
const EXTRAS_DAILY_CAP = 15;

/** This account's coins: balance, the blue check, and the latest entries. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  return NextResponse.json(await liveCoins(user.id), { headers: { "Cache-Control": "no-store" } });
}

/**
 * Earn or spend coins. Free coins follow the game's own rules (once a day, once per mission, daily
 * caps), checked here with the amounts worked out here; a spend needs the coins in the ledger.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`coins:${user.id}`, 120, 600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const b = body.data;
  const u = user.id;
  await liveCoins(u);
  const prices = await readPrices(db);
  let given = 0;
  try {
    if (b.op === "daily") {
      if (!dayOk(b.day)) return fail(409, "wrong_day");
      const streak = (await dailyStreakBefore(db, u, b.day)) + 1;
      const bonus = streakBonus(streak);
      given = priceFrom(prices, "coin.daily") + bonus;
      const ok = await grantCoins(db, { userId: u, amount: given, reason: bonus ? `Koin gratis harian + bonus ${streak} hari beruntun` : "Koin gratis harian", key: `daily:${u}:${b.day}` });
      if (!ok) given = 0;
    } else if (b.op === "mission") {
      const m = dayOk(b.day) ? todaysMissions(b.day).find((x) => x.id === b.id) : undefined;
      if (!m) return fail(409, "not_claimable");
      if (await grantCoins(db, { userId: u, amount: m.coins, reason: `Misi: ${m.title}`, key: `mission:${u}:${b.day}:${m.id}` })) given = m.coins;
    } else if (b.op === "bonus") {
      if (!dayOk(b.day)) return fail(409, "wrong_day");
      const all = await Promise.all(todaysMissions(b.day).map((m) => hasCoinKey(db, `mission:${u}:${b.day}:${m.id}`)));
      if (!all.every(Boolean)) return fail(409, "not_claimable");
      if (await grantCoins(db, { userId: u, amount: MISSIONS_BONUS, reason: "Bonus semua misi harian", key: `bonus:${u}:${b.day}` })) given = MISSIONS_BONUS;
    } else if (b.op === "game" || b.op === "cashback" || b.op === "balloon") {
      if (!dayOk(b.day)) return fail(409, "wrong_day");
      const game = b.op === "game";
      const prefix = game ? `game:${u}:${b.day}:` : `extra:${u}:${b.day}:`;
      const left = (game ? GAME_DAILY_CAP : EXTRAS_DAILY_CAP) - (await coinsUnder(db, u, prefix));
      const amount = Math.min(b.coins, left);
      const key = b.op === "balloon" ? `${prefix}balloon:${b.booth}` : `${prefix}${b.op}:${b.nonce}`;
      const reason = game ? "Mini game" : b.op === "balloon" ? "Balon di stand" : "Cashback food court";
      if (amount > 0 && (await grantCoins(db, { userId: u, amount, reason, key }))) given = amount;
    } else if (b.op === "verified") {
      if (!(await hasCoinKey(db, `verified:${u}`))) await spendCoins(db, { userId: u, amount: priceFrom(prices, "coin.verify"), reason: "Centang biru (verified)", key: `verified:${u}` });
    } else {
      await spendCoins(db, { userId: u, amount: b.amount, reason: b.reason, key: `spend:${u}:${b.nonce}` });
    }
  } catch (e) {
    if (e instanceof NotEnoughCoinsError) return fail(409, "not_enough_coins", { ...(await liveCoins(u)) });
    throw e;
  }
  return NextResponse.json({ given, ...(await liveCoins(u)) });
}
