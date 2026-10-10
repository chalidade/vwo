import "server-only";
import { coinState, ensureCoinOpening, readPrices } from "@vwo/db";
import { priceFrom } from "@vwo/shared";
import { db } from "./db";

/** The account's coins as the ledger has them, opening the ledger on first use. */
export async function liveCoins(userId: string) {
  await ensureCoinOpening(db, userId, priceFrom(await readPrices(db), "coin.start"));
  return coinState(db, userId);
}

/** Today in UTC, as the game counts days. A day the browser names may be today or yesterday. */
export function dayOk(day: string) {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10);
  return day === today || day === yesterday || day === tomorrow;
}
