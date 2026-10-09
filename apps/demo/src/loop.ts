type FrameHook = (dtMs: number) => void;
const hooks = new Set<FrameHook>();

/** Run `fn` every animation frame. Returns an unsubscribe function. */
export function onFrame(fn: FrameHook) {
  hooks.add(fn);
  return () => {
    hooks.delete(fn);
  };
}

// One loop drives the player and the bots, so the scene redraws once per frame. When the tab is
// hidden, requestAnimationFrame pauses; a slow timer keeps bots coming and going meanwhile.
let last = performance.now();
const step = () => {
  const now = performance.now();
  const dt = Math.min(now - last, 250);
  last = now;
  hooks.forEach((fn) => fn(dt));
};
const frame = () => {
  step();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
setInterval(() => {
  if (document.hidden) step();
}, 250);
