import { useState } from "react";
import type { SeminarSession } from "../fair/content";
import { useStageLive } from "../fair/stage";
import { fair } from "../useFair";

type Slide = SeminarSession["slides"][number];

/** The organiser's seminar programme, and the way into the speaker's stage. */
export function OrgSeminars({ onToast }: { onToast: (t: string) => void }) {
  const live = useStageLive();
  const [editing, setEditing] = useState<SeminarSession | null>(null);
  const sessions = fair.seminars();

  return (
    <div className="org">
      <div className="card org-stagecard">
        <h2 className="cp-h2">🎤 Panggung pembicara</h2>
        {live ? (
          <p>
            <span className="st-live">● LIVE</span> <b>{live.title}</b> oleh {live.speaker} · 👥 {live.viewers} penonton · {live.screen ? "berbagi layar" : "presentasi slide"}
          </p>
        ) : (
          <p className="muted small">Belum ada yang siaran. Saat siaran, pengunjung yang duduk di Ruang Seminar langsung melihat layar pembicara dan bisa chat serta bertanya.</p>
        )}
        <a className="small-btn cp-link" href="#/jobfair/speaker">
          Buka halaman pembicara →
        </a>
      </div>

      <div className="card">
        <div className="org-row org-row-head">
          <h2 className="cp-h2" style={{ margin: 0 }}>
            Jadwal sesi
          </h2>
          <button type="button" className="small-btn" onClick={() => setEditing({ id: `sem-${Date.now().toString(36)}`, title: "", speaker: "", role: "", slides: [{ title: "", points: [], say: "" }] })}>
            ＋ Tambah sesi
          </button>
        </div>
        <ul className="cp-jobs">
          {sessions.map((s) => (
            <li key={s.id}>
              <span className="cp-job-main">
                <b>{s.title}</b>
                <span className="muted small">
                  {s.speaker}, {s.role} · {s.slides.length} slide {fair.player.seminars.includes(s.id) && "· ✓ kamu sudah ikut"}
                </span>
              </span>
              <span className="cp-job-tools">
                <button type="button" className="small-btn ghost" onClick={() => setEditing(structuredClone(s))}>
                  Ubah
                </button>
                <button type="button" className="small-btn ghost" disabled={sessions.length <= 1} onClick={() => confirm(`Hapus sesi ${s.title}?`) && fair.removeSeminar(s.id)} aria-label={`Hapus ${s.title}`}>
                  🗑
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <SessionForm
          s={editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            fair.saveSeminar(s);
            setEditing(null);
            onToast(`Sesi ${s.title} disimpan`);
          }}
        />
      )}
    </div>
  );
}

function SessionForm({ s, onClose, onSave }: { s: SeminarSession; onClose: () => void; onSave: (s: SeminarSession) => void }) {
  const [f, setF] = useState(s);
  const [slides, setSlides] = useState(s.slides.map((x) => ({ ...x, pointsText: x.points.join("\n") })));
  const setSlide = (i: number, patch: Partial<Slide & { pointsText: string }>) => setSlides(slides.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="cp-modal" onClick={onClose}>
      <form
        className="card cp-form org-add"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const clean = slides
            .map(({ pointsText, ...x }) => ({
              ...x,
              title: x.title.trim(),
              say: x.say.trim(),
              points: pointsText
                .split("\n")
                .map((p) => p.trim())
                .filter(Boolean),
            }))
            .filter((x) => x.title && x.points.length);
          if (!clean.length) return;
          onSave({ ...f, title: f.title.trim(), speaker: f.speaker.trim(), role: f.role.trim(), slides: clean });
        }}
      >
        <h2 className="cp-h2 cp-span">{s.title ? `Ubah ${s.title}` : "Sesi baru"}</h2>
        <label className="cp-span">
          Judul
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={70} />
        </label>
        <label>
          Pembicara
          <input value={f.speaker} onChange={(e) => setF({ ...f, speaker: e.target.value })} required maxLength={30} />
        </label>
        <label>
          Jabatan
          <input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} maxLength={60} />
        </label>
        {slides.map((x, i) => (
          <fieldset key={i} className="org-slide cp-span">
            <legend>Slide {i + 1}</legend>
            <input value={x.title} onChange={(e) => setSlide(i, { title: e.target.value })} placeholder="Judul slide" maxLength={60} aria-label={`Judul slide ${i + 1}`} />
            <textarea rows={3} value={x.pointsText} onChange={(e) => setSlide(i, { pointsText: e.target.value })} placeholder="Poin, satu per baris" aria-label={`Poin slide ${i + 1}`} />
            <input value={x.say} onChange={(e) => setSlide(i, { say: e.target.value })} placeholder="Yang diucapkan pembicara (teks CC)" maxLength={200} aria-label={`Ucapan slide ${i + 1}`} />
            <button type="button" className="small-btn ghost" disabled={slides.length <= 1} onClick={() => setSlides(slides.filter((_, j) => j !== i))}>
              🗑 Hapus slide
            </button>
          </fieldset>
        ))}
        <div className="row cp-span">
          <button type="button" className="ghost" disabled={slides.length >= 12} onClick={() => setSlides([...slides, { title: "", points: [], say: "", pointsText: "" }])}>
            ＋ Slide
          </button>
          <button type="submit">Simpan sesi</button>
          <button type="button" className="ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
