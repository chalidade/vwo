import { useEffect, useReducer } from "react";
import { DEMO_JOB_FAIR } from "@vwo/shared";
import { DemoJobFair, type FairSaved, type FairStorage } from "./jobfair-engine";
import { onFrame } from "./useCafe";

const KEY = "vwo:jobfair";

/** Demo data lives in this browser's localStorage. Private mode or blocked storage just means nothing is kept. */
const local: FairStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as FairSaved) : null;
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage full or blocked: keep going without saving.
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to clear.
    }
  },
};

// One job fair per browser tab, shared by the visitor page and the organiser view.
export const fair = new DemoJobFair(Math.random, () => Date.now(), DEMO_JOB_FAIR, local);
onFrame((dt) => {
  if (fair.watched) fair.tick(dt);
});
window.addEventListener("pagehide", () => fair.flush());
// Another tab (say the company portal) saved: pick up its booth edits and application changes.
window.addEventListener("storage", (e) => {
  if (e.key === KEY) fair.mergeSaved(local.load());
});

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
