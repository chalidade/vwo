// The seminar stage: a speaker broadcasts their screen (or their slides) to everyone watching.
// Like calls, the demo has no server: the stage reaches other tabs of this browser through a
// BroadcastChannel. The live site sends the same messages over Supabase Realtime, so viewers on any
// device see the talk. The screen itself goes over WebRTC, one connection per viewer, so only a few
// viewers (STAGE_MESH_MAX_VIEWERS) get it; for a crowd the organiser streams to YouTube and the
// viewers play that instead (`embed`).
//
// Supabase counts every message once per client that receives it, so the traffic is split in two:
// "on air" (on/off) goes to every player, a few times a minute; chat, reactions and the mesh's
// join/leave go to a second channel that only the people watching join.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { STAGE_DEFAULTS, stageStaleMs } from "@vwo/shared";
import { useEffect, useRef, useState } from "react";
import { closeChannel, hasRealtime, openChannel, realtimeClient } from "../realtime";
import { type PeerInfo, connectPeer, joinCall, leaveCall } from "./call";

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
  /** Viewers play the session's stream link (YouTube, Vimeo) from the organiser's setup, not the mesh. */
  embed?: boolean;
  /** The mesh has no free place: new viewers get the slides only. */
  full?: boolean;
  /** Seconds between two "on air" messages; viewers wait three of them before taking the speaker as gone. */
  every?: number;
  /** No speaker page is open: the session's stream link plays because the schedule says it is on now. */
  scheduled?: boolean;
}

export type StageMsg =
  | ({ type: "on" } & StageLive)
  | { type: "off" }
  | { type: "hello" }
  | { type: "restart" }
  | { type: "join" | "leave"; viewerId: string; name: string }
  | { type: "history"; to: string; chat: StageChat[] }
  /** The speaker's mesh is full: that viewer gets the slides only. */
  | { type: "full"; to: string }
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
        embed: m.embed === true || undefined,
        full: m.full === true || undefined,
        every: Math.max(2, Math.min(60, Math.floor(num(m.every) || STAGE_DEFAULTS.beatSec))),
      };
    case "full":
      return typeof m.to === "string" && ID.test(m.to) ? { type: "full", to: m.to } : null;
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

// The live site: every device. "On air" goes over a channel every player joins on first use; the
// rest over the room channel, joined only while watching (see enterStageRoom).
const MAIN = "jobfair:stage";
const ROOM = "jobfair:stage-room";
const ROOM_TYPES = new Set<StageMsg["type"]>(["join", "leave", "history", "full", "chat", "react", "restart"]);

function subscribe(topic: string, onGone: () => void) {
  return realtimeClient().then(async (sb) => {
    if (!sb) return null;
    const ch = await openChannel(sb, topic, { config: { broadcast: { self: false } } });
    return new Promise<RealtimeChannel | null>((resolve) => {
      ch.on("broadcast", { event: "m" }, (e: { payload?: unknown }) => {
        const m = parseStage(e.payload);
        if (m) deliver(m);
      });
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED") resolve(ch);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onGone();
          resolve(null);
        }
      });
    });
  });
}

let remote: Promise<RealtimeChannel | null> | null = null;
function stageChannel() {
  remote ??= subscribe(MAIN, () => (remote = null));
  return remote;
}

let room: Promise<RealtimeChannel | null> | null = null;
let roomUsers = 0;
let roomTimer: ReturnType<typeof setTimeout> | null = null;
function roomChannel() {
  room ??= subscribe(ROOM, () => (room = null));
  return room;
}

/** Join the room channel (chat, reactions, the mesh) while watching or speaking; returns a function that leaves.
 *  The last one out leaves the channel a little later, so going from the full viewer to the corner panel keeps it. */
export function enterStageRoom() {
  roomUsers++;
  if (roomTimer) clearTimeout(roomTimer);
  roomTimer = null;
  if (hasRealtime()) void roomChannel();
  let left = false;
  return () => {
    if (left) return;
    left = true;
    if (--roomUsers > 0) return;
    roomTimer = setTimeout(() => {
      roomTimer = null;
      const r = room;
      if (roomUsers > 0 || !r) return;
      room = null;
      void Promise.all([r, realtimeClient()]).then(([ch, sb]) => ch && sb && closeChannel(sb, ROOM, ch));
    }, 15_000);
  };
}

