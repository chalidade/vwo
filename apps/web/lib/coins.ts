import "server-only";
import { coinState, ensureCoinOpening, hasCoinKey, readPrices } from "@vwo/db";
import { priceFrom } from "@vwo/shared";
import { db } from "./db";

/** Accounts whose ledger this instance already saw opened: an opening entry is never taken back. */
const opened = new Set<string>();

/** The account's coins as the ledger has them, opening the ledger on first use (checked once per instance). */
export async function liveCoins(userId: string) {
  if (!opened.has(userId)) {
    // The price list is only needed for a ledger that isn't open yet.
    if (!(await hasCoinKey(db, `opening:${userId}`))) await ensureCoinOpening(db, userId, priceFrom(await readPrices(db), "coin.start"));
    if (opened.size >= 20_000) opened.clear();
    opened.add(userId);
  }
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
