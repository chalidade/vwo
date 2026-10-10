// Phone and video calls: a company calling an applicant, or two job seekers in the lounge.
// The signals (ring, accept, the WebRTC offer, answer and network candidates) travel through a
// BroadcastChannel to other tabs of the same browser, and on the live site also through Supabase
// Realtime to other devices: a ring goes to the callee's inbox channel, everything after it to a
// channel named after the call's random id. The audio and video go straight between the two devices.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { LIVE } from "../mode";
import { closeChannel, hasRealtime, openChannel, realtimeClient } from "../realtime";

export type CallKind = "video" | "voice";

export type CallSignal =
  | {
      type: "ring";
      callId: string;
      to: string;
      appId: string;
      company: string;
      logo: string;
      color: string;
      recruiter: string;
      jobTitle: string;
      kind: CallKind;
      /** A job seeker calling from the lounge (then `company` and `recruiter` hold their name), and for how long. */
      from?: "seeker";
      minutes?: number;
    }
  | { type: "accept" | "decline" | "hangup" | "busy"; callId: string }
  | { type: "offer" | "answer"; callId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; callId: string; candidate: RTCIceCandidateInit };

export type RingSignal = Extract<CallSignal, { type: "ring" }>;

const channel: BroadcastChannel | null = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("vwo-call");
const listeners = new Set<(s: CallSignal) => void>();
channel?.addEventListener("message", (e: MessageEvent<CallSignal>) => {
  for (const fn of listeners) fn(e.data);
});

function deliver(s: CallSignal) {
  for (const fn of listeners) fn(s);
}

export function sendSignal(s: CallSignal) {
  // One path only: with Realtime, other tabs of this browser hear the signal from it too.
  if (hasRealtime()) void sendRemote(s);
  else channel?.postMessage(s);
}

/** A call id nobody can guess, so only the two sides can join its signal channel. */
export const newCallId = () => `call-${crypto.randomUUID()}`;

// --- Other devices (live site).
const SIGNAL_TYPES = new Set(["ring", "accept", "decline", "hangup", "busy", "offer", "answer", "ice"]);
const isSignal = (x: unknown): x is CallSignal => {
  const s = x as { type?: unknown; callId?: unknown } | null;
  return !!s && typeof s.type === "string" && SIGNAL_TYPES.has(s.type) && typeof s.callId === "string" && /^call-[\w-]{1,64}$/.test(s.callId);
};

const calls = new Map<string, Promise<RealtimeChannel | null>>();
const inboxes = new Map<string, RealtimeChannel>();

function subscribed(name: string, onMessage?: (s: CallSignal) => void): Promise<RealtimeChannel | null> {
  return realtimeClient().then(async (sb) => {
    if (!sb) return null;
    const ch = await openChannel(sb, name, { config: { broadcast: { self: false } } });
    return new Promise<RealtimeChannel | null>((resolve) => {
      if (onMessage) ch.on("broadcast", { event: "s" }, (m: { payload?: unknown }) => isSignal(m.payload) && onMessage(m.payload));
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED") resolve(ch);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(null);
      });
    });
  });
}

/** Leave a channel opened with `subscribed` for good. */
function unsubscribed(name: string, ch: RealtimeChannel | null | undefined) {
  if (!ch) return;
  void realtimeClient().then((sb) => sb && closeChannel(sb, name, ch));
}

/** The channel one call's signals go through; joined by the caller before ringing and by the callee on the ring. */
function callChannel(callId: string) {
  let ch = calls.get(callId);
  if (!ch) {
    ch = subscribed(`jobfair:call:${callId}`, (s) => {
      deliver(s);
      if (s.type === "hangup" || s.type === "decline" || s.type === "busy") leaveCall(callId);
    });
    calls.set(callId, ch);
  }
  return ch;
}

/** Live site: be on a call's signal channel before the other side sends to it. Resolves at once in the demo. */
export async function joinCall(callId: string) {
  if (hasRealtime()) await callChannel(callId);
}

export function leaveCall(callId: string) {
  const ch = calls.get(callId);
  calls.delete(callId);
  void ch?.then((c) => unsubscribed(`jobfair:call:${callId}`, c));
}

async function sendRemote(s: CallSignal) {
  if (s.type === "ring") {
    await callChannel(s.callId);
    const box = await subscribed(`jobfair:inbox:${s.to}`);
    await box?.send({ type: "broadcast", event: "s", payload: s });
    setTimeout(() => unsubscribed(`jobfair:inbox:${s.to}`, box), 2000);
    return;
  }
  const ch = await callChannel(s.callId);
  await ch?.send({ type: "broadcast", event: "s", payload: s });
  if (s.type === "hangup" || s.type === "decline" || s.type === "busy") setTimeout(() => leaveCall(s.callId), 2000);
}

/**
 * Live site: receive rings sent to these addresses (the signed-in account, this device's player).
 * Returns a function that stops listening.
 */
export function listenForCalls(addresses: string[]) {
  if (!hasRealtime()) return () => {};
  const mine = addresses.filter((a) => !inboxes.has(a));
  for (const a of mine)
    void subscribed(`jobfair:inbox:${a}`, (s) => {
      if (s.type !== "ring" || s.to !== a) return;
      void callChannel(s.callId).then(() => deliver(s));
    }).then((ch) => ch && inboxes.set(a, ch));
  return () => {
    for (const a of mine) {
      unsubscribed(`jobfair:inbox:${a}`, inboxes.get(a));
      inboxes.delete(a);
    }
  };
}

