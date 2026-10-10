// Live site: booth ratings come from real reviews kept on the server, so every visitor sees the
// same stars. The game shows a new review at once and sends it; the next pull brings the count.
import { fair } from "./useFair";

type Reviews = Parameters<typeof fair.setReviews>[0];

let started = false;

/** Take the server's ratings and this account's own reviews now. */
export async function pullReviews() {
  try {
    const r = await fetch("/api/jobfair/reviews", { credentials: "same-origin" });
    if (r.ok) fair.setReviews((await r.json()) as Reviews);
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
  window.setInterval(() => document.visibilityState === "visible" && void pullReviews(), 60_000);
}
