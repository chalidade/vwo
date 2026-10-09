// The seminar stage: a speaker broadcasts their screen (or their slides) to everyone watching.
// Like calls, the demo has no server: the stage reaches other tabs of this browser through a
// BroadcastChannel. The live site sends the same messages over a Supabase Realtime channel, so
// viewers on any device see the talk. The screen itself goes over WebRTC, one connection per viewer.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { hasRealtime, realtimeClient } from "../realtime";
import { connectPeer, joinCall, leaveCall } from "./call";

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
  /** Where the broadcast plays: the seminar room (default) or the Aula stage, e.g. for opening speeches. */
  venue?: "seminar" | "aula";
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

const listeners = new Set<(m: StageMsg) => void>();
const deliver = (m: StageMsg) => {
  for (const fn of listeners) fn(m);
};

const ID = /^[\w-]{1,80}$/;
const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, n) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function parseChat(x: unknown): StageChat | null {
  const c = x as Partial<StageChat> | null;
  if (!c || typeof c.id !== "string" || !ID.test(c.id) || typeof c.text !== "string" || !c.text.trim()) return null;
  return { id: c.id, name: clean(c.name, 40) || "Tamu", text: clean(c.text, 280), at: num(c.at), q: c.q === true || undefined, host: c.host === true || undefined, done: c.done === true || undefined };
}

/** Anyone can send on a public channel: keep only well-formed stage messages, trimmed. */
export function parseStage(x: unknown): StageMsg | null {
  const m = x as Record<string, unknown> | null;
  if (!m || typeof m.type !== "string") return null;
  switch (m.type) {
    case "off":
    case "hello":
    case "restart":
      return { type: m.type };
    case "on":
      if (typeof m.sessionId !== "string" || !ID.test(m.sessionId)) return null;
      return {
        type: "on",
        sessionId: m.sessionId,
        title: clean(m.title, 160),
        speaker: clean(m.speaker, 80),
        role: clean(m.role, 120),
        startedAt: num(m.startedAt),
        screen: m.screen === true,
        slide: Math.max(0, Math.min(500, Math.floor(num(m.slide)))),
        viewers: Math.max(0, Math.min(100_000, Math.floor(num(m.viewers)))),
        venue: m.venue === "aula" ? "aula" : "seminar",
      };
    case "join":
    case "leave":
      return typeof m.viewerId === "string" && ID.test(m.viewerId) ? { type: m.type, viewerId: m.viewerId, name: clean(m.name, 40) } : null;
    case "history": {
      if (typeof m.to !== "string" || !ID.test(m.to) || !Array.isArray(m.chat)) return null;
      return { type: "history", to: m.to, chat: m.chat.slice(-50).map(parseChat).filter((c): c is StageChat => !!c) };
    }
    case "chat": {
      const chat = parseChat(m.chat);
      return chat ? { type: "chat", chat } : null;
    }
    case "react":
      return typeof m.e === "string" && m.e.length <= 8 ? { type: "react", e: m.e } : null;
    default:
      return null;
  }
}

// The demo: other tabs of this browser.
const local: BroadcastChannel | null = !hasRealtime() && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("vwo-seminar") : null;
local?.addEventListener("message", (e: MessageEvent<StageMsg>) => deliver(e.data));

// The live site: every device, through one Realtime channel joined on first use.
let remote: Promise<RealtimeChannel | null> | null = null;
function stageChannel() {
  remote ??= realtimeClient().then(
    (sb) =>
      new Promise<RealtimeChannel | null>((resolve) => {
        if (!sb) return resolve(null);
        const ch = sb.channel("jobfair:stage", { config: { broadcast: { self: false } } });
        ch.on("broadcast", { event: "m" }, (e: { payload?: unknown }) => {
          const m = parseStage(e.payload);
          if (m) deliver(m);
        });
        ch.subscribe((status: string) => {
          if (status === "SUBSCRIBED") resolve(ch);
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            remote = null;
            resolve(null);
          }
        });
      }),
  );
  return remote;
}

export function sendStage(m: StageMsg) {
  if (hasRealtime()) void stageChannel().then((ch) => ch?.send({ type: "broadcast", event: "m", payload: m }));
  else local?.postMessage(m);
}

export function onStage(fn: (m: StageMsg) => void) {
  if (hasRealtime()) void stageChannel();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The peer-connection id for one viewer, on the call channel. */
export const stageCallId = (viewerId: string) => `call-stage-${viewerId}`;

/** A viewer asks for the screen once it can hear the speaker's offer. */
export function joinStage(viewerId: string, name: string) {
  void joinCall(stageCallId(viewerId)).then(() => sendStage({ type: "join", viewerId, name }));
}

/** A viewer leaves: tell the speaker and drop the signal channel. */
export function leaveStage(viewerId: string, name: string) {
  sendStage({ type: "leave", viewerId, name });
  leaveCall(stageCallId(viewerId));
}

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

/**
 * The live broadcast as it plays on a floor's big screen: while `on` (the job seeker is in the room
 * the speaker broadcasts to), this tab joins as a viewer and gets the speaker's screen and voice.
 * Each tab joins under its own id, so two tabs watching never take each other's connection.
 */
export function useStageFeed(live: StageLive | null, on: boolean, name: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [viewerId] = useState(() => `feed-${Math.random().toString(36).slice(2, 10)}`);
  const key = on && live ? live.startedAt : null;
  useEffect(() => {
    if (key === null) {
      setStream(null);
      return;
    }
    let peer: { close(): void } | null = null;
    const join = () => {
      peer?.close();
      setStream(null);
      peer = connectPeer({ callId: stageCallId(viewerId), caller: false, kind: "video", local: null, onRemote: (s) => setStream(new MediaStream(s.getTracks())) });
      joinStage(viewerId, name);
    };
    const off = onStage((m) => {
      if (m.type === "restart") join();
    });
    join();
    return () => {
      off();
      leaveStage(viewerId, name);
      peer?.close();
      setStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viewerId]);
  return stream;
}