export function sendStage(m: StageMsg) {
  if (hasRealtime()) void (ROOM_TYPES.has(m.type) ? roomChannel() : stageChannel()).then((ch) => ch?.send({ type: "broadcast", event: "m", payload: m }));
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

// Who is on air, shared by every part of the game that asks (the hall, the seminar seat, the organiser).
let onAir: (StageLive & { seen: number }) | null = null;
const airSubs = new Set<(l: StageLive | null) => void>();
let airUsers = 0;
let airStop: (() => void) | null = null;
const setAir = (l: (StageLive & { seen: number }) | null) => {
  onAir = l;
  for (const fn of airSubs) fn(l);
};
function startAir() {
  const off = onStage((m) => {
    if (m.type === "on") setAir({ ...m, seen: Date.now() });
    else if (m.type === "off") setAir(null);
  });
  // In the demo a new tab asks a speaker in another tab right away. On the live site that question would
  // reach every player, so a newcomer waits for the next "on air" instead (STAGE_BEAT_SEC at most).
  if (!hasRealtime()) sendStage({ type: "hello" });
  // Silence for three beats means the speaker closed the tab.
  const t = setInterval(() => onAir && Date.now() - onAir.seen > stageStaleMs(onAir.every ?? STAGE_DEFAULTS.beatSec) && setAir(null), 2000);
  return () => {
    off();
    clearInterval(t);
  };
}

/** Whether a speaker is live right now, and what they show. */
export function useStageLive() {
  const [live, setLive] = useState<StageLive | null>(onAir);
  useEffect(() => {
    airSubs.add(setLive);
    if (airUsers++ === 0) airStop = startAir();
    setLive(onAir);
    return () => {
      airSubs.delete(setLive);
      if (--airUsers === 0) {
        airStop?.();
        airStop = null;
      }
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
 * Watch the speaker as one viewer: ask for the stream, and ask again when the speaker restarts
 * (a new screen or microphone), when nothing connects within a while, or when the connection drops.
 * When the speaker's mesh is full it stops asking and calls `onFull`: the viewer follows the slides.
 * Returns a function that leaves.
 */
export function watchStage(
  viewerId: string,
  name: string,
  onStream: (s: MediaStream | null) => void,
  onInfo?: (i: PeerInfo & { tries: number }) => void,
  onFull?: () => void,
) {
  const exit = enterStageRoom();
  let peer: { close(): void } | null = null;
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const retryIn = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => !stopped && join(), ms);
  };
  const join = () => {
    peer?.close();
    onStream(null);
    tries++;
    peer = connectPeer({
      callId: stageCallId(viewerId),
      caller: false,
      kind: "video",
      local: null,
      onRemote: (s) => onStream(new MediaStream(s.getTracks())),
      onInfo: (i) => {
        onInfo?.({ ...i, tries });
        if (i.state === "connected") {
          if (timer) clearTimeout(timer);
          timer = null;
        } else if (i.state === "failed" || i.state === "disconnected") retryIn(i.state === "failed" ? 1500 : 6000);
      },
    });
    joinStage(viewerId, name);
    // No answer from the speaker in time (a lost message, a busy network): ask again, slower each time.
    retryIn(Math.min(30_000, 12_000 * tries));
  };
  const off = onStage((m) => {
    if (stopped) return;
    if (m.type === "restart") {
      tries = 0;
      join();
    } else if (m.type === "full" && m.to === viewerId) {
      // No place left: stop asking, and stop hearing the mesh's traffic.
      stopped = true;
      if (timer) clearTimeout(timer);
      peer?.close();
      peer = null;
      leaveCall(stageCallId(viewerId));
      onStream(null);
      off();
      onFull?.();
    }
  });
  join();
  return () => {
    const wasOn = !stopped;
    stopped = true;
    if (timer) clearTimeout(timer);
    off();
    if (wasOn) leaveStage(viewerId, name);
    peer?.close();
    onStream(null);
    exit();
  };
}

/**
 * The live broadcast as it plays on a floor's big screen: while `on` (the job seeker is in the room
 * the speaker broadcasts to), this tab joins as a viewer and gets the speaker's screen and voice.
 * Each tab joins under its own id, so two tabs watching never take each other's connection.
 */
export function useStageFeed(live: StageLive | null, on: boolean, name: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [link, setLink] = useState<(PeerInfo & { tries: number }) | null>(null);
  const [viewerId] = useState(() => `feed-${Math.random().toString(36).slice(2, 10)}`);
  /** The broadcast (by start time) whose mesh had no place for this tab, and the one it is watching. */
  const [fullAt, setFullAt] = useState<number | null>(null);
  const watching = useRef<number | null>(null);
  // A stream link plays in the panel itself, and a full mesh is not asked again for this broadcast
  // (a tab already in keeps its place).
  const key = on && live && !live.embed && fullAt !== live.startedAt && (!live.full || watching.current === live.startedAt) ? live.startedAt : null;
  useEffect(() => {
    watching.current = key;
    if (key === null) {
      setStream(null);
      setLink(null);
      return;
    }
    return watchStage(viewerId, name, setStream, setLink, () => setFullAt(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viewerId]);
  const full = !!live && !live.embed && key === null && (fullAt === live.startedAt || !!live.full);
  return { stream, link, full };
}
