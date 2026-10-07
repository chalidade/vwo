import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type Look, Person } from "@vwo/ui";
import { SEMINARS, type SeminarSession, lineMs, liveSeminar, seminarScript } from "./content";
import { Modal } from "./Modal";

/** Watching a seminar from a seat, like a video call: the facilitator shares their screen and talks
 *  through the slides with subtitles, then hands out a certificate. */
export function SeminarView({
  attended,
  name,
  speakerLook,
  audience,
  onFinish,
  onClose,
}: {
  attended: string[];
  name: string;
  speakerLook: (speaker: string) => Look;
  /** People in the room, for the viewer count. */
  audience: number;
  onFinish: (id: string) => void;
  onClose: () => void;
}) {
  const [session, setSession] = useState<SeminarSession>(() => liveSeminar());
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState(false);

  if (picking)
    return (
      <Modal title="🎤 Jadwal seminar" onClose={() => setPicking(false)} className="fx-seminar">
        <p className="sp-summary">Tiap sesi selesai dapat e-sertifikat dan XP.</p>
        <ul className="fx-sessions">
          {SEMINARS.map((s) => (
            <li key={s.id}>
              <span>
                <b>{s.title}</b>
                <span className="sp-muted">
                  {" "}
                  · {s.speaker}, {s.role}
                  {s.id === liveSeminar().id ? " · 🔴 sedang di panggung" : ""}
                </span>
              </span>
              <button
                type="button"
                className="mb-order"
                onClick={() => {
                  setSession(s);
                  setDone(false);
                  setPicking(false);
                }}
              >
                {attended.includes(s.id) ? "✓ Ulangi" : "Ikuti"}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    );

  if (done)
    return (
      <Modal title="🎓 E-sertifikat" onClose={onClose} className="fx-seminar">
        <Certificate
          kind="SEMINAR"
          name={name}
          line={
            <>
              telah mengikuti seminar <b>{session.title}</b>
            </>
          }
          by={`${session.speaker} · ${session.role}`}
          code={`SEM-${session.id.toUpperCase()}-${certNo(name + session.id)}`}
        />
        <div className="fx-cert-actions">
          <button type="button" className="mb-order" onClick={() => setPicking(true)}>
            Sesi lain
          </button>
          <button type="button" className="mb-order jb-apply" onClick={onClose}>
            Selesai
          </button>
        </div>
      </Modal>
    );

  return (
    <LiveScreen
      key={session.id}
      session={session}
      look={speakerLook(session.speaker)}
      audience={audience}
      onPick={() => setPicking(true)}
      onEnd={() => {
        onFinish(session.id);
        setDone(true);
      }}
      onClose={onClose}
    />
  );
}

function LiveScreen({ session, look, audience, onPick, onEnd, onClose }: { session: SeminarSession; look: Look; audience: number; onPick: () => void; onEnd: () => void; onClose: () => void }) {
  const script = useMemo(() => seminarScript(session), [session]);
  const total = useMemo(() => script.reduce((n, l) => n + lineMs(l.text), 0), [script]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [claps, setClaps] = useState<{ id: number; x: number; e: string }[]>([]);

  // The scene re-renders every frame anyway; a steady interval keeps the talk in real time.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setAt((t) => t + 200), 200);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (at >= total) onEnd();
  }, [at, total]);
  // Now and then someone in the room reacts.
  useEffect(() => {
    const id = setInterval(() => {
      const e = ["👏", "👍", "💡", "🔥", "❤️"][Math.floor(Math.random() * 5)]!;
      setClaps((c) => [...c.slice(-5), { id: Date.now(), x: 10 + Math.random() * 70, e }]);
    }, 2600);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  });

  let k = 0;
  let t = at;
  while (k < script.length - 1 && t >= lineMs(script[k]!.text)) t -= lineMs(script[k++]!.text);
  const line = script[k]!;
  const slide = session.slides[line.slide]!;
  /** Skip to the start of the next slide. */
  const next = () => {
    let sum = 0;
    for (const l of script) {
      if (l.slide > line.slide) return setAt(sum);
      sum += lineMs(l.text);
    }
    setAt(total);
  };

  return (
    <div className="mb-backdrop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sx" role="dialog" aria-label={`Seminar ${session.title}`}>
        <div className="sx-top">
          <span className="sx-live">● LIVE</span>
          <span className="sx-title">{session.title}</span>
          <span className="sx-viewers">👥 {audience}</span>
          <button type="button" className="sx-x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="sx-stage">
          <div className="sx-share">🖥️ {session.speaker} sedang berbagi layar</div>
          <div className="sx-slide" key={line.slide}>
            <div className="sx-slide-n">
              {line.slide + 1}/{session.slides.length}
            </div>
            <div className="sx-slide-title">{slide.title}</div>
            <ul>
              {slide.points.map((p, i) => (
                <li key={p} data-on={i < line.reveal ? "" : undefined} data-now={i === line.reveal - 1 ? "" : undefined}>
                  {p}
                </li>
              ))}
            </ul>
            <div className="sx-brand">Ruang Seminar · Lantai 5</div>
          </div>
          <div className="sx-cam" data-talking={paused ? undefined : ""}>
            <div className="sx-cam-person">
              <Person look={look} size={1.6} />
            </div>
            <span className="sx-cam-name">🎙️ {session.speaker}</span>
          </div>
          <div className="sx-claps" aria-hidden>
            {claps.map((c) => (
              <span key={c.id} style={{ left: `${c.x}%` }}>
                {c.e}
              </span>
            ))}
          </div>
          {captions && (
            <div className="sx-cc" key={k}>
              <b>{session.speaker}:</b> {line.text}
            </div>
          )}
        </div>
        <div className="sx-progress">
          <span style={{ width: `${Math.min(100, (at / total) * 100)}%` }} />
        </div>
        <div className="sx-bar">
          <button type="button" onClick={() => setPaused(!paused)} title={paused ? "Lanjutkan" : "Jeda"}>
            {paused ? "▶" : "⏸"}
          </button>
          <button type="button" onClick={next} title="Materi berikutnya">
            ⏭
          </button>
          <button type="button" data-active={captions ? "" : undefined} onClick={() => setCaptions(!captions)} title="Teks">
            CC
          </button>
          <button
            type="button"
            onClick={() => setClaps((c) => [...c.slice(-5), { id: Date.now(), x: 80, e: "👏" }])}
            title="Tepuk tangan"
          >
            👏
          </button>
          <button type="button" className="sx-sessions" onClick={onPick}>
            Jadwal
          </button>
        </div>
      </div>
    </div>
  );
}

/** A certificate card, for seminars and the psikotes. */
export function Certificate({ kind, name, line, by, code, extra }: { kind: string; name: string; line: ReactNode; by: string; code: string; extra?: ReactNode }) {
  return (
    <div className="fx-cert">
      <div className="fx-cert-seal" aria-hidden>
        🏅
      </div>
      <div className="fx-cert-head">SERTIFIKAT {kind}</div>
      <p>Diberikan kepada</p>
      <b className="fx-cert-name">{name}</b>
      <p>{line}</p>
      {extra}
      <p className="sp-muted">{by}</p>
      <div className="fx-cert-foot">
        <span>No. {code}</span>
        <span>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>
    </div>
  );
}

/** A short, stable number for a certificate. */
export function certNo(seed: string) {
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return String(h % 1000000).padStart(6, "0");
}
