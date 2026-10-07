// Phone and video calls between a company and an applicant.
// The demo has no server, so calls reach other tabs of the same browser through a BroadcastChannel,
// which also carries the WebRTC offer, answer and network candidates. Calls to bots are simulated.

export type CallKind = "video" | "voice";

export type CallSignal =
  | { type: "ring"; callId: string; to: string; appId: string; company: string; logo: string; color: string; recruiter: string; jobTitle: string; kind: CallKind }
  | { type: "accept" | "decline" | "hangup" | "busy"; callId: string }
  | { type: "offer" | "answer"; callId: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; callId: string; candidate: RTCIceCandidateInit };

export type RingSignal = Extract<CallSignal, { type: "ring" }>;

const channel: BroadcastChannel | null = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("vwo-call");
const listeners = new Set<(s: CallSignal) => void>();
channel?.addEventListener("message", (e: MessageEvent<CallSignal>) => {
  for (const fn of listeners) fn(e.data);
});

export function sendSignal(s: CallSignal) {
  channel?.postMessage(s);
}

export function onSignal(fn: (s: CallSignal) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const canCallOtherTabs = () => channel !== null && typeof RTCPeerConnection !== "undefined";

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
  const pc = new RTCPeerConnection();
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
