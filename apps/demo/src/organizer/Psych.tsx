import { useState } from "react";
import type { PsychQuestion } from "../fair/content";
import { fair } from "../useFair";

const SECTIONS: PsychQuestion["section"][] = ["Deret angka", "Logika", "Verbal", "Spasial"];

/** The organiser runs the psikotes: the questions, the time, the pass mark, and who took it. */
export function OrgPsych({ onToast }: { onToast: (t: string) => void }) {
  const cfg = fair.psychConfig();
  const [qs, setQs] = useState<PsychQuestion[]>(() => structuredClone(cfg.questions));
  const [minutes, setMinutes] = useState(cfg.minutes);
  const [pass, setPass] = useState(Math.round(cfg.pass * 100));
  const [open, setOpen] = useState<number | null>(null);
  const edit = (i: number, patch: Partial<PsychQuestion>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  // Who took it: the player in this browser, and the scores applicants attached to their applications.
  const mine = fair.player.psych.map((r) => ({ name: "Kamu (browser ini)", score: Math.round((r.score / r.total) * 100), at: r.at }));
  const seen = new Set<string>();
  const others = fair.applications
    .filter((a) => a.psych != null && !seen.has(a.name) && seen.add(a.name))
    .map((a) => ({ name: a.name, score: a.psych!, at: a.at }));
  const rows = [...mine, ...others].sort((a, b) => b.at - a.at);
  const passed = rows.filter((r) => r.score >= cfg.pass * 100).length;
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.score, 0) / rows.length) : 0;

  return (
    <div className="org">
      <div className="cp-kpis">
        {[
          ["Peserta", rows.length],
          ["Lulus / bersertifikat", passed],
          ["Rata-rata nilai", rows.length ? avg : "–"],
          ["Jumlah soal", cfg.questions.length],
        ].map(([label, n]) => (
          <div key={label} className="card cp-kpi">
            <span className="muted small">{label}</span>
            <span className="stat">{n}</span>
          </div>
        ))}
      </div>

      <form
        className="card cp-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (fair.savePsych({ questions: qs, minutes, pass: pass / 100 })) onToast("Psikotes disimpan, berlaku untuk peserta berikutnya");
          else onToast("Isi minimal satu soal lengkap dengan dua pilihan dan kunci jawaban");
        }}
      >
        <h2 className="cp-h2 cp-span">Pengaturan tes</h2>
        <label>
          Waktu (menit)
          <input type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <label>
          Nilai lulus sertifikat (%)
          <input type="number" min={10} max={100} value={pass} onChange={(e) => setPass(Number(e.target.value))} />
        </label>
        <h2 className="cp-h2 cp-span" style={{ marginTop: 6 }}>
          Bank soal ({qs.length})
        </h2>
        <ol className="org-qs cp-span">
          {qs.map((q, i) => (
            <li key={q.id} data-open={open === i ? "" : undefined}>
              <button type="button" className="org-q-head" onClick={() => setOpen(open === i ? null : i)}>
                <span className="org-q-no">{i + 1}</span>
                <span className="org-q-text">
                  {q.q || <i className="muted">Soal kosong</i>}
                  <span className="muted small"> · {q.section}</span>
                </span>
                <span>{open === i ? "▴" : "▾"}</span>
              </button>
              {open === i && (
                <div className="org-q-body">
                  <label>
                    Bagian
                    <select value={q.section} onChange={(e) => edit(i, { section: e.target.value as PsychQuestion["section"] })}>
                      {SECTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pertanyaan
                    <textarea rows={2} value={q.q} onChange={(e) => edit(i, { q: e.target.value })} maxLength={240} />
                  </label>
                  <span className="muted small">Pilihan jawaban (tandai yang benar)</span>
                  {q.options.map((o, k) => (
                    <div key={k} className="org-opt">
                      <input type="radio" name={`ans-${q.id}`} checked={q.answer === k} onChange={() => edit(i, { answer: k })} aria-label={`Jawaban benar ${k + 1}`} />
                      <input value={o} onChange={(e) => edit(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} maxLength={100} aria-label={`Pilihan ${k + 1}`} />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="small-btn ghost"
                    onClick={() => {
                      setQs(qs.filter((_, j) => j !== i));
                      setOpen(null);
                    }}
                  >
                    Hapus soal
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="row cp-span">
          <button
            type="button"
            className="ghost"
            disabled={qs.length >= 40}
            onClick={() => {
              setQs([...qs, { id: `q${Date.now().toString(36)}`, section: "Logika", q: "", options: ["", "", "", ""], answer: 0 }]);
              setOpen(qs.length);
            }}
          >
            ＋ Tambah soal
          </button>
          <button type="submit">Simpan psikotes</button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              if (!confirm("Kembalikan soal dan pengaturan bawaan?")) return;
              fair.resetPsych();
              const d = fair.psychConfig();
              setQs(structuredClone(d.questions));
              setMinutes(d.minutes);
              setPass(Math.round(d.pass * 100));
              onToast("Soal bawaan dipakai lagi");
            }}
          >
            Pakai soal bawaan
          </button>
        </div>
      </form>

      <div className="card">
        <h2 className="cp-h2">Peserta & sertifikat</h2>
        {rows.length === 0 ? (
          <p className="muted small">Belum ada peserta.</p>
        ) : (
          <div className="org-scroll">
            <table className="list cp-table">
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Nilai</th>
                  <th>Sertifikat</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.name}
                      <br />
                      <span className="muted small">{new Date(r.at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td>{r.score}</td>
                    <td>{r.score >= cfg.pass * 100 ? "Lulus" : <span className="muted">Belum lulus</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
