import { useEffect, useMemo, useRef, useState } from "react";
import { CAREER_ARTICLES, CAREER_QUIZ, type CareerArticle, GAME_DAILY_CAP, stepKey } from "./content";
import { Modal } from "./Modal";
import { type Board, type Dir, canMove, coinsFor, newBoard, slide, spawn } from "./g2048";

type GameId = "quiz" | "catch" | "memory" | "2048";

const GAMES: { id: GameId; emoji: string; name: string; desc: string; max: number }[] = [
  { id: "quiz", emoji: "🧩", name: "Kuis Karier", desc: "5 soal seputar melamar kerja. 2 koin tiap jawaban benar.", max: 10 },
  { id: "catch", emoji: "🪙", name: "Tangkap Koin", desc: "20 detik, tap koin yang jatuh, hindari bom.", max: 10 },
  { id: "memory", emoji: "🃏", name: "Cocokkan Logo", desc: "Temukan 6 pasang logo perusahaan secepatnya.", max: 6 },
  { id: "2048", emoji: "🔢", name: "2048", desc: "Geser angka, gabungkan yang sama. Ubin 128 ke atas dapat koin.", max: 10 },
];

export interface RelatedJob {
  boothId: string;
  company: string;
  title: string;
}

/** The lounge sofa: short mini games that pay a few free coins (up to a daily cap), and a reading
 *  corner with articles about professions. */
