// Phone and video calls: a company calling an applicant, or two job seekers in the lounge.
// The signals (ring, accept, the WebRTC offer, answer and network candidates) travel through a
// BroadcastChannel to other tabs of the same browser, and on the live site also through Supabase
// Realtime to other devices: a ring goes to the callee's inbox channel, everything after it to a
// channel named after the call's random id. The audio and video go straight between the two devices.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { hasRealtime, realtimeClient } from "../realtime";

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
  return realtimeClient().then(
    (sb) =>
      new Promise((resolve) => {
        if (!sb) return resolve(null);
        const ch = sb.channel(name, { config: { broadcast: { self: false } } });
        if (onMessage) ch.on("broadcast", { event: "s" }, (m: { payload?: unknown }) => isSignal(m.payload) && onMessage(m.payload));
        ch.subscribe((status: string) => {
          if (status === "SUBSCRIBED") resolve(ch);
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(null);
        });
      }),
  );
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
  void ch?.then((c) => c?.unsubscribe());
}

async function sendRemote(s: CallSignal) {
  if (s.type === "ring") {
    await callChannel(s.callId);
    const box = await subscribed(`jobfair:inbox:${s.to}`);
    await box?.send({ type: "broadcast", event: "s", payload: s });
    setTimeout(() => void box?.unsubscribe(), 2000);
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
      void inboxes.get(a)?.unsubscribe();
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

/** Public STUN finds each device's address; a TURN relay (when configured) carries calls between strict networks. */
function iceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  const turn = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turn) list.push({ urls: turn.split(","), username: import.meta.env.VITE_TURN_USERNAME as string | undefined, credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined });
  return list;
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

/**
 * One side of a WebRTC call. The caller makes the offer once the other side accepts;
 * candidates that arrive before the remote description are held until it is set.
 */
export function connectPeer(opts: { callId: string; caller: boolean; kind: CallKind; local: MediaStream | null; onRemote: (s: MediaStream) => void; onState?: (s: RTCPeerConnectionState) => void }) {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
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
  pc.onconnectionstatechange = () => opts.onState?.(pc.connectionState);
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
