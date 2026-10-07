import { useEffect, useRef, useState } from "react";
import { StageSlide } from "../organizer/Speaker";
import { connectPeer } from "./call";
import type { SeminarSession } from "./content";
import { type StageChat, type StageLive, onStage, sendStage, stageCallId } from "./stage";

let chatN = 0;

function Media({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline />;
}

/** The speaker's voice when they present slides instead of a screen. */
function Sound({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

/** A job seeker watches a speaker who is live: their shared screen (or slides), chat and Q&A. */
export function StageWatch({
  live,
  session,
  viewerId,
  name,
  onFinish,
  onRecorded,
  onClose,
}: {
  live: StageLive;
  session: SeminarSession;
  viewerId: string;
  name: string;
  /** Watched long enough, or the speaker ended: hand out the certificate. */
  onFinish: () => void;
  /** Watch the recorded sessions instead. */
  onRecorded: () => void;
  onClose: () => void;
}) {
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [chat, setChat] = useState<StageChat[]>([]);
  const [text, setText] = useState("");
  const [ask, setAsk] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [watched, setWatched] = useState(0);
  const [claps, setClaps] = useState<{ id: number; x: number; e: string }[]>([]);
  const peer = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    const join = () => {
      peer.current?.close();
      setRemote(null);
      peer.current = connectPeer({ callId: stageCallId(viewerId), caller: false, kind: "video", local: null, onRemote: (s) => setRemote(new MediaStream(s.getTracks())) });
      sendStage({ type: "join", viewerId, name });
    };
    const off = onStage((m) => {
      if (m.type === "restart") join();
      else if (m.type === "history" && m.to === viewerId) setChat(m.chat);
      else if (m.type === "chat") setChat((l) => [...l.filter((x) => x.id !== m.chat.id), m.chat].slice(-200));
      else if (m.type === "react") setClaps((l) => [...l.slice(-6), { id: Date.now() + Math.random(), x: 10 + Math.random() * 75, e: m.e }]);
    });
    join();
    const t = setInterval(() => setWatched((n) => n + 1), 1000);
    return () => {
      off();
      clearInterval(t);
      sendStage({ type: "leave", viewerId, name });
      peer.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
      else if ((e.target as HTMLElement)?.tagName !== "INPUT") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });

  const react = (e: string) => {
    sendStage({ type: "react", e });
    setClaps((l) => [...l.slice(-6), { id: Date.now(), x: 80, e }]);
  };
  const send = () => {
    const t = text.trim();
    if (!t) return;
    const msg: StageChat = { id: `v${viewerId}${Date.now().toString(36)}${chatN++}`, name, text: t.slice(0, 280), at: Date.now(), q: ask || undefined };
    setChat((l) => [...l, msg]);
    sendStage({ type: "chat", chat: msg });
    setText("");
    setAsk(false);
  };
  const hasVideo = !!remote?.getVideoTracks().length && live.screen;
  const canFinish = watched >= 30;

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sx st-watch" role="dialog" aria-label={`Seminar live ${live.title}`}>
        <div className="sx-top">
          <span className="sx-live">● LIVE</span>
          <span className="sx-title">{live.title}</span>
          <span className="sx-viewers">👥 {live.viewers}</span>
          <button type="button" className="sx-x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="sx-stage">
          {live.screen && <div className="sx-share">🖥️ {live.speaker} sedang berbagi layar</div>}
          {hasVideo ? <Media stream={remote!} /> : live.screen ? <div className="st-wait">Menyambungkan layar pembicara…</div> : <StageSlide session={session} slide={live.slide} />}
          {remote && !hasVideo && remote.getAudioTracks().length > 0 && <Sound stream={remote} />}
          <div className="sx-claps" aria-hidden>
            {claps.map((c) => (
              <span key={c.id} style={{ left: `${c.x}%` }}>
                {c.e}
              </span>
            ))}
          </div>
        </div>
        {showChat && (
          <ul className="st-chat st-chat-watch">
            {chat.slice(-30).map((c) => (
              <li key={c.id} data-host={c.host ? "" : undefined} data-q={c.q ? "" : undefined} data-done={c.done ? "" : undefined}>
                <b>{c.name}</b> {c.q && <span className="st-q">{c.done ? "✓ Dijawab" : "Tanya"}</span>} {c.text}
              </li>
            ))}
          </ul>
        )}
        <form
          className="st-send"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <button type="button" className="st-ask" data-on={ask ? "" : undefined} onClick={() => setAsk(!ask)} title="Kirim sebagai pertanyaan">
            ❓
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ask ? "Tulis pertanyaan untuk pembicara..." : "Tulis di chat..."} maxLength={280} />
          <button type="submit" disabled={!text.trim()}>
            Kirim
          </button>
        </form>
        <div className="sx-bar">
          {["👏", "🔥", "💡", "❤️"].map((e) => (
            <button key={e} type="button" onClick={() => react(e)} title="Reaksi">
              {e}
            </button>
          ))}
          <button type="button" data-active={showChat ? "" : undefined} onClick={() => setShowChat(!showChat)} title="Chat">
            💬
          </button>
          <button type="button" className="sx-sessions" onClick={onRecorded}>
            Rekaman
          </button>
          <button type="button" className="sx-sessions" disabled={!canFinish} onClick={onFinish} title={canFinish ? "Ambil sertifikat" : "Tonton minimal 30 detik"}>
            🎓 {canFinish ? "Sertifikat" : `${30 - watched}s`}
          </button>
        </div>
      </div>
    </div>
  );
}