export function SofaGames({
  left,
  logos,
  onReward,
  read,
  onRead,
  roadmap,
  onToggleStep,
  jobsFor,
  onGoToBooth,
  onClose,
}: {
  /** Coins the games can still pay out today. */
  left: number;
  /** Company logos and colours for the memory game. */
  logos: { logo: string; color: string }[];
  /** Pays the reward and returns the coins actually given. */
  onReward: (game: string, coins: number) => number;
  /** Articles already read to the end. */
  read: string[];
  /** Finished an article; true the first time (XP given). */
  onRead: (id: string) => boolean;
  /** Roadmap steps ticked off, per article. */
  roadmap: Record<string, string[]>;
  onToggleStep: (articleId: string, key: string) => void;
  /** Open jobs at the fair that match an article's profession. */
  jobsFor: (keywords: string[]) => RelatedJob[];
  onGoToBooth: (boothId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"play" | "read">("play");
  const [article, setArticle] = useState<CareerArticle | null>(null);
  const [game, setGame] = useState<GameId | null>(null);
  const [result, setResult] = useState<{ name: string; score: string; coins: number; asked: number } | null>(null);
  const finish = (id: GameId, score: string, coins: number) => {
    const g = GAMES.find((x) => x.id === id)!;
    setResult({ name: g.name, score, asked: coins, coins: onReward(g.name, coins) });
    setGame(null);
  };

  const tabs = !game && !result && !article && (
    <div className="mb-tabs fx-tabs">
      <button type="button" data-active={tab === "play" ? "" : undefined} onClick={() => setTab("play")}>
        🎮 Main game
      </button>
      <button type="button" data-active={tab === "read" ? "" : undefined} onClick={() => setTab("read")}>
        📚 Pojok baca ({read.length}/{CAREER_ARTICLES.length})
      </button>
    </div>
  );

  if (tab === "read" || article)
    return (
      <Modal title="🛋️ Santai di sofa" onClose={onClose} className="fx-games">
        {tabs}
        {article ? (
          <Article
            a={article}
            done={read.includes(article.id)}
            steps={roadmap[article.id] ?? []}
            onToggle={(key) => onToggleStep(article.id, key)}
            jobs={jobsFor(article.keywords)}
            onFinish={() => onRead(article.id)}
            onGoToBooth={onGoToBooth}
            onBack={() => setArticle(null)}
          />
        ) : (
          <>
            <p className="sp-summary">Kenali profesi sambil istirahat. Selesai membaca dapat XP dan bisa langsung lihat lowongan yang cocok di job fair ini.</p>
            <div className="gm-list">
              {CAREER_ARTICLES.map((a) => (
                <button key={a.id} type="button" className="gm-card" onClick={() => setArticle(a)}>
                  <span className="gm-emoji">{a.emoji}</span>
                  <span>
                    <b>{a.title}</b>
                    <span className="sp-muted">
                      {a.role} · {a.minutes} menit baca
                    </span>
                  </span>
                  <span className="gm-max">
                    {read.includes(a.id) ? "✓ Dibaca" : "Baca"}
                    <span className="rd-rm">
                      🗺️ {stepsDone(roadmap[a.id])}/{a.roadmap.reduce((n, st) => n + st.steps.length, 0)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>
    );

  return (
    <Modal title="🛋️ Santai di sofa" onClose={onClose} className="fx-games">
      {tabs}
      {result ? (
        <div className="gm-result">
          <div className="gm-big">{result.coins ? `+${result.coins} 🪙` : "🎉"}</div>
          <p>
            <b>{result.name}</b> · {result.score}
          </p>
          {result.coins < result.asked && <p className="sp-muted">Batas koin mini game hari ini sudah tercapai. Main lagi tetap boleh, besok dapat koin lagi.</p>}
          <button type="button" className="mb-order jb-apply" onClick={() => setResult(null)}>
            Main lagi
          </button>
        </div>
      ) : game === "quiz" ? (
        <Quiz onDone={(right, total) => finish("quiz", `${right}/${total} benar`, right * 2)} />
      ) : game === "catch" ? (
        <CatchCoins onDone={(score) => finish("catch", `${score} poin`, Math.min(10, Math.floor(score / 2)))} />
      ) : game === "2048" ? (
        <Game2048 onDone={(best, score) => finish("2048", `ubin ${best} · skor ${score}`, coinsFor(best))} />
      ) : game === "memory" ? (
        <Memory logos={logos} onDone={(moves) => finish("memory", `selesai dalam ${moves} langkah`, moves <= 10 ? 6 : moves <= 14 ? 4 : 2)} />
      ) : (
        <>
          <p className="sp-summary">
            Istirahat sebentar sambil main. Koin gratis dari mini game hari ini: <b>{left}</b> dari {GAME_DAILY_CAP} tersisa.
          </p>
          <div className="gm-list">
            {GAMES.map((g) => (
              <button key={g.id} type="button" className="gm-card" onClick={() => setGame(g.id)}>
                <span className="gm-emoji">{g.emoji}</span>
                <span>
                  <b>{g.name}</b>
                  <span className="sp-muted">{g.desc}</span>
                </span>
                <span className="gm-max">s.d. {g.max} 🪙</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function shuffle<T>(list: readonly T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function Quiz({ onDone }: { onDone: (right: number, total: number) => void }) {
  const questions = useMemo(() => shuffle(CAREER_QUIZ).slice(0, 5), []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const q = questions[i]!;
  const next = () => {
    if (i === questions.length - 1) onDone(right, questions.length);
    else {
      setI(i + 1);
      setPicked(null);
    }
  };
  return (
    <div className="fx-question">
      <div className="gm-progress">
        Soal {i + 1}/{questions.length} · ✅ {right}
      </div>
      <div className="fx-q">{q.q}</div>
      <div className="fx-options">
        {q.options.map((o, k) => (
          <button
            key={k}
            type="button"
            disabled={picked !== null}
            data-right={picked !== null && k === q.answer ? "" : undefined}
            data-wrong={picked === k && k !== q.answer ? "" : undefined}
            onClick={() => {
              setPicked(k);
              if (k === q.answer) setRight(right + 1);
            }}
          >
            <span className="fx-opt">{String.fromCharCode(65 + k)}</span> {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="gm-why">
          {picked === q.answer ? "✅ Benar! " : "❌ Kurang tepat. "}
          {q.why}
          <button type="button" className="mb-order" onClick={next}>
            {i === questions.length - 1 ? "Lihat hasil" : "Lanjut ▶"}
          </button>
        </div>
      )}
    </div>
  );
}

const CATCH_SECONDS = 20;
const FALL_MS = 2300;

function CatchCoins({ onDone }: { onDone: (score: number) => void }) {
  const [items, setItems] = useState<{ id: number; x: number; bomb: boolean; at: number }[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(CATCH_SECONDS);
  const [pops, setPops] = useState<{ id: number; x: number; text: string }[]>([]);
  const seq = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    const spawn = setInterval(() => {
      const now = Date.now();
      setItems((list) => [...list.filter((it) => now - it.at < FALL_MS), { id: ++seq.current, x: 6 + Math.random() * 82, bomb: Math.random() < 0.22, at: now }]);
    }, 420);
    const tick = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => {
      clearInterval(spawn);
      clearInterval(tick);
    };
  }, []);
  useEffect(() => {
    if (left <= 0) onDone(Math.max(0, scoreRef.current));
  }, [left]);

  const hit = (id: number, x: number, bomb: boolean) => {
    setItems((list) => list.filter((it) => it.id !== id));
    setScore((s) => Math.max(0, s + (bomb ? -3 : 1)));
    setPops((p) => [...p.slice(-4), { id, x, text: bomb ? "−3 💥" : "+1" }]);
  };

  return (
    <div className="gm-catch-wrap">
      <div className="gm-progress">
        ⏱ {Math.max(0, left)} detik · Poin <b>{score}</b>
      </div>
      <div className="gm-catch">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className="gm-drop"
            style={{ left: `${it.x}%`, animationDuration: `${FALL_MS}ms` }}
            onPointerDown={(e) => {
              e.preventDefault();
              hit(it.id, it.x, it.bomb);
            }}
            aria-label={it.bomb ? "Bom" : "Koin"}
          >
            {it.bomb ? "💣" : "🪙"}
          </button>
        ))}
        {pops.map((p) => (
          <span key={p.id} className="gm-pop" style={{ left: `${p.x}%` }}>
            {p.text}
          </span>
        ))}
      </div>
      <p className="sp-muted">Tiap 2 poin jadi 1 koin, maksimal 10 koin.</p>
    </div>
  );
}

function Memory({ logos, onDone }: { logos: { logo: string; color: string }[]; onDone: (moves: number) => void }) {
  // Shuffle once per round: the hall re-renders every frame with a fresh `logos` array,
  // and two companies can share the same initials, so pairs are built from unique logos.
  const [cards] = useState(() => {
    const unique = [...new Map(logos.map((l) => [l.logo, l])).values()];
    const six = shuffle(unique).slice(0, 6);
    return shuffle([...six, ...six].map((l, i) => ({ key: i, ...l })));
  });
  const pairs = cards.length / 2;
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((i) => cards[i]!);
    const id = setTimeout(
      () => {
        if (a!.logo === b!.logo) {
          const next = new Set(done).add(a!.logo);
          setDone(next);
          if (next.size === pairs) onDone(moves);
        }
        setOpen([]);
      },
      a!.logo === b!.logo ? 250 : 700,
    );
    return () => clearTimeout(id);
  }, [open]);

  return (
    <div>
      <div className="gm-progress">
        Langkah {moves} · Pasangan {done.size}/{pairs}
      </div>
      <div className="gm-memory">
        {cards.map((c, i) => {
          const shown = open.includes(i) || done.has(c.logo);
          return (
            <button
              key={c.key}
              type="button"
              className="gm-tile"
              data-shown={shown ? "" : undefined}
              style={{ ["--c" as string]: c.color }}
              disabled={shown || open.length === 2}
              onClick={() => {
                const next = [...open, i];
                setOpen(next);
                if (next.length === 2) setMoves(moves + 1);
              }}
            >
              {shown ? c.logo : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const stepsDone = (list?: string[]) => (list ?? []).filter((k) => !k.startsWith("stage:")).length;

function Article({
  a,
  done,
  steps,
  onToggle,
  jobs,
  onFinish,
  onGoToBooth,
  onBack,
}: {
  a: CareerArticle;
  done: boolean;
  steps: string[];
  onToggle: (key: string) => void;
  jobs: RelatedJob[];
  onFinish: () => boolean;
  onGoToBooth: (boothId: string) => void;
  onBack: () => void;
}) {
  const [finished, setFinished] = useState<null | boolean>(null);
  const total = a.roadmap.reduce((n, st) => n + st.steps.length, 0);
  return (
    <article className="rd">
      <button type="button" className="rd-back" onClick={onBack}>
        ◀ Daftar bacaan
      </button>
      <header className="rd-head">
        <span className="rd-emoji">{a.emoji}</span>
        <h3>{a.title}</h3>
        <span className="sp-muted">
          {a.role} · {a.minutes} menit baca
        </span>
      </header>
      {a.sections.map((s) => (
        <section key={s.heading}>
          <h4>{s.heading}</h4>
          <p>{s.text}</p>
        </section>
      ))}
      <section>
        <h4>Skill penting</h4>
        <div className="rd-chips">
          {a.skills.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
      </section>
      <section className="rd-map">
        <h4>
          🗺️ Roadmap jadi {a.role} ahli <span className="sp-muted">· {stepsDone(steps)}/{total} langkah</span>
        </h4>
        <span className="fx-bar">
          <span style={{ width: `${(stepsDone(steps) / total) * 100}%` }} />
        </span>
        <ol className="rd-stages">
          {a.roadmap.map((st, i) => {
            const all = st.steps.every((_, k) => steps.includes(stepKey(i, k)));
            return (
              <li key={st.level} data-done={all ? "" : undefined}>
                <div className="rd-stage-head">
                  <b>
                    {all ? "✅" : `${i + 1}.`} {st.level}
                  </b>
                  <span className="sp-muted">{st.time}</span>
                </div>
                {st.steps.map((text, k) => {
                  const key = stepKey(i, k);
                  return (
                    <label key={key} className="rd-step">
                      <input type="checkbox" checked={steps.includes(key)} onChange={() => onToggle(key)} />
                      <span>{text}</span>
                    </label>
                  );
                })}
              </li>
            );
          })}
        </ol>
        <p className="sp-muted">Centang langkah yang sudah kamu lakukan. Tiap tahap selesai dapat XP, progresmu tersimpan.</p>
      </section>
      <p className="rd-pay">
        💰 Perkiraan gaji awal: <b>{a.pay}</b> per bulan <span className="sp-muted">(tergantung kota dan perusahaan)</span>
      </p>
      {jobs.length > 0 && (
        <section>
          <h4>Lowongan terkait di job fair ini</h4>
          <ul className="rd-jobs">
            {jobs.map((j) => (
              <li key={j.boothId + j.title}>
                <span>
                  <b>{j.title}</b> <span className="sp-muted">· {j.company}</span>
                </span>
                <button type="button" className="mb-order" onClick={() => onGoToBooth(j.boothId)}>
                  Datangi stand
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {finished === null ? (
        <button type="button" className="mb-order jb-apply" onClick={() => setFinished(onFinish())}>
          ✓ Selesai membaca
        </button>
      ) : (
        <p className="fd-bonus">{finished ? "📚 +8 XP. Wawasanmu bertambah!" : done ? "Sudah pernah dibaca, tetap dihitung untuk misi hari ini." : "Tercatat untuk misi hari ini."}</p>
      )}
    </article>
  );
}

const KEY_DIR: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down" };

/** 2048: swipe or use the arrow keys; stop any time to take the coins for the biggest tile. */
function Game2048({ onDone }: { onDone: (best: number, score: number) => void }) {
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [score, setScore] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const best = Math.max(...board);
  const over = !canMove(board);
  const move = (dir: Dir) => {
    setBoard((b) => {
      const r = slide(b, dir);
      if (!r.moved) return b;
      setScore((s) => s + r.gained);
      return spawn(r.board);
    });
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const d = KEY_DIR[e.code];
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      move(d);
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, []);
  return (
    <div className="g48">
      <div className="gm-progress">
        Skor {score} · ubin terbesar {best} · {coinsFor(best) ? `${coinsFor(best)} 🪙` : "128 = 2 🪙"}
      </div>
      <div
        className="g48-board"
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => {
          const s0 = start.current;
          start.current = null;
          if (!s0) return;
          const dx = e.clientX - s0.x;
          const dy = e.clientY - s0.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}
      >
        {board.map((v, i) => (
          <div key={i} className="g48-cell" data-v={v || undefined}>
            {v || ""}
          </div>
        ))}
      </div>
      {over && <p className="sp-muted">Tidak ada langkah lagi.</p>}
      <div className="g48-pad">
        {(["up", "left", "down", "right"] as Dir[]).map((d) => (
          <button key={d} type="button" onClick={() => move(d)} aria-label={d} data-dir={d}>
            {{ up: "▲", left: "◀", down: "▼", right: "▶" }[d]}
          </button>
        ))}
      </div>
      <button type="button" className="mb-order jb-apply" onClick={() => onDone(best, score)}>
        {over ? "Selesai" : "Berhenti & ambil koin"}
      </button>
    </div>
  );
}
