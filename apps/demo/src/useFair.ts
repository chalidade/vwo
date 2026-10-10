import { useEffect, useReducer } from "react";
import { DEMO_JOB_FAIR } from "@vwo/shared";
import { DemoJobFair, PLAYER_ID, type FairApplication, type FairSaved, type FairStorage } from "./jobfair-engine";
import { onFrame } from "./loop";
import { LIVE } from "./mode";
import { markBoothInboxRead, saveNotes, sendShared, setApplicationStatus } from "./server-fair";

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
if (LIVE) {
  fair.maxBots = 0;
  fair.simulated = false;
}
// On the live site a company's decision goes to the server, so the seeker sees it on any device.
const SERVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (LIVE) fair.onStatusChange = (a) => void (SERVER_ID.test(a.id) && setApplicationStatus(a.boothId, a.id, a.status));

// Chat, interview, rating and calls go to the server too, a moment after the last change, so the
// other side sees them on any device. Trimmed to what the server accepts.
const pendingShared = new Map<string, ReturnType<typeof setTimeout>>();
function pushShared(a: FairApplication) {
  if (!SERVER_ID.test(a.id)) return;
  clearTimeout(pendingShared.get(a.id));
  pendingShared.set(
    a.id,
    setTimeout(() => {
      pendingShared.delete(a.id);
      const cut = (t: string | undefined, n: number) => (t === undefined ? undefined : t.trim().slice(0, n));
      const messages = (a.messages ?? []).filter((m) => m.text.trim()).slice(-300).map((m) => ({ ...m, text: m.text.trim().slice(0, 600) }));
      const iv = a.interview;
      void sendShared(a.id, a.visitorId === PLAYER_ID ? "seeker" : "company", {
        messages,
        interview: iv && { at: iv.at, mode: iv.mode.trim().slice(0, 60), place: cut(iv.place, 300), note: cut(iv.note, 600), reply: iv.reply },
        rating: a.rating && a.rating >= 1 && a.rating <= 5 ? Math.round(a.rating) : undefined,
        feedback: cut(a.feedback, 300),
        calls: a.calls?.slice(0, 100).map((c) => ({ ...c, seconds: Math.min(86_400, Math.max(0, Math.round(c.seconds))) })),
      });
    }, 400),
  );
}
if (LIVE) {
  fair.onShared = pushShared;
  fair.serverInbox = true;
  fair.onNote = (a) => saveNotes(a.boothId, a.id, a.notes ?? "").then((r) => r.ok);
  fair.onBoothRead = (boothId, read) => void markBoothInboxRead(boothId, read).then((r) => r.ok && fair.setBoothRead(boothId, r.data.read));
}
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
