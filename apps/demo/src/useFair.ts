import { useEffect, useReducer } from "react";
import { DemoJobFair } from "./jobfair-engine";
import { onFrame } from "./useCafe";

// One job fair per browser tab, shared by the visitor page and the organiser view.
export const fair = new DemoJobFair();
onFrame((dt) => fair.tick(dt));

/** Re-render whenever the job fair changes. */
export function useFair() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const unsubscribe = fair.subscribe(bump);
    return () => {
      unsubscribe();
    };
  }, []);
  return fair;
}
