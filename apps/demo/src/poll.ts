// Polling that stops while nobody looks: a hidden tab (another app, a locked phone) asks the server
// nothing, and a tab coming back catches up at once.

/** A tab back within this long after the last run doesn't run again just for coming back. */
const BACK_MIN_MS = 10_000;

/**
 * Run `fn` every `sec()` seconds while the page is visible, and on coming back to it. The interval is
 * read before every wait, so limits that arrive from the server later apply from then on.
 * Returns a function that stops it.
 */
export function pollVisible(fn: () => void, sec: () => number, opts: { now?: boolean } = {}) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
  const run = () => {
    last = Date.now();
    fn();
  };
  const schedule = () => {
    if (stopped) return;
    const ms = Math.max(1, sec()) * 1000;
    timer = setTimeout(() => {
      // Not again if coming back to the tab just ran it.
      if (visible() && Date.now() - last >= ms - 50) run();
      schedule();
    }, ms);
  };
  const back = () => visible() && Date.now() - last >= BACK_MIN_MS && run();
  if (opts.now !== false) run();
  else last = Date.now();
  schedule();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", back);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", back);
  };
}
