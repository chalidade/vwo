import { useEffect, useReducer } from "react";
import { DemoCafe } from "./engine";

// One cafe per browser tab, shared by the customer world and the admin view.
export const cafe = new DemoCafe();

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  cafe.tick(now - last);
  last = now;
}, 100);

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
