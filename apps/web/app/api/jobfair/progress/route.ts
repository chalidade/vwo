import { readFairPlayer, writeFairPlayer } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, sameOrigin } from "@/lib/http";
import { allow } from "@/lib/ratelimit";
import { maybeCleanup } from "@/lib/cleanup";
import { currentUser } from "@/lib/session";
import { type CoinState } from "@vwo/db";
import { liveCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** Coins, missions, vouchers, psikotes results, stamps, notifications, profile photo: well under this. */
const MAX_BYTES = 400_000;
const PARTS = new Set(["player", "stamps", "inbox", "profile", "character"]);

type Saved = { player?: Record<string, unknown> } & Record<string, unknown>;

/** Coins, their history and the blue check always come from the ledger, whatever was saved. */
function withLedger(data: unknown, coins: CoinState) {
  if (!data || typeof data !== "object") return data;
  const d = data as Saved;
  if (!d.player || typeof d.player !== "object") return d;
  return { ...d, player: { ...d.player, coins: coins.balance, verified: coins.verified, txns: coins.txns } };
}

/** The signed-in account's game progress, for whichever device they open the job fair on. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const [row, coins] = await Promise.all([readFairPlayer(db, user.id), liveCoins(user.id)]);
  return NextResponse.json(row ? { ...row, data: withLedger(row.data, coins), coins } : { data: null, rev: 0, coins }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Save it. Only ever read back by the same account, so the document is checked for shape and size,
 * not field by field; the coin balance in it is replaced by the ledger's. A save on top of an older revision gets 409 with what is stored now.
 */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  maybeCleanup();
  if (!(await allow(`progress:${user.id}`, 240, 600_000))) return fail(429, "too_many_requests");
  const text = await req.text();
  if (text.length > MAX_BYTES) return fail(413, "too_large");
  let body: { rev?: unknown; data?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, "invalid_input");
  }
  const { rev, data } = body;
  if (!Number.isInteger(rev) || (rev as number) < 0 || !data || typeof data !== "object" || Array.isArray(data)) return fail(400, "invalid_input");
  if (Object.keys(data).some((k) => !PARTS.has(k))) return fail(400, "invalid_input");
  const coins = await liveCoins(user.id);
  const next = await writeFairPlayer(db, { userId: user.id, rev: rev as number, data: withLedger(data, coins) as object });
  if (next !== null) return NextResponse.json({ rev: next, coins });
  const now = await readFairPlayer(db, user.id);
  return NextResponse.json({ error: "conflict", ...(now ? { ...now, data: withLedger(now.data, coins) } : { data: null, rev: 0 }), coins }, { status: 409 });
}