export function onSignal(fn: (s: CallSignal) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const canCallOtherTabs = () => (channel !== null || hasRealtime()) && typeof RTCPeerConnection !== "undefined";

/** Public STUN finds each device's address; a TURN relay carries calls between strict networks. */
function iceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  const turn = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turn) list.push({ urls: turn.split(","), username: import.meta.env.VITE_TURN_USERNAME as string | undefined, credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined });
  return [...list, ...(relay?.servers ?? [])];
}

/** Live site: short-lived relay credentials from the server, so phones on different networks still hear each other. */
let relay: { servers: RTCIceServer[]; until: number } | null = null;
let relayLoading: Promise<void> | null = null;

/** Fetch (or refresh) the relay servers; resolves quickly either way, a call never waits long on it. */
export function loadRelay(): Promise<void> {
  if (!LIVE) return Promise.resolve();
  if (relay && relay.until > Date.now()) return Promise.resolve();
  relayLoading ??= fetch("/api/turn", { credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<{ iceServers?: RTCIceServer[]; ttl?: number }>) : null))
    .then((d) => {
      if (d?.iceServers?.length) relay = { servers: d.iceServers, until: Date.now() + Math.max(60, (d.ttl ?? 3600) - 600) * 1000 };
    })
    .catch(() => {})
    .finally(() => {
      relayLoading = null;
    });
  return Promise.race([relayLoading, new Promise<void>((r) => setTimeout(r, 4000))]);
}

/** The camera and microphone, or null when the browser has none or the user says no. */
export async function getMedia(kind: CallKind): Promise<MediaStream | null> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" ? { width: 640, height: 480, facingMode: "user" } : false });
  } catch {
    try {
      // No camera: still try the microphone.
      return kind === "video" ? await navigator.mediaDevices.getUserMedia({ audio: true }) : null;
    } catch {
      return null;
    }
  }
}

export function stopMedia(s: MediaStream | null) {
  s?.getTracks().forEach((t) => t.stop());
}

/** How a peer connection is doing, for the people waiting on it (and for anyone debugging a call). */
export interface PeerInfo {
  state: RTCPeerConnectionState | "waiting";
  /** Once connected: straight between the two devices, or through the relay server. */
  route?: "langsung" | "relay";
}

/** Which way the media goes once connected: the selected candidate pair, relay or not. */
async function routeOf(pc: RTCPeerConnection): Promise<PeerInfo["route"]> {
  try {
    const stats = await pc.getStats();
    let pair: { localCandidateId?: string; remoteCandidateId?: string } | undefined;
    stats.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
    });
    if (!pair) stats.forEach((r) => r.type === "candidate-pair" && r.nominated && r.state === "succeeded" && (pair = r));
    if (!pair) return undefined;
    const local = pair.localCandidateId ? stats.get(pair.localCandidateId) : undefined;
    const remote = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : undefined;
    return local?.candidateType === "relay" || remote?.candidateType === "relay" ? "relay" : "langsung";
  } catch {
    return undefined;
  }
}

/**
 * One side of a WebRTC call. The caller makes the offer once the other side accepts;
 * candidates that arrive before the remote description are held until it is set.
 */
export function connectPeer(opts: {
  callId: string;
  caller: boolean;
  kind: CallKind;
  local: MediaStream | null;
  onRemote: (s: MediaStream) => void;
  onState?: (s: RTCPeerConnectionState) => void;
  onInfo?: (i: PeerInfo) => void;
}) {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  // Relay credentials may still be on their way: take them before gathering any candidates.
  const ready = loadRelay().then(() => {
    try {
      if (pc.signalingState !== "closed") pc.setConfiguration({ ...pc.getConfiguration(), iceServers: iceServers() });
    } catch {
      // Keep the servers it started with.
    }
  });
  void joinCall(opts.callId);
  const pending: RTCIceCandidateInit[] = [];
  let haveRemote = false;
  const remote = new MediaStream();
  pc.ontrack = (e) => {
    remote.addTrack(e.track);
    opts.onRemote(remote);
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) sendSignal({ type: "ice", callId: opts.callId, candidate: e.candidate.toJSON() });
  };
  opts.onInfo?.({ state: "waiting" });
  pc.onconnectionstatechange = () => {
    opts.onState?.(pc.connectionState);
    const state = pc.connectionState;
    if (state === "connected") void routeOf(pc).then((route) => opts.onInfo?.({ state, route }));
    else opts.onInfo?.({ state });
  };
  if (opts.local) for (const t of opts.local.getTracks()) pc.addTrack(t, opts.local);
  const kinds: ("audio" | "video")[] = opts.kind === "video" ? ["audio", "video"] : ["audio"];
  // Still receive what the other side sends when this side has no camera or microphone.
  for (const k of kinds) if (!opts.local?.getTracks().some((t) => t.kind === k)) pc.addTransceiver(k, { direction: "recvonly" });

  const flush = async () => {
    haveRemote = true;
    for (const c of pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
  };
  const off = onSignal(async (s) => {
    if (s.callId !== opts.callId) return;
    if (s.type === "offer" && !opts.caller) {
      await ready;
      await pc.setRemoteDescription(s.sdp);
      await flush();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: "answer", callId: opts.callId, sdp: pc.localDescription!.toJSON() });
    } else if (s.type === "answer" && opts.caller) {
      await pc.setRemoteDescription(s.sdp);
      await flush();
    } else if (s.type === "ice") {
      if (haveRemote) await pc.addIceCandidate(s.candidate).catch(() => {});
      else pending.push(s.candidate);
    }
  });
  if (opts.caller)
    void (async () => {
      await ready;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: "offer", callId: opts.callId, sdp: pc.localDescription!.toJSON() });
    })();
  return {
    close() {
      off();
      pc.close();
    },
  };
}
