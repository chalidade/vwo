// The live job fair's coin balance, kept by the server in the coin ledger. The game shows and
// spends coins straight away, but what counts is this ledger: the browser can't add coins to it.
import { and, desc, eq, like, sql } from "drizzle-orm";
import type { Db } from "./client";
import { coinLedger, fairPlayers } from "./jobfair-schema";
import { coinBalance, grantCoins } from "./jobfair";
import { users } from "./schema";

export interface CoinState {
  balance: number;
  verified: boolean;
  /** Entries in the ledger: grows with every change, so an older answer can be told apart. */
  seq: number;
  txns: { at: number; amount: number; reason: string }[];
}

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Accounts made before the ledger existed bring the coins their saved game showed then. */
export const LEDGER_SINCE = new Date("2026-10-10T00:00:00Z");
const OPENING_MAX = 1000;

export async function hasCoinKey(db: Db, key: string) {
  const [row] = await db.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.idempotencyKey, key));
  return !!row;
}

/** Coins granted under keys starting with this prefix (e.g. today's mini game rewards). */
export async function coinsUnder(db: Db, userId: string, prefix: string) {
  const [row] = await db
    .select({ sum: sql<string | null>`sum(${coinLedger.delta})` })
    .from(coinLedger)
    .where(and(eq(coinLedger.userId, userId), like(coinLedger.idempotencyKey, `${esc(prefix)}%`)));
  return Number(row?.sum ?? 0);
}

/**
 * Give an account its first ledger entry, once: the welcome coins, or for an account from before
 * the ledger, the balance its saved game showed (capped). Safe to call on every request.
 */
export async function ensureCoinOpening(db: Db, userId: string, welcome: number) {
  if (await hasCoinKey(db, `opening:${userId}`)) return;
  const [u] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  const [saved] = await db.select({ data: fairPlayers.data }).from(fairPlayers).where(eq(fairPlayers.userId, userId));
  const player = (saved?.data as { player?: { coins?: unknown; verified?: unknown } } | undefined)?.player;
  const old = !!u && u.createdAt < LEDGER_SINCE && !!player;
  const coins = old && typeof player.coins === "number" && Number.isFinite(player.coins) ? Math.floor(player.coins) : welcome;
  const amount = Math.max(1, Math.min(OPENING_MAX, coins));
  await grantCoins(db, { userId, amount, reason: old ? "Saldo awal" : "Koin sambutan akun baru", key: `opening:${userId}` });
  // The blue check bought before the ledger: kept, as a paid-and-refunded pair so the balance stays.
  if (old && player.verified === true && !(await hasCoinKey(db, `verified:${userId}`))) {
    await db
      .insert(coinLedger)
      .values([
        { userId, delta: 1, reason: "Centang biru (sebelum buku koin)", idempotencyKey: `verified-legacy:${userId}` },
        { userId, delta: -1, reason: "Centang biru (sebelum buku koin)", idempotencyKey: `verified:${userId}` },
      ])
      .onConflictDoNothing({ target: coinLedger.idempotencyKey });
  }
}

export async function coinState(db: Db, userId: string): Promise<CoinState> {
  const [balance, verified, rows, [count]] = await Promise.all([
    coinBalance(db, userId),
    hasCoinKey(db, `verified:${userId}`),
    db
      .select({ at: coinLedger.createdAt, amount: coinLedger.delta, reason: coinLedger.reason })
      .from(coinLedger)
      .where(eq(coinLedger.userId, userId))
      .orderBy(desc(coinLedger.createdAt))
      .limit(50),
    db.select({ n: sql<number>`count(*)::int` }).from(coinLedger).where(eq(coinLedger.userId, userId)),
  ]);
  return { balance, verified, seq: count?.n ?? 0, txns: rows.filter((r) => !r.reason.includes("sebelum buku koin")).map((r) => ({ at: r.at.getTime(), amount: r.amount, reason: r.reason })) };
}

/** Days in a row (ending yesterday) on which the free daily coins were claimed. */
export async function dailyStreakBefore(db: Db, userId: string, day: string) {
  let n = 0;
  const d = new Date(`${day}T00:00:00Z`);
  for (let i = 1; i <= 6; i++) {
    const prev = new Date(d.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    if (!(await hasCoinKey(db, `daily:${userId}:${prev}`))) break;
    n++;
  }
  return n;
}
