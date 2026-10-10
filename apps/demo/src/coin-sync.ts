// Live site: the coin balance lives in the server's ledger. The game adds and takes coins at once
// so it feels instant, sends each change here to be checked and booked, then shows what the ledger
// says. A change the server refuses (twice in a day, not enough coins) simply disappears again.
import type { CoinOp } from "./jobfair-engine";
import { fair } from "./useFair";

type Ledger = Parameters<typeof fair.setLedger>[0];

const queue: CoinOp[] = [];
let running = false;
let on = false;

const nonce = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function send(op: CoinOp): Promise<Ledger | null> {
  const body = op.op === "game" || op.op === "cashback" || op.op === "spend" ? { ...op, nonce: nonce() } : op;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("/api/jobfair/coins", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => null)) as (Ledger & { error?: string }) | null;
      if (d && typeof d.balance === "number") return d;
      if (r.status < 500 && r.status !== 429) return null;
    } catch {
      // Offline: try again in a moment.
    }
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  return null;
}

/** What the ledger says now. */
export async function refreshCoins() {
  try {
    const r = await fetch("/api/jobfair/coins", { credentials: "same-origin" });
    if (r.ok) fair.setLedger((await r.json()) as Ledger);
  } catch {
    // Offline: the next change or save brings it.
  }
}

async function drain() {
  if (running) return;
  running = true;
  let refused = false;
  while (queue.length) {
    const op = queue.shift()!;
    const got = await send(op);
    if (got) fair.setLedger(got);
    else refused = true;
  }
  running = false;
  if (refused) await refreshCoins();
}

/** Coin changes still on their way to the server. */
export const coinsPending = () => running || queue.length > 0;

/** Start booking the player's coin changes on the server. Safe to call again. */
export function startCoinSync() {
  if (on) return;
  on = true;
  fair.onCoins = (op) => {
    queue.push(op);
    void drain();
  };
}
