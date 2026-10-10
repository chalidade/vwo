import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type PeerInfo, connectPeer, leaveCall, stopMedia } from "../fair/call";
import type { SeminarSession } from "../fair/content";
import { BOT_CHAT, BOT_NAMES, BOT_QUESTIONS, type StageChat, onStage, sendStage, stageCallId } from "../fair/stage";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";

const canShare = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
let chatN = 0;
const chatId = () => `c${Date.now().toString(36)}${chatN++}`;

function Video({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted />;
}

/** One slide of a session, as the audience sees it. */
export function StageSlide({ session, slide }: { session: SeminarSession; slide: number }) {
  const s = session.slides[Math.min(slide, session.slides.length - 1)];
  if (!s) return null;
  return (
    <div className="sx-slide st-slide" key={slide}>
      <div className="sx-slide-n">
        {slide + 1}/{session.slides.length}
      </div>
      <div className="sx-slide-title">{s.title}</div>
      <ul>
        {s.points.map((p) => (
          <li key={p} data-on="">
            {p}
          </li>
        ))}
      </ul>
      <div className="sx-brand">{session.role === "Panggung Aula" ? "Panggung Aula" : "Ruang Seminar"} · {session.speaker}</div>
    </div>
  );
}

/**
 * The speaker's page: pick a session, share the screen (or present its slides on a phone), talk
 * over the microphone, read the chat and answer questions while job seekers watch in the hall.
 */
export function SpeakerStage() {
  useFair();
  const sessions = fair.seminars();
  const [sessionId, setSessionId] = useState(sessions[0]!.id);
  const picked = sessions.find((s) => s.id === sessionId) ?? sessions[0]!;
  // On the Aula stage the speaker opens an item of the rundown (a speech, a talk show) instead of a seminar.
  const [venue, setVenue] = useState<"seminar" | "aula">("seminar");
  const rundown = fair.rundown();
  const [eventId, setEventId] = useState(() => (rundown.find((e) => e.kind === "sambutan") ?? rundown[0])?.id ?? "");
  const ev = rundown.find((e) => e.id === eventId) ?? rundown[0];
  const session: SeminarSession =
    venue === "aula" && ev ? { id: `aula-${ev.id}`, title: ev.title, speaker: ev.host, role: "Panggung Aula", slides: [{ title: ev.title, points: [`${ev.start}–${ev.end}`, ev.host], say: "" }] } : picked;
  const [live, setLive] = useState(false);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [slide, setSlide] = useState(0);
  const [chat, setChat] = useState<StageChat[]>([]);
  const [viewers, setViewers] = useState<Record<string, string>>({});
  /** How the connection to each viewer is going, so the speaker can see who actually gets the stream. */
  const [links, setLinks] = useState<Record<string, PeerInfo>>({});
  const [tab, setTab] = useState<"chat" | "qa">("chat");
  const [text, setText] = useState("");
  // The live site has only real visitors, so no demo audience there unless the speaker turns it on.
  const [bots, setBots] = useState(!LIVE);
  const [seconds, setSeconds] = useState(0);
  const [claps, setClaps] = useState<{ id: number; x: number; e: string }[]>([]);
  const [warn, setWarn] = useState<string | null>(null);
  const peers = useRef(new Map<string, { close(): void }>());
  const out = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const now = useRef({ live, session, slide, screen, chat, viewers, bots, venue });
  now.current = { live, session, slide, screen, chat, viewers, bots, venue };
  const botCrowd = bots ? 14 + (Math.floor(seconds / 20) % 7) : 0;

  const beat = () => {
    const c = now.current;
    if (!c.live) return;
    sendStage({
      type: "on",
      sessionId: c.session.id,
      title: c.session.title,
      speaker: c.session.speaker,
      role: c.session.role,
      startedAt: startedAt.current,
      screen: !!c.screen,
      slide: c.slide,
      viewers: Object.keys(c.viewers).length + (c.bots ? 14 : 0),
      venue: c.venue,
    });
  };

  const connect = (viewerId: string) => {
    peers.current.get(viewerId)?.close();
    peers.current.set(
      viewerId,
      connectPeer({ callId: stageCallId(viewerId), caller: true, kind: "video", local: out.current, onRemote: () => {}, onInfo: (i) => setLinks((l) => ({ ...l, [viewerId]: i })) }),
    );
  };

  const post = (c: Omit<StageChat, "id" | "at">) => {
    const msg = { ...c, id: chatId(), at: Date.now() };
    setChat((l) => [...l.slice(-199), msg]);
    sendStage({ type: "chat", chat: msg });
  };

  // What viewers send.
  useEffect(
    () =>
      onStage((m) => {
        const c = now.current;
        if (m.type === "hello") beat();
        else if (m.type === "join" && c.live) {
          setViewers((v) => ({ ...v, [m.viewerId]: m.name }));
          sendStage({ type: "history", to: m.viewerId, chat: c.chat.slice(-50) });
          connect(m.viewerId);
          beat();
        } else if (m.type === "leave") {
          peers.current.get(m.viewerId)?.close();
          peers.current.delete(m.viewerId);
          leaveCall(stageCallId(m.viewerId));
          setViewers((v) => {
            const { [m.viewerId]: _, ...rest } = v;
            return rest;
          });
          setLinks((l) => {
            const { [m.viewerId]: _, ...rest } = l;
            return rest;
          });
        } else if (m.type === "chat") setChat((l) => [...l.filter((x) => x.id !== m.chat.id).slice(-199), m.chat]);
        else if (m.type === "react") setClaps((l) => [...l.slice(-6), { id: Date.now() + Math.random(), x: 10 + Math.random() * 75, e: m.e }]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The heartbeat, the timer, and a demo audience.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      beat();
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  useEffect(() => {
    if (!live || !bots) return;
    const t = setInterval(() => {
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]!;
      const q = Math.random() < 0.4;
      const pool = q ? BOT_QUESTIONS : BOT_CHAT;
      post({ name, text: pool[Math.floor(Math.random() * pool.length)]!, q, bot: true });
      if (Math.random() < 0.5) setClaps((l) => [...l.slice(-6), { id: Date.now() + Math.random(), x: 10 + Math.random() * 75, e: ["👏", "🔥", "💡", "❤️"][Math.floor(Math.random() * 4)]! }]);
    }, 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, bots]);
  useEffect(beat, [slide, sessionId, screen, venue, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new screen or microphone: every viewer reconnects to get it.
  useEffect(() => {
    out.current = screen || mic ? new MediaStream([...(screen?.getTracks() ?? []), ...(mic?.getAudioTracks() ?? [])]) : null;
    if (!now.current.live) return;
    for (const p of peers.current.values()) p.close();
    peers.current.clear();
    sendStage({ type: "restart" });
  }, [screen, mic]);

  // Closing the page ends the broadcast.
  useEffect(
    () => () => {
      if (now.current.live) sendStage({ type: "off" });
      for (const p of peers.current.values()) p.close();
      stopMedia(now.current.screen);
    },
    [],
  );
  useEffect(() => () => stopMedia(mic), [mic]);

  const shareScreen = async () => {
    setWarn(null);
    if (screen) {
      stopMedia(screen);
      setScreen(null);
      return;
    }
    if (!canShare()) {
      setWarn("Browser ini tidak bisa berbagi layar (umumnya HP). Pakai mode slide: penonton melihat slide yang kamu geser.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      s.getVideoTracks()[0]?.addEventListener("ended", () => setScreen(null));
      setScreen(s);
    } catch {
      setWarn("Berbagi layar dibatalkan.");
    }
  };

  const toggleMic = async () => {
    setWarn(null);
    if (mic) {
      setMic(null);
      return;
    }
    try {
      setMic(await navigator.mediaDevices.getUserMedia({ audio: true }));
    } catch {
      setWarn("Mikrofon tidak tersedia atau belum diizinkan.");
    }
  };

  const goLive = () => {
    startedAt.current = Date.now();
    setSeconds(0);
    setChat([{ id: chatId(), name: session.speaker, text: `Selamat datang di sesi "${session.title}"! Silakan tulis pertanyaan di Q&A.`, at: Date.now(), host: true }]);
    setLive(true);
    now.current.live = true;
    beat();
  };

  const end = () => {
    sendStage({ type: "off" });
    for (const p of peers.current.values()) p.close();
    peers.current.clear();
    setViewers({});
    setLive(false);
  };

  const questions = chat.filter((c) => c.q);
  const open = questions.filter((c) => !c.done).length;
  const viewerCount = Object.keys(viewers).length;

  return (
    <main className="cp st">
      <header className="card cp-head st-head">
        <span className="cp-logo cp-logo-big"><Mic size={22} aria-hidden /></span>
        <div className="cp-head-text">
          <h1 className="cp-h1">Panggung pembicara</h1>
          {live && <span className="st-live st-live-head">● LIVE {mmss(seconds)}</span>}
          <span className="muted small">
            {venue === "aula" ? "Panggung Aula" : "Ruang Seminar"} · {fair.fair.name}. Penonton menonton dari kursi di lantai {venue === "aula" ? "Aula" : "seminar"}.
          </span>
        </div>
        <div className="cp-head-links">
          <a className="small-btn ghost cp-link" href="#/jobfair/admin">
            ← Panitia
          </a>
        </div>
      </header>

      <div className="st-grid">
        <section className="card st-main">
          <div className="st-pick">
            <label>
              Tempat
              <select value={venue} disabled={live} onChange={(e) => (setVenue(e.target.value as "seminar" | "aula"), setSlide(0))}>
                <option value="seminar">Ruang Seminar</option>
                <option value="aula">Panggung Aula (sambutan, talkshow)</option>
              </select>
            </label>
            {venue === "aula" ? (
              <label>
                Acara
                <select value={ev?.id ?? ""} disabled={live} onChange={(e) => setEventId(e.target.value)}>
                  {rundown.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.start} · {e.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
            <label>
              Sesi
              <select value={sessionId} disabled={live} onChange={(e) => (setSessionId(e.target.value), setSlide(0))}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {s.speaker}
                  </option>
                ))}
              </select>
            </label>
            )}
          </div>
          <div className="st-stage">
            {screen ? <Video stream={screen} /> : <StageSlide session={session} slide={slide} />}
            <div className="sx-claps" aria-hidden>
              {claps.map((c) => (
                <span key={c.id} style={{ left: `${c.x}%` }}>
                  {c.e}
                </span>
              ))}
            </div>
            {screen && <span className="st-tag">Layar kamu dibagikan</span>}
          </div>
          {!screen && (
            <div className="mb-nav st-slidenav">
              <button type="button" onClick={() => setSlide(Math.max(0, slide - 1))} disabled={slide === 0} aria-label="Slide sebelumnya">
                ◀
              </button>
              <span>
                Slide {slide + 1}/{session.slides.length}
              </span>
              <button type="button" onClick={() => setSlide(Math.min(session.slides.length - 1, slide + 1))} disabled={slide >= session.slides.length - 1} aria-label="Slide berikutnya">
                ▶
              </button>
            </div>
          )}
          {!screen && <p className="st-say muted small">Catatan pembicara: {session.slides[slide]?.say}</p>}
          <div className="st-controls">
            <button type="button" className="st-btn" data-on={screen ? "" : undefined} onClick={() => void shareScreen()}>
              {screen ? "Stop share" : "Share layar"}
            </button>
            <button type="button" className="st-btn" data-on={mic ? "" : undefined} onClick={() => void toggleMic()}>
              {mic ? "Mic nyala" : "Mic mati"}
            </button>
            {live ? (
              <button type="button" className="st-btn st-end" onClick={end}>
                ⏹ Akhiri siaran
              </button>
            ) : (
              <button type="button" className="st-btn st-go" onClick={goLive}>
                Mulai siaran
              </button>
            )}
          </div>
          {warn && <p className="cp-warn">{warn}</p>}
          {LIVE ? (
            <p className="muted small st-note">
              {viewerCount} penonton. Siaran sampai ke semua pengunjung yang duduk di ruang seminar (Lantai 5) atau di Aula (Lantai 1), di perangkat mana pun.
            </p>
          ) : null}
          {viewerCount > 0 && (
            <ul className="st-links small">
              {Object.entries(viewers).map(([id, who]) => {
                const l = links[id];
                const ok = l?.state === "connected";
                const bad = l?.state === "failed" || l?.state === "disconnected";
                return (
                  <li key={id} data-ok={ok ? "" : undefined} data-bad={bad ? "" : undefined}>
                    {ok ? "🟢" : bad ? "🔴" : "🟡"} {who || "Penonton"} · {ok ? (l.route === "relay" ? "lewat relay" : "langsung") : bad ? "gagal, menunggu sambung ulang" : "menyambungkan"}
                  </li>
                );
              })}
            </ul>
          )}
          {!LIVE && (
            <>
              <p className="muted small st-note">
                {viewerCount} penonton dari tab lain{bots && live ? ` + ${botCrowd} penonton bot demo` : ""}. Demo ini tanpa server: siaran sampai ke tab lain di browser yang sama (buka{" "}
                <a href="#/jobfair" target="_blank" rel="noreferrer">
                  job fair
                </a>{" "}
                di tab baru, naik lift ke Lantai 5 untuk seminar, atau tetap di Lantai 1 untuk Aula, duduk). Untuk penonton di HP lain, versi asli memakai server siaran.
              </p>
              <label className="st-bots small">
                <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} /> Penonton bot (chat dan pertanyaan simulasi)
              </label>
            </>
          )}
        </section>

        <section className="card st-side">
          <nav className="cp-tabs st-tabs">
            <button type="button" data-active={tab === "chat" ? "" : undefined} onClick={() => setTab("chat")}>
              Chat
            </button>
            <button type="button" data-active={tab === "qa" ? "" : undefined} onClick={() => setTab("qa")}>
              Q&A {open > 0 && <span className="cp-count">{open}</span>}
            </button>
          </nav>
          <ul className="st-chat">
            {(tab === "chat" ? chat : questions).length === 0 && <li className="muted small">{live ? "Belum ada pesan." : "Mulai siaran untuk membuka chat."}</li>}
            {(tab === "chat" ? chat : questions)
              .slice()
              .reverse()
              .map((c) => (
                <li key={c.id} data-host={c.host ? "" : undefined} data-q={c.q ? "" : undefined} data-done={c.done ? "" : undefined}>
                  <b>
                    {c.name}
                    {c.bot && <span className="muted"> · bot</span>}
                  </b>{" "}
                  {c.q && <span className="st-q">Tanya</span>} {c.text}
                  {c.q && !c.done && (
                    <button
                      type="button"
                      className="small-btn ghost"
                      onClick={() => {
                        const done = { ...c, done: true };
                        setChat((l) => l.map((x) => (x.id === c.id ? done : x)));
                        sendStage({ type: "chat", chat: done });
                      }}
                    >
                      ✓ Dijawab
                    </button>
                  )}
                </li>
              ))}
          </ul>
          <form
            className="st-send"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim() || !live) return;
              post({ name: session.speaker, text: text.trim().slice(0, 280), host: true });
              setText("");
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={live ? "Balas penonton..." : "Mulai siaran dulu"} disabled={!live} maxLength={280} />
            <button type="submit" disabled={!live || !text.trim()}>
              Kirim
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
