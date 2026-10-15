import { ArrowDown, ArrowUp, CalendarDays, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PARK_MAX_BUILDINGS, PARK_MAX_RANGE_DAYS, type ParkBuilding, cleanDay, formatDateRange, parkBuildingDate, readTypedDate } from "@vwo/shared";
import { FloorScene } from "../fair/FloorScene";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";

/** The organiser's park outside the building: the other events shown as buildings under construction,
 *  with their name, date and a short description. Hidden ones stay in this list only. */
export function OrgPark({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const list = fair.parkBuildings();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const edited = editing && editing !== "new" ? list.find((b) => b.id === editing) : undefined;
  const full = list.length >= PARK_MAX_BUILDINGS;

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Taman di luar gedung</h2>
        <p className="muted small">
          Pengunjung keluar ke taman lewat pintu taman di {fair.stopOf(fair.lobbyId).name}. Gedung di tengah adalah acara ini ({fair.fair.name}): pintunya membawa kembali ke lobi.
          Di sampingnya ada {PARK_MAX_BUILDINGS} lahan untuk acara berikutnya, tampil sebagai gedung yang sedang dibangun dengan banner "Coming soon". Pengunjung yang mendekat
          melihat nama, tanggal, dan keterangannya, tapi belum bisa masuk.
        </p>
        <FloorScene className="admin-scene org-park-scene" floorId={fair.parkId} />
      </div>

      <div className="card">
        <div className="org-row org-row-head">
          <h2 className="cp-h2" style={{ margin: 0 }}>
            Gedung acara lain
          </h2>
          <button type="button" className="small-btn" disabled={full} title={full ? `Maksimal ${PARK_MAX_BUILDINGS} gedung` : undefined} onClick={() => setEditing("new")}>
            <Plus size={14} aria-hidden /> Tambah gedung
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Urutan daftar menentukan lahan: yang teratas berdiri paling dekat dengan gedung acara ini. Gedung yang disembunyikan tidak tampil dan tidak dikirim ke pengunjung.
        </p>
        {list.length === 0 && <p className="muted small">Belum ada gedung. Lahan kosong tampil sebagai taman.</p>}
        <div className="fl-list">
          {list.map((b, i) => {
            const hidden = b.status === "hidden";
            return (
              <div key={b.id} className="fl-row park-row" data-closed={hidden ? "" : undefined}>
                <b className="fl-n">{i + 1}</b>
                <div className="fl-main">
                  <span className="fl-label">{b.name}</span>
                  <span className="muted small">
                    <span className="fl-soon">{hidden ? "Disembunyikan" : "Coming soon"}</span>
                    {parkBuildingDate(b) || "Tanggal belum diisi"}
                  </span>
                  {b.about && <span className="muted small park-row-about">{b.about}</span>}
                </div>
                <div className="fl-act">
                  <button type="button" className="small-btn ghost" aria-label={`Naikkan ${b.name}`} disabled={i === 0} onClick={() => fair.moveParkBuilding(b.id, -1)}>
                    <ArrowUp size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="small-btn ghost"
                    aria-label={`Turunkan ${b.name}`}
                    disabled={i === list.length - 1}
                    onClick={() => fair.moveParkBuilding(b.id, 1)}
                  >
                    <ArrowDown size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="small-btn ghost fl-close"
                    aria-pressed={hidden}
                    onClick={() => {
                      fair.saveParkBuilding({ ...b, status: hidden ? "soon" : "hidden" });
                      onToast(hidden ? `${b.name} tampil lagi di taman` : `${b.name} disembunyikan`);
                    }}
                  >
                    {hidden ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
                    {hidden ? "Tampilkan" : "Sembunyikan"}
                  </button>
                  <button type="button" className="small-btn ghost fl-close" onClick={() => setEditing(b.id)}>
                    <Pencil size={14} aria-hidden /> Ubah
                  </button>
                  <button
                    type="button"
                    className="small-btn ghost"
                    aria-label={`Hapus ${b.name}`}
                    onClick={() => {
                      if (!confirm(`Hapus gedung ${b.name} dari taman?`)) return;
                      fair.removeParkBuilding(b.id);
                      if (editing === b.id) setEditing(null);
                      onToast(`${b.name} dihapus dari taman`);
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(editing === "new" || edited) && (
        <BuildingForm
          key={edited?.id ?? "new"}
          building={edited}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            if (!fair.saveParkBuilding({ ...input, id: edited?.id })) return onToast(`Maksimal ${PARK_MAX_BUILDINGS} gedung di taman`);
            setEditing(null);
            onToast(edited ? `${input.name.trim()} disimpan` : `${input.name.trim()} ditambahkan ke taman`);
          }}
        />
      )}
    </div>
  );
}

/** What is wrong with a picked range, or null. Both empty is fine (no date yet). */
export function dateRangeError(start: string, end: string) {
  if (!start && !end) return null;
  if (!start) return "Isi tanggal mulai dulu";
  if (!cleanDay(start) || (end && !cleanDay(end))) return "Tanggal tidak valid";
  if (end && end < start) return "Tanggal selesai tidak boleh sebelum tanggal mulai";
  if (end && (Date.parse(end) - Date.parse(start)) / 86_400_000 > PARK_MAX_RANGE_DAYS) return "Rentang tanggal paling lama satu tahun";
  return null;
}

function BuildingForm({ building, onSave, onClose }: { building?: ParkBuilding; onSave: (b: Omit<ParkBuilding, "id">) => void; onClose: () => void }) {
  const [name, setName] = useState(building?.name ?? "");
  // An old typed date fills the calendar when it names days; otherwise it is shown until a range is picked.
  const typed = building?.startDate ? null : readTypedDate(building?.date);
  const [start, setStart] = useState(building?.startDate ?? typed?.startDate ?? "");
  const [end, setEnd] = useState(building?.endDate ?? typed?.endDate ?? "");
  const legacy = !building?.startDate && !typed ? building?.date : undefined;
  const error = dateRangeError(start, end);
  const [about, setAbout] = useState(building?.about ?? "");
  const [status, setStatus] = useState<ParkBuilding["status"]>(building?.status ?? "soon");
  const [regSlug, setRegSlug] = useState(building?.regSlug ?? "");
  const events = usePreregEvents();
  return (
    <form
      className="card cp-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || error) return;
        // A picked range replaces the old typed date; without one the old text stays.
        const link = regSlug ? { regSlug } : {};
        onSave(start ? { name, startDate: start, endDate: end && end !== start ? end : undefined, about, status, ...link } : { name, date: legacy, about, status, ...link });
      }}
    >
      <h2 className="cp-h2 cp-span" style={{ margin: 0 }}>
        {building ? `Ubah ${building.name}` : "Gedung baru"}
      </h2>
      <label>
        Nama acara
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Job Fair Kampus 2027" autoFocus={!building} />
      </label>
      <fieldset className="org-range">
        <legend>
          <CalendarDays size={14} aria-hidden /> Tanggal acara (opsional)
        </legend>
        <label>
          Mulai
          <input
            type="date"
            value={start}
            min="2000-01-01"
            max="2100-12-31"
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              // Moving the start past the end takes the end along.
              if (end && v && end < v) setEnd(v);
            }}
          />
        </label>
        <label>
          Selesai
          <input type="date" value={end} min={start || "2000-01-01"} max="2100-12-31" disabled={!start} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <small className="muted org-range-note" role={error ? "alert" : undefined} data-error={error ? "" : undefined}>
          {error ??
            (start
              ? `Tampil di banner: ${formatDateRange(start, end && end !== start ? end : undefined)}`
              : legacy
                ? `Tanggal lama: "${legacy}". Pilih tanggal untuk menggantinya.`
                : "Kosongkan selesai untuk acara satu hari.")}
        </small>
        {(start || end) && (
          <button
            type="button"
            className="small-btn ghost org-range-clear"
            onClick={() => {
              setStart("");
              setEnd("");
            }}
          >
            Hapus tanggal
          </button>
        )}
      </fieldset>
      <label className="cp-span">
        Keterangan singkat (opsional)
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={200} rows={2} placeholder="Satu atau dua kalimat tentang acaranya." />
        <small className="muted">{about.length}/200</small>
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as ParkBuilding["status"])}>
          <option value="soon">Coming soon · tampil di taman</option>
          <option value="hidden">Disembunyikan</option>
        </select>
      </label>
      {LIVE && (
        <label>
          Tombol &quot;Daftar event&quot;
          <select value={regSlug} onChange={(e) => setRegSlug(e.target.value)}>
            <option value="">Tidak ada</option>
            {regSlug && !events.some((x) => x.slug === regSlug) && <option value={regSlug}>/daftar/{regSlug}</option>}
            {events.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name} · /daftar/{x.slug}
              </option>
            ))}
          </select>
          <small className="muted">Pengunjung yang mendekat bisa membuka pendaftaran pelamar event ini (dari tab Pra-registrasi).</small>
        </label>
      )}
      <div className="cp-span row">
        <button type="button" className="ghost" onClick={onClose}>
          Batal
        </button>
        <button type="submit" className="small-btn" disabled={!!error}>
          Simpan
        </button>
      </div>
    </form>
  );
}

/** The pre-registration events (tab Pra-registrasi), to link a park building to one. Live site only. */
function usePreregEvents() {
  const [events, setEvents] = useState<{ slug: string; name: string }[]>([]);
  useEffect(() => {
    if (!LIVE) return;
    let gone = false;
    fetch("/api/jobfair/prereg-events", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ events: { slug: string; name: string }[] }>) : null))
      .then((d) => !gone && d && setEvents(d.events.map((e) => ({ slug: e.slug, name: e.name }))))
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);
  return events;
}
