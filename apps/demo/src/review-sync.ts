// Live site: booth ratings come from real reviews kept on the server, so every visitor sees the
// same stars. The game shows a new review at once and sends it; the next pull brings the count.
import { pollVisible } from "./poll";
import { runtimeConfig } from "./runtime-config";
import { fair } from "./useFair";

type Reviews = Parameters<typeof fair.setReviews>[0];

let started = false;
/** This account's own stars, as last pulled: they only change when this account reviews. */
let mine: Reviews["mine"] = {};

/** Take the server's ratings and this account's own reviews now. */
export async function pullReviews() {
  try {
    const r = await fetch("/api/jobfair/reviews", { credentials: "same-origin" });
    if (!r.ok) return;
    const d = (await r.json()) as Reviews;
    mine = d.mine;
    fair.setReviews(d);
  } catch {
    // Offline: the next round brings them.
  }
}

/** Only the ratings, the same for everyone (the CDN keeps them); this account's stars stay as they were. */
async function pullTotals() {
  try {
    const r = await fetch("/api/jobfair/reviews?totals=1", { credentials: "same-origin" });
    if (r.ok) fair.setReviews({ totals: ((await r.json()) as Reviews).totals, mine });
  } catch {
    // Offline: the next round brings them.
  }
}

/** Start keeping ratings in step with the server. Safe to call again (say after signing in): it pulls again. */
export function startReviewSync() {
  void pullReviews();
  if (started) return;
  started = true;
  fair.onReview = (booth, stars) => {
    void fetch("/api/jobfair/reviews", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booth, stars }) })
      .catch(() => undefined)
      .then(() => pullReviews());
  };
  pollVisible(
    () => void pullTotals(),
    () => runtimeConfig().reviewsPollSec,
    { now: false },
  );
}
