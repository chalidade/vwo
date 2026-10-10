// Live site: views, clicks, sales, seminar attendance and the live feed are counted on the server,
// so the organiser and the companies see everyone's numbers, not just this browser's. The game
// counts at once here, sends what the player did every few seconds, and takes the server's totals.
import type { FairEvent, StatHit, StatHitTotal } from "./jobfair-engine";
import { fair } from "./useFair";

let hits: StatHit[] = [];
let events: Omit<FairEvent, "at">[] = [];
let started = false;

const post = (body: unknown, keepalive = false) =>
  fetch("/api/jobfair/stats", { method: "POST", credentials: "same-origin", keepalive, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function send(keepalive = false) {
  while (hits.length || events.length) {
    const body = { hits: hits.slice(0, 50), events: events.slice(0, 10) };
    hits = hits.slice(50);
    events = events.slice(10);
    try {
      const r = await post(body, keepalive);
      if (r.status === 429 || r.status >= 500) return;
    } catch {
      // Offline: these few counts are lost, the game goes on.
      return;
    }
  }
}

/** The server's totals (and, for event admins, the live feed). */
export async function pullStats() {
  try {
    const r = await fetch("/api/jobfair/stats", { credentials: "same-origin" });
    if (!r.ok) return;
    const d = (await r.json()) as { stats: Record<string, StatHitTotal>; events?: FairEvent[] };
    fair.setStats(d.stats, d.events);
  } catch {
    // Offline: next round.
  }
}

/** Start counting with the server. Safe to call again (after signing in): it pulls again. */
export function startStatsSync(signedIn: boolean) {
  void pullStats();
  if (started || !signedIn) return;
  started = true;
  fair.onStat = (h) => hits.length < 500 && hits.push(h);
  fair.onEvent = (e) => events.length < 50 && events.push(e);
  fair.onMerch = (booth, voucherId) => {
    void fetch("/api/jobfair/merch", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booth }) })
      .then(async (r) => {
        if (r.status !== 409) return;
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        if (d.error === "already_claimed" || d.error === "out_of_stock") fair.merchRefused(booth, voucherId, d.error);
      })
      .catch(() => undefined);
  };
  window.setInterval(() => void send(), 15_000);
  window.setInterval(() => document.visibilityState === "visible" && void pullStats(), 30_000);
  window.addEventListener("pagehide", () => void send(true));
}
