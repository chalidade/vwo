import { Download, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SEMINAR_CAPACITY_MAX, SEMINAR_MINUTES, cleanSchedule, seminarPhase, seminarWhen, sortByStart, wibClock, wibDay, wibTime } from "@vwo/shared";
import type { SeminarSession } from "../fair/content";
import { pullSeminarRegs, seminarRegistrants } from "../fair/seminar-reg";
import { useStageLive } from "../fair/stage";
import { fair } from "../useFair";
import { StreamField, streamLinkError } from "./StreamField";

type Slide = SeminarSession["slides"][number];

/** The organiser's seminar programme, and the way into the speaker's stage. */
export function OrgSeminars({ onToast }: { onToast: (t: string) => void }) {
  const live = useStageLive();
  const [editing, setEditing] = useState<SeminarSession | null>(null);
  const sessions = fair.seminars();
  // Dated sessions by start time, the undated ones after them.
  const list = sortByStart(sessions.map((s) => ({ s, ...cleanSchedule(s) })));
  const [exporting, setExporting] = useState<string | null>(null);
  useEffect(() => void pullSeminarRegs(true), []);

  const exportList = (s: SeminarSession) => {
    setExporting(s.id);
    void seminarRegistrants(s.id).then(async (rows) => {
      setExporting(null);
      if (!rows) return onToast("Daftar pendaftar gagal dimuat. Coba lagi.");
      if (!rows.length) return onToast(`Belum ada pendaftar ${s.title}`);
      (await import("../fair/exports")).saveSeminarRegistrants(s.id, rows);
      onToast(`${rows.length} pendaftar ${s.title} diunduh`);
    });
  };

  return (
    <div className="org">
      <div className="card org-stagecard">
        <h2 className="cp-h2">Panggung pembicara</h2>
        {live ? (
          <p>
            <span className="st-live">● LIVE</span> <b>{live.title}</b> oleh {live.speaker} · {live.viewers} penonton · {live.screen ? "berbagi layar" : "presentasi slide"}
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
          <button
            type="button"
            className="small-btn"
            onClick={() => setEditing({ id: `sem-${Date.now().toString(36)}`, title: "", speaker: "", role: "", slides: [{ title: "", points: [], say: "" }] })}
          >
            ＋ Tambah sesi
          </button>
        </div>
        <ul className="cp-jobs">
          {list.map(({ s, startAt, minutes, capacity }) => {
            const count = fair.seminarRegCount(s.id);
            const phase = seminarPhase({ startAt, minutes }, Date.now());
            return (
              <li key={s.id}>
                <span className="cp-job-main">
                  <b>{s.title}</b>
                  <span className="org-sem-when" data-none={startAt === undefined ? "" : undefined}>
                    {phase === "live" ? "Sedang berlangsung · " : phase === "ended" ? "Selesai · " : ""}
                    {seminarWhen({ startAt, minutes })}
                  </span>
                  <span className="muted small">
                    {s.speaker}, {s.role} · {s.slides.length} slide · {capacity ? `${count}/${capacity} kursi terdaftar` : `${count} terdaftar`} ·{" "}
                    {fair.seminarCounts.get(s.id) ?? 0} menonton
                    {s.streamSource === "link" ? (s.streamUrl ? " · siaran lewat YouTube" : " · siaran lewat YouTube, link belum diisi") : ""}
                  </span>
                </span>
                <span className="cp-job-tools">
                  <button
                    type="button"
                    className="small-btn ghost"
                    disabled={!count || exporting === s.id}
                    onClick={() => exportList(s)}
                    title="Unduh daftar pendaftar (Excel)"
                    aria-label={`Unduh pendaftar ${s.title}`}
                  >
                    <Download size={16} aria-hidden />
                  </button>
                  <button type="button" className="small-btn ghost" onClick={() => setEditing(structuredClone(s))}>
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="small-btn ghost"
                    disabled={sessions.length <= 1}
                    onClick={() => confirm(`Hapus sesi ${s.title}?`) && fair.removeSeminar(s.id)}
                    aria-label={`Hapus ${s.title}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </span>
              </li>
            );
          })}
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
  // Date and time as typed, in WIB whatever the organiser's device is set to.
  const [day, setDay] = useState(s.startAt ? wibDay(s.startAt) : "");
  const [clock, setClock] = useState(s.startAt ? wibClock(s.startAt).replace(".", ":") : "");
  const [minutes, setMinutes] = useState(String(s.minutes ?? SEMINAR_MINUTES.default));
  const [capacity, setCapacity] = useState(s.capacity ? String(s.capacity) : "");
  const [streamSource, setStreamSource] = useState<"platform" | "link">(s.streamSource === "link" ? "link" : "platform");
  const [streamUrl, setStreamUrl] = useState(s.streamUrl ?? "");
  const [error, setError] = useState<string | null>(null);
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
          if (!clean.length) return setError("Isi minimal satu slide dengan judul dan poin.");
          if (!day !== !clock) return setError("Isi tanggal dan jam mulai, atau kosongkan keduanya kalau jadwal belum pasti.");
          const startAt = day && clock ? wibTime(day, clock) : null;
          if (day && startAt === null) return setError("Tanggal atau jam tidak valid.");
          const linkError = streamSource === "link" ? streamLinkError(streamUrl) : null;
          if (linkError) return setError(linkError);
          const when = cleanSchedule({ startAt: startAt ?? undefined, minutes: Number(minutes), capacity: capacity ? Number(capacity) : undefined });
          const { startAt: _a, minutes: _m, capacity: _c, streamUrl: _s, streamSource: _ss, ...rest } = f;
          onSave({
            ...rest,
            title: f.title.trim(),
            speaker: f.speaker.trim(),
            role: f.role.trim(),
            slides: clean,
            ...(when.startAt !== undefined && { startAt: when.startAt }),
            minutes: when.minutes,
            ...(when.capacity && { capacity: when.capacity }),
            ...(streamSource === "link" && { streamSource }),
            // The link is kept while "Platform kita" is chosen, so switching back does not lose it.
            ...(streamUrl.trim() && !streamLinkError(streamUrl) && { streamUrl: streamUrl.trim() }),
          });
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
        <fieldset className="org-sem-time cp-span">
          <legend>Jadwal (WIB)</legend>
          <label>
            Tanggal
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label>
            Jam mulai
            <input type="time" value={clock} onChange={(e) => setClock(e.target.value)} />
          </label>
          <label>
            Durasi (menit)
            <input
              type="number"
              inputMode="numeric"
              min={SEMINAR_MINUTES.min}
              max={SEMINAR_MINUTES.max}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              required
            />
          </label>
          <label>
            Kuota kursi
            <input type="number" inputMode="numeric" min={1} max={SEMINAR_CAPACITY_MAX} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Tanpa batas" />
          </label>
          <p className="muted small">
            Kosongkan tanggal dan jam kalau belum pasti: sesi tampil sebagai "Jadwal belum ditentukan" dan belum bisa didaftar. Pendaftar diingatkan H-1 dan 15 menit sebelum mulai.
          </p>
        </fieldset>
        <StreamField source={streamSource} url={streamUrl} onSource={setStreamSource} onUrl={setStreamUrl} />
        {slides.map((x, i) => (
          <fieldset key={i} className="org-slide cp-span">
            <legend>Slide {i + 1}</legend>
            <input value={x.title} onChange={(e) => setSlide(i, { title: e.target.value })} placeholder="Judul slide" maxLength={60} aria-label={`Judul slide ${i + 1}`} />
            <textarea
              rows={3}
              value={x.pointsText}
              onChange={(e) => setSlide(i, { pointsText: e.target.value })}
              placeholder="Poin, satu per baris"
              aria-label={`Poin slide ${i + 1}`}
            />
            <input
              value={x.say}
              onChange={(e) => setSlide(i, { say: e.target.value })}
              placeholder="Yang diucapkan pembicara (teks CC)"
              maxLength={200}
              aria-label={`Ucapan slide ${i + 1}`}
            />
            <button type="button" className="small-btn ghost" disabled={slides.length <= 1} onClick={() => setSlides(slides.filter((_, j) => j !== i))}>
              Hapus slide
            </button>
          </fieldset>
        ))}
        {error && (
          <p className="cp-span org-sem-error" role="alert">
            {error}
          </p>
        )}
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
