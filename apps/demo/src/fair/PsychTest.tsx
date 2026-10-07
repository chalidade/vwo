import { useEffect, useState } from "react";
import type { PsychResult } from "../jobfair-engine";
import type { PsychConfig } from "../jobfair-engine";
import { psychGrade } from "./content";
import { Certificate, certNo } from "./Seminar";
import { Modal } from "./Modal";

/** The psikotes at a desk: an intro, timed multiple-choice questions, then the result. */
export function PsychTest({ name, past, config, onDone, onClose }: { name: string; past: PsychResult[]; config: PsychConfig; onDone: (r: Omit<PsychResult, "at">) => void; onClose: () => void }) {
  // The organiser's questions, fixed for the length of one sitting.
  const [{ questions: PSYCH_TEST, minutes: PSYCH_MINUTES, pass: PSYCH_PASS }] = useState(config);
  const [phase, setPhase] = useState<"intro" | "test" | "done">("intro");
  const [answers, setAnswers] = useState<(number | null)[]>(() => PSYCH_TEST.map(() => null));
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(PSYCH_MINUTES * 60);
  const [result, setResult] = useState<Omit<PsychResult, "at"> | null>(null);

  const finish = () => {
    const sections: PsychResult["sections"] = {};
    let score = 0;
    PSYCH_TEST.forEach((q, k) => {
      const s = (sections[q.section] ??= { right: 0, total: 0 });
      s.total++;
      if (answers[k] === q.answer) {
        s.right++;
        score++;
      }
    });
    const r = { score, total: PSYCH_TEST.length, grade: psychGrade(score, PSYCH_TEST.length), sections };
    setResult(r);
    setPhase("done");
    onDone(r);
  };

  // The scene re-renders every frame, so count down with an interval rather than per render.
  useEffect(() => {
    if (phase !== "test") return;
    const id = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (phase === "test" && left <= 0) finish();
  });

  const q = PSYCH_TEST[i]!;
  const answered = answers.filter((a) => a !== null).length;
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <Modal
      title={phase === "test" ? `🧠 Psikotes · ${q.section}` : "🧠 Psikotes"}
      onClose={() => {
        if (phase !== "test" || confirm("Keluar dari tes? Jawabanmu tidak disimpan.")) onClose();
      }}
      className="fx-psych"
      foot={
        phase === "test" ? (
          <>
            <button type="button" disabled={i === 0} onClick={() => setI(i - 1)}>
              ◀
            </button>
            <span>
              {i + 1} / {PSYCH_TEST.length} · ⏱ {mm}
            </span>
            {i < PSYCH_TEST.length - 1 ? (
              <button type="button" onClick={() => setI(i + 1)}>
                ▶
              </button>
            ) : (
              <button type="button" className="jb-submit" onClick={() => (answered < PSYCH_TEST.length && !confirm(`Masih ada ${PSYCH_TEST.length - answered} soal kosong. Selesaikan?`) ? null : finish())}>
                Selesai
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {phase === "intro" && (
        <div className="fx-intro">
          <p>
            Tes latihan berisi <b>{PSYCH_TEST.length} soal</b> dengan waktu <b>{PSYCH_MINUTES} menit</b>.
          </p>
          <p>
            Lulus dengan nilai minimal <b>{Math.round(PSYCH_PASS * 100)}%</b> dapat <b>sertifikat psikotes</b>.
          </p>
          <p>Nilai terbaikmu ikut terkirim bersama lamaran, jadi recruiter bisa melihatnya. Nilai bagus juga menambah XP.</p>
          {past.length > 0 && (
            <p className="sp-muted">
              Hasil sebelumnya: {past.slice(0, 3).map((r) => `${r.score}/${r.total} (${r.grade})`).join(", ")}
            </p>
          )}
          <button type="button" className="mb-order jb-apply" onClick={() => setPhase("test")}>
            Mulai tes ▶
          </button>
        </div>
      )}
      {phase === "test" && (
        <div className="fx-question">
          <div className="fx-q">{q.q}</div>
          <div className="fx-options">
            {q.options.map((o, k) => (
              <button
                key={k}
                type="button"
                data-active={answers[i] === k ? "" : undefined}
                onClick={() => {
                  setAnswers(answers.map((a, n) => (n === i ? k : a)));
                  if (i < PSYCH_TEST.length - 1) setTimeout(() => setI(i + 1), 180);
                }}
              >
                <span className="fx-opt">{String.fromCharCode(65 + k)}</span> {o}
              </button>
            ))}
          </div>
          <div className="fx-dots">
            {answers.map((a, k) => (
              <button key={k} type="button" data-done={a !== null ? "" : undefined} data-active={k === i ? "" : undefined} onClick={() => setI(k)} aria-label={`Soal ${k + 1}`} />
            ))}
          </div>
        </div>
      )}
      {phase === "done" && result && result.score / result.total >= PSYCH_PASS && (
        <Certificate
          kind="PSIKOTES"
          name={name}
          line={
            <>
              telah <b>LULUS</b> psikotes latihan dengan nilai <b>{Math.round((result.score / result.total) * 100)}</b> ({result.grade})
            </>
          }
          by="Bu Psikolog Rina · Pengawas psikotes"
          code={`PSI-${certNo(name + result.score + Date.now())}`}
        />
      )}
      {phase === "done" && result && (
        <div className="fx-result">
          {result.score / result.total < PSYCH_PASS && (
            <p className="fx-fail">
              Belum lulus. Butuh nilai {Math.round(PSYCH_PASS * 100)}% untuk dapat sertifikat, coba lagi ya 💪
            </p>
          )}
          <div className="fx-score">
            {result.score}
            <span>/{result.total}</span>
          </div>
          <div className="fx-grade">{result.grade}</div>
          <ul className="fx-sections">
            {Object.entries(result.sections).map(([name, s]) => (
              <li key={name}>
                <span>{name}</span>
                <span className="fx-bar">
                  <span style={{ width: `${(s.right / s.total) * 100}%` }} />
                </span>
                <b>
                  {s.right}/{s.total}
                </b>
              </li>
            ))}
          </ul>
          <p className="sp-muted">Hasil tersimpan di profilmu dan dikirim bersama lamaran berikutnya.</p>
          <div className="fx-cert-actions">
            <button
              type="button"
              className="mb-order"
              onClick={() => {
                setAnswers(PSYCH_TEST.map(() => null));
                setI(0);
                setLeft(PSYCH_MINUTES * 60);
                setResult(null);
                setPhase("test");
              }}
            >
              Ulangi tes
            </button>
            <button type="button" className="mb-order jb-apply" onClick={onClose}>
              Selesai
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
