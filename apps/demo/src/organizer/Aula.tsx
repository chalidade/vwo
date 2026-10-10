import { Trash2 } from "lucide-react";
import { useState } from "react";
import { type AulaEvent, DEFAULT_RUNDOWN } from "../jobfair-engine";
import { useStageLive } from "../fair/stage";
import { fair } from "../useFair";

const KINDS: [AulaEvent["kind"], string][] = [
  ["sambutan", "Sambutan"],
  ["talkshow", "Talkshow"],
  ["hiburan", "Hiburan"],
  ["doorprize", "Door prize"],
  ["info", "ℹ️ Info"],
];

/** The organiser writes the Aula's rundown: it shows on the Aula's LED wall and boards. */
export function OrgAula({ onToast }: { onToast: (t: string) => void }) {
  const live = useStageLive();
  const [rows, setRows] = useState<AulaEvent[]>(() => structuredClone(fair.rundown()));
  const { current } = fair.aulaNow();
  const set = (i: number, patch: Partial<AulaEvent>) => setRows((r) => r.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const custom = !!fair.org.rundown;
  return (
    <div className="org">
      <div className="card org-stagecard">
        <h2 className="cp-h2">Aula Utama · Lantai 1</h2>
        <p className="muted small">
          Panggung untuk sambutan, talkshow, hiburan, dan door prize. Jadwal di bawah tampil di layar LED panggung, papan jadwal, dan papan info Aula. Meeting point ada di pojok kiri bawah.
        </p>
        {live?.venue === "aula" ? (
          <p>
            <span className="st-live">● LIVE</span> <b>{live.title}</b> oleh {live.speaker} di panggung Aula · {live.viewers} penonton
          </p>
        ) : (
          <p className="small">{current ? <>Sedang berlangsung: <b>{current.title}</b> ({current.start}–{current.end})</> : "Tidak ada acara yang berlangsung sekarang."}</p>
        )}
        <a className="small-btn cp-link" href="#/jobfair/speaker">
          Siaran langsung dari panggung (pilih “Panggung Aula”) →
        </a>
      </div>

      <div className="card">
        <div className="org-row org-row-head">
          <h2 className="cp-h2" style={{ margin: 0 }}>
            Rundown acara {custom ? "" : <span className="muted small">(contoh bawaan)</span>}
          </h2>
          <button type="button" className="small-btn" onClick={() => setRows((r) => [...r, { id: `ev-${Date.now().toString(36)}`, start: "16.30", end: "17.00", title: "", host: "", kind: "info" }])}>
            ＋ Tambah acara
          </button>
        </div>
        <div className="au-edit">
          {rows.map((e, i) => (
            <div key={e.id} className="au-edit-row">
              <input aria-label="Mulai" value={e.start} onChange={(x) => set(i, { start: x.target.value })} placeholder="09.00" inputMode="decimal" />
              <input aria-label="Selesai" value={e.end} onChange={(x) => set(i, { end: x.target.value })} placeholder="09.30" inputMode="decimal" />
              <input aria-label="Acara" className="au-edit-title" value={e.title} onChange={(x) => set(i, { title: x.target.value })} placeholder="Nama acara" />
              <input aria-label="Pengisi acara" value={e.host} onChange={(x) => set(i, { host: x.target.value })} placeholder="Pengisi / pembicara" />
              <select aria-label="Jenis" value={e.kind} onChange={(x) => set(i, { kind: x.target.value as AulaEvent["kind"] })}>
                {KINDS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="button" className="small-btn ghost" onClick={() => setRows((r) => r.filter((_, k) => k !== i))} aria-label={`Hapus ${e.title || "acara"}`}>
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
        <div className="org-row">
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              const n = fair.saveRundown(rows);
              setRows(structuredClone(fair.rundown()));
              onToast(`Rundown disimpan · ${n} acara`);
            }}
          >
            Simpan rundown
          </button>
          <button
            type="button"
            className="small-btn ghost"
            onClick={() => {
              fair.resetRundown();
              setRows(structuredClone(DEFAULT_RUNDOWN));
              onToast("Rundown kembali ke contoh bawaan");
            }}
          >
            Pakai contoh bawaan
          </button>
        </div>
      </div>
    </div>
  );
}
