import { useState } from "react";
import { SEMINARS, type SeminarSession } from "./content";
import { Modal } from "./Modal";

/** Watching a seminar from a seat: pick a session, follow the slides, get a certificate. */
export function SeminarView({ attended, name, onFinish, onClose }: { attended: string[]; name: string; onFinish: (id: string) => void; onClose: () => void }) {
  const [session, setSession] = useState<SeminarSession | null>(null);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);

  if (!session)
    return (
      <Modal title="🎤 Jadwal seminar" onClose={onClose} className="fx-seminar">
        <p className="sp-summary">Pilih sesi yang mau kamu ikuti. Tiap sesi selesai dapat e-sertifikat dan XP.</p>
        <ul className="fx-sessions">
          {SEMINARS.map((s) => (
            <li key={s.id}>
              <span>
                <b>{s.title}</b>
                <span className="sp-muted">
                  {" "}
                  · {s.speaker}, {s.role} · {s.slides.length} materi
                </span>
              </span>
              <button
                type="button"
                className="mb-order"
                onClick={() => {
                  setSession(s);
                  setPage(0);
                  setDone(false);
                }}
              >
                {attended.includes(s.id) ? "✓ Ulangi" : "Ikuti"}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    );

  const slide = session.slides[page]!;
  const last = page === session.slides.length - 1;
  return (
    <Modal
      title={`🎤 ${session.title}`}
      onClose={onClose}
      className="fx-seminar"
      foot={
        done ? undefined : (
          <>
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ◀
            </button>
            <span>
              {page + 1} / {session.slides.length}
            </span>
            {last ? (
              <button
                type="button"
                className="jb-submit"
                onClick={() => {
                  onFinish(session.id);
                  setDone(true);
                }}
              >
                Selesai
              </button>
            ) : (
              <button type="button" onClick={() => setPage(page + 1)}>
                ▶
              </button>
            )}
          </>
        )
      }
    >
      {done ? (
        <div className="fx-cert">
          <div className="fx-cert-head">E-SERTIFIKAT</div>
          <p>Diberikan kepada</p>
          <b className="fx-cert-name">{name}</b>
          <p>
            telah mengikuti seminar <b>{session.title}</b>
          </p>
          <p className="sp-muted">
            {session.speaker} · {session.role}
          </p>
          <button type="button" className="mb-order jb-apply" onClick={() => setSession(null)}>
            Lihat sesi lain
          </button>
        </div>
      ) : (
        <div className="fx-slide">
          <div className="fx-slide-title">{slide.title}</div>
          <ul>
            {slide.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="fx-speaker">
            <b>{session.speaker}:</b> "{slide.say}"
          </div>
        </div>
      )}
    </Modal>
  );
}
