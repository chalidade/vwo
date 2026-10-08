import { useEffect, useReducer } from "react";
import { DemoCafe } from "./engine";

// One cafe per browser tab, shared by the customer world and the admin view.
export const cafe = new DemoCafe();

type FrameHook = (dtMs: number) => void;
const hooks = new Set<FrameHook>();

/** Run `fn` every animation frame, before the bots move. Returns an unsubscribe function. */
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
  if (cafe.watched) cafe.tick(dt);
};
const frame = () => {
  step();
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
setInterval(() => {
  if (document.hidden) step();
}, 250);

/** Re-render whenever the cafe changes. */
export function useCafe() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const unsubscribe = cafe.subscribe(bump);
    return () => {
      unsubscribe();
    };
  }, []);
  return cafe;
}
