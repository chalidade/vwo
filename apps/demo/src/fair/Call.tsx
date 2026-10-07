import { useEffect, useRef, useState } from "react";
import { type Look, Person } from "@vwo/ui";
import { BOT_CALL_LINES } from "./company";
import { type CallKind, type RingSignal, connectPeer, getMedia, onSignal, sendSignal, stopMedia } from "./call";

export type CallResult = { answered: boolean; seconds: number; result: "ended" | "declined" | "missed" };

type Phase = "incoming" | "ringing" | "connecting" | "live";

const RING_MS = 30_000;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Video({ stream, muted, className }: { stream: MediaStream; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

function AudioOut({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

/**
 * A full-screen call. The company starts it from an application (`outgoing`, or `bot` for a
 * bot applicant); the job seeker gets it as `incoming` and picks up or declines.
 */
export function CallScreen({
  kind,
  peerName,
  peerSub,
  peerLook,
  peerLogo,
  peerColor = "#2563eb",
  bot,
  outgoing,
  incoming,
  onEnd,
}: {
  kind: CallKind;
  peerName: string;
  peerSub: string;
  peerLook?: Look;
  peerLogo?: string;
  peerColor?: string;
  /** Calling a bot applicant: it picks up by itself and talks from a script. */
  bot?: boolean;
  outgoing?: RingSignal;
  incoming?: RingSignal;
  onEnd: (r: CallResult) => void;
}) {
  const callId = (outgoing ?? incoming)?.callId ?? "bot";
  const [phase, setPhase] = useState<Phase>(incoming ? "incoming" : "ringing");
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [noMedia, setNoMedia] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(kind === "video");
  const [seconds, setSeconds] = useState(0);
  const [line, setLine] = useState(0);
  const peer = useRef<{ close(): void } | null>(null);
  const done = useRef(false);
  const localRef = useRef<MediaStream | null>(null);
  const liveRef = useRef(false);
  const secondsRef = useRef(0);

  const finish = (result: CallResult["result"], tell = true) => {
    if (done.current) return;
    done.current = true;
    if (tell && !bot) sendSignal({ type: result === "declined" ? "decline" : "hangup", callId });
    peer.current?.close();
    stopMedia(localRef.current);
    onEnd({ answered: liveRef.current, seconds: secondsRef.current, result });
  };

  const goLive = () => {
    liveRef.current = true;
    setPhase("live");
  };

  // The caller's camera starts while it rings, like a real call app.
  useEffect(() => {
    if (incoming) return;
    let alive = true;
    void getMedia(kind).then((s) => {
      if (!alive) return stopMedia(s);
      localRef.current = s;
      setLocal(s);
      setNoMedia(!s);
      if (outgoing) sendSignal(outgoing);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signals from the other tab.
  useEffect(
    () =>
      onSignal((s) => {
        if (s.callId !== callId || done.current) return;
        if (s.type === "accept" && outgoing) {
          setPhase("connecting");
          peer.current = connectPeer({
            callId,
            caller: true,
            kind,
            local: localRef.current,
            onRemote: (r) => {
              setRemote(r);
              goLive();
            },
            onState: (st) => st === "connected" && goLive(),
          });
        } else if (s.type === "decline") finish("declined", false);
        else if (s.type === "hangup") finish(liveRef.current ? "ended" : "missed", false);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Nobody picks up: give up after a while. A bot picks up after a couple of rings.
  useEffect(() => {
    if (phase !== "ringing") return;
    if (bot) {
      const t = setTimeout(() => (Math.random() < 0.12 ? finish("declined") : goLive()), 2600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => finish("missed"), RING_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (bot && secondsRef.current % 4 === 1) setLine((n) => Math.min(n + 1, BOT_CALL_LINES.length));
    }, 1000);
    return () => clearInterval(t);
  }, [phase, bot]);

  useEffect(
    () => () => {
      // Leaving the page hangs up.
      if (!done.current) {
        done.current = true;
        if (!bot) sendSignal({ type: "hangup", callId });
        peer.current?.close();
        stopMedia(localRef.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const accept = async () => {
    setPhase("connecting");
    const s = await getMedia(kind);
    localRef.current = s;
    setLocal(s);
    setNoMedia(!s);
    peer.current = connectPeer({
      callId,
      caller: false,
      kind,
      local: s,
      onRemote: (r) => {
        setRemote(r);
        goLive();
      },
      onState: (st) => st === "connected" && goLive(),
    });
    sendSignal({ type: "accept", callId });
  };

  const toggle = (k: "audio" | "video") => {
    const on = k === "audio" ? !mic : !cam;
    localRef.current?.getTracks().forEach((t) => t.kind === k && (t.enabled = on));
    if (k === "audio") setMic(on);
    else setCam(on);
  };

  const remoteHasVideo = !!remote?.getVideoTracks().length;
  const status =
    phase === "incoming"
      ? kind === "video"
        ? "Video call masuk..."
        : "Panggilan masuk..."
      : phase === "ringing"
        ? "Memanggil..."
        : phase === "connecting"
          ? "Menyambungkan..."
          : mmss(seconds);

  const avatar = (
    <div className="cl-avatar" data-talking={bot && phase === "live" ? "" : undefined} style={{ ["--c" as string]: peerColor }}>
      {peerLook ? (
        <div className="cl-person">
          <Person look={peerLook} size={2.2} />
        </div>
      ) : (
        <span className="cl-logo">{peerLogo ?? peerName.slice(0, 1)}</span>
      )}
    </div>
  );

  return (
    <div className="cl-screen" data-kind={kind} data-phase={phase} role="dialog" aria-label={`Panggilan dengan ${peerName}`}>
      <div className="cl-stage">
        {kind === "video" && remoteHasVideo && phase === "live" ? <Video stream={remote!} className="cl-remote" /> : avatar}
        {remote && !remoteHasVideo && <AudioOut stream={remote} />}
        {kind === "video" && local && local.getVideoTracks().length > 0 && (
          <div className="cl-self" data-off={cam ? undefined : ""}>
            <Video stream={local} muted />
            {!cam && <span>Kamera mati</span>}
          </div>
        )}
      </div>
      <div className="cl-info">
        <b>{peerName}</b>
        <span>{peerSub}</span>
        <span className="cl-status">
          {kind === "video" ? "🎥" : "📞"} {status}
        </span>
        {bot && phase === "live" && line > 0 && <p className="cl-caption">“{BOT_CALL_LINES[line - 1]}”</p>}
        {noMedia && phase !== "incoming" && <p className="cl-note">Kamera/mikrofon tidak tersedia atau belum diizinkan. Kamu tetap bisa mendengar dan melihat lawan bicara.</p>}
        {bot && <p className="cl-note">Pelamar ini bot demo: jawabannya simulasi.</p>}
      </div>
      <div className="cl-controls">
        {phase === "incoming" ? (
          <>
            <button type="button" className="cl-btn cl-decline" onClick={() => finish("declined")}>
              ✕<span>Tolak</span>
            </button>
            <button type="button" className="cl-btn cl-accept" onClick={() => void accept()}>
              {kind === "video" ? "🎥" : "📞"}
              <span>Angkat</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="cl-btn" data-off={mic ? undefined : ""} onClick={() => toggle("audio")} aria-label={mic ? "Matikan mikrofon" : "Nyalakan mikrofon"}>
              {mic ? "🎙️" : "🔇"}
              <span>{mic ? "Mic" : "Bisu"}</span>
            </button>
            {kind === "video" && (
              <button type="button" className="cl-btn" data-off={cam ? undefined : ""} onClick={() => toggle("video")} aria-label={cam ? "Matikan kamera" : "Nyalakan kamera"}>
                {cam ? "📷" : "🚫"}
                <span>Kamera</span>
              </button>
            )}
            <button type="button" className="cl-btn cl-decline" onClick={() => finish(liveRef.current ? "ended" : "missed")}>
              ☎<span>Tutup</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
