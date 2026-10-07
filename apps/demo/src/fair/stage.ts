// The seminar stage: a speaker broadcasts their screen (or their slides) to everyone watching.
// Like calls, the demo has no server: the stage reaches other tabs of this browser through a
// BroadcastChannel, and the screen itself goes over WebRTC, one connection per viewer.
import { useEffect, useState } from "react";

export interface StageChat {
  id: string;
  name: string;
  text: string;
  at: number;
  /** Asked as a question for the Q&A. */
  q?: boolean;
  /** Written by the speaker. */
  host?: boolean;
  /** The speaker marked the question answered. */
  done?: boolean;
  bot?: boolean;
}

export interface StageLive {
  sessionId: string;
  title: string;
  speaker: string;
  role: string;
  startedAt: number;
  /** Sharing a screen (video) rather than presenting the session's slides. */
  screen: boolean;
  slide: number;
  viewers: number;
}

export type StageMsg =
  | ({ type: "on" } & StageLive)
  | { type: "off" }
  | { type: "hello" }
  | { type: "restart" }
  | { type: "join" | "leave"; viewerId: string; name: string }
  | { type: "history"; to: string; chat: StageChat[] }
  | { type: "chat"; chat: StageChat }
  | { type: "react"; e: string };

const channel: BroadcastChannel | null = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("vwo-seminar");
const listeners = new Set<(m: StageMsg) => void>();
channel?.addEventListener("message", (e: MessageEvent<StageMsg>) => {
  for (const fn of listeners) fn(e.data);
});

export function sendStage(m: StageMsg) {
  channel?.postMessage(m);
}

export function onStage(fn: (m: StageMsg) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The peer-connection id for one viewer, on the call channel. */
export const stageCallId = (viewerId: string) => `stage:${viewerId}`;

/** Whether a speaker is live in another tab right now, and what they show. */
export function useStageLive() {
  const [live, setLive] = useState<(StageLive & { seen: number }) | null>(null);
  useEffect(() => {
    const off = onStage((m) => {
      if (m.type === "on") setLive({ ...m, seen: Date.now() });
      else if (m.type === "off") setLive(null);
    });
    sendStage({ type: "hello" });
    // The speaker says it is live every two seconds; silence means it closed the tab.
    const t = setInterval(() => setLive((l) => (l && Date.now() - l.seen > 6000 ? null : l)), 2000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);
  return live;
}

/** Questions bots ask during a live talk, so a demo stage does not feel empty. */
export const BOT_QUESTIONS = [
  "Kak, untuk fresh graduate tanpa pengalaman, apa yang paling dilihat recruiter?",
  "Apakah materi ini bisa dibagikan setelah sesi?",
  "Bagaimana cara menjawab pertanyaan gaji yang diharapkan?",
  "CV sebaiknya 1 halaman atau boleh lebih?",
  "Apakah sertifikat seminar ini bisa dicantumkan di CV?",
  "Kalau gugup saat interview online, tipsnya apa kak?",
];

export const BOT_CHAT = ["Suaranya jelas kak 👍", "Izin mencatat 📝", "Materinya daging 🔥", "Terima kasih ilmunya 🙏", "Slide-nya kelihatan jelas", "Halo dari Bekasi 👋"];

export const BOT_NAMES = ["Rina", "Dimas", "Putri", "Fajar", "Ayu", "Bagas", "Nadia", "Yoga"];
