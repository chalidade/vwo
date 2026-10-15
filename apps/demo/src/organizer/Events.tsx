import { CalendarDays, Copy, Download, ExternalLink, ImagePlus, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type PreregData, type PreregState, SUSPECT_LABELS, type SuspectReason, formatDateRange, preregSlug } from "@vwo/shared";
import { LIVE } from "../mode";
import { readImageFile } from "../imageFile";
import { dateRangeError } from "./Park";

/** A pre-registration event as the hub edits it (apps/web prereg-events view.ts). */
interface PreregEvent {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  about: string;
  banner: string | null;
  capacity: number | null;
  open: boolean;
  deadline: number | null;
  count: number;
  state: PreregState;
  createdAt: number;
  /** Slow mode (too many sign-ups at once) until then. */
  slowUntil: number | null;
}

interface Registrant {
  id: string;
  code: string;
  email: string;
  data: PreregData;
  at: number;
  updatedAt: number;
  linkedAt: number | null;
  /** How suspicious it looks among this event's sign-ups (server side). */
  suspect: { score: number; reasons: SuspectReason[]; flagged: boolean } | null;
}

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(
      path,
      init
        ? {
            method: init.method,
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
          }
        : { credentials: "same-origin" },
    );
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: d.error ?? `http_${r.status}` };
  } catch {
    return { ok: false, error: "offline" };
  }
}

const ERR: Record<string, string> = {
  not_allowed: "Hanya panitia yang bisa mengatur event.",
  invalid_input: "Periksa lagi isian: nama minimal 3 huruf, lokasi wajib, banner PNG/JPG.",
  slug_taken: "Link itu sudah dipakai event lain. Pilih link lain.",
  has_registrants: "Event yang sudah punya pendaftar tidak bisa dihapus. Tutup pendaftarannya saja.",
  email_taken: "Email itu sudah terdaftar di event ini.",
  too_large: "Banner terlalu besar. Pilih gambar yang lebih kecil.",
};
const err = (e: string, fallback: string) => ERR[e] ?? fallback;

const STATE: Record<PreregState, string> = { open: "Dibuka", closed: "Ditutup", deadline: "Lewat batas waktu", full: "Kuota penuh" };
const when = (t: number) => new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const publicLink = (slug: string) => `${location.origin}/daftar/${slug}`;
const shownLink = (slug: string) => `${location.host}/daftar/${slug}`;

/**
 * Job seekers sign up for an event before launch (jobfair.co.id/daftar/<slug>) and keep a code; when
 * the site opens they sign in with the same Google email and their data is already in. Here the
 * organiser makes events, opens and closes the form, and sees and exports who signed up.
 */
export function OrgEvents({ onToast }: { onToast: (t: string) => void }) {
  const [list, setList] = useState<PreregEvent[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PreregEvent | "new" | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [guard, setGuard] = useState<{ turnstile: boolean; warn: boolean } | null>(null);
  const load = () =>
    void call<{ events: PreregEvent[]; antibot?: { turnstile: boolean; warn: boolean } }>("/api/jobfair/prereg-events").then((r) =>
      r.ok ? (setList(r.data.events), setGuard(r.data.antibot ?? null), setError("")) : setError(err(r.error, "Daftar event gagal dimuat.")),
    );
  useEffect(load, []);

  if (!LIVE)
    return (
      <div className="org">
        <p className="card cp-server-note">Pra-registrasi event hanya ada di versi live (jobfair.co.id).</p>
      </div>
    );

  const save = async (input: Record<string, unknown>, id?: string) => {
    const r = await call<{ event: PreregEvent }>(id ? `/api/jobfair/prereg-events/${id}` : "/api/jobfair/prereg-events", { method: id ? "PATCH" : "POST", body: input });
    if (!r.ok) return err(r.error, "Gagal menyimpan. Coba lagi.");
    onToast(id ? `${r.data.event.name} disimpan` : `Event ${r.data.event.name} dibuat`);
    setEditing(null);
    load();
    return null;
  };
  const toggle = async (e: PreregEvent) => {
    const r = await call(`/api/jobfair/prereg-events/${e.id}`, { method: "PATCH", body: { ...eventBody(e), open: !e.open } });
    if (!r.ok) return setError(err(r.error, "Gagal mengubah status."));
    onToast(e.open ? `Pendaftaran ${e.name} ditutup` : `Pendaftaran ${e.name} dibuka`);
    load();
  };
  const remove = async (e: PreregEvent) => {
    if (!confirm(`Hapus event ${e.name}?`)) return;
    const r = await call(`/api/jobfair/prereg-events/${e.id}`, { method: "DELETE" });
    if (!r.ok) return setError(err(r.error, "Gagal menghapus."));
    onToast(`${e.name} dihapus`);
    load();
  };
  const copy = (slug: string) =>
    void navigator.clipboard?.writeText(publicLink(slug)).then(
      () => onToast("Link pendaftaran disalin"),
      () => onToast(publicLink(slug)),
    );
  const viewed = list?.find((e) => e.id === viewing);

  return (
    <div className="org">
      <div className="card">
        <div className="org-row org-row-head">
          <h2 className="cp-h2" style={{ margin: 0 }}>
            Pra-registrasi event
          </h2>
          <span className="org-row">
            <button type="button" className="small-btn ghost" onClick={load} aria-label="Muat ulang">
              <RefreshCw size={14} aria-hidden /> Muat ulang
            </button>
            <button type="button" className="small-btn" onClick={() => setEditing("new")}>
              <Plus size={14} aria-hidden /> Event baru
            </button>
          </span>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Pelamar mengisi data lewat link pendaftaran sebelum acara dibuka dan mendapat kode. Saat situs dibuka, mereka masuk dengan akun Google yang sama dan profilnya sudah
          terisi, jadi tidak perlu daftar ulang. Event yang dibuka juga tampil di halaman depan jobfair.co.id.
        </p>
        {guard?.warn && (
          <p className="pe-alert" role="alert">
            <ShieldAlert size={16} aria-hidden /> Perlindungan anti-bot (Turnstile) belum aktif — isi TURNSTILE_SITE_KEY dan TURNSTILE_SECRET_KEY di Vercel
          </p>
        )}
        {list?.some((e) => e.slowUntil) && (
          <p className="pe-notice">
            <ShieldAlert size={16} aria-hidden /> Ada lonjakan pendaftaran yang tidak wajar. Event bertanda &quot;Mode lambat&quot; sementara meminta verifikasi lebih berat dari
            pendaftar; periksa pendaftar yang ditandai Mencurigakan.
          </p>
        )}
        {error && <p className="bk-err">{error}</p>}
        {!list && !error && <p className="muted small">Memuat…</p>}
        {list && list.length === 0 && <p className="muted small">Belum ada event. Buat event pertama untuk mendapatkan link pendaftaran.</p>}
        {list && list.length > 0 && (
          <ul className="pe-list">
            {list.map((e) => (
              <li key={e.id} data-active={viewing === e.id ? "" : undefined}>
                {e.banner ? <img className="pe-thumb" src={e.banner} alt="" /> : <span className="pe-thumb pe-thumb-empty" aria-hidden />}
                <div className="pe-main">
                  <b>{e.name}</b>
                  <span className="muted small">
                    {[e.startDate ? formatDateRange(e.startDate, e.endDate || undefined) : "", e.location].filter(Boolean).join(" · ")}
                    {e.deadline && ` · tutup ${when(e.deadline)}`}
                  </span>
                  <span className="pe-link">
                    <a href={publicLink(e.slug)} target="_blank" rel="noreferrer">
                      {shownLink(e.slug)} <ExternalLink size={12} aria-hidden />
                    </a>
                    <button type="button" className="small-btn ghost" onClick={() => copy(e.slug)} aria-label={`Salin link ${e.name}`}>
                      <Copy size={13} aria-hidden /> Salin
                    </button>
                  </span>
                </div>
                <div className="pe-side">
                  <span className="pe-state" data-s={e.state}>
                    {STATE[e.state]}
                  </span>
                  {e.slowUntil && (
                    <span className="pe-state" data-s="slow" title={`Sampai ${when(e.slowUntil)}`}>
                      Mode lambat
                    </span>
                  )}
                  <b className="pe-count">
                    {e.count}
                    {e.capacity ? ` / ${e.capacity}` : ""} <small>pendaftar</small>
                  </b>
                  <span className="org-row">
                    <button type="button" className="small-btn" onClick={() => setViewing(viewing === e.id ? null : e.id)}>
                      <Users size={14} aria-hidden /> Pendaftar
                    </button>
                    <button type="button" className="small-btn ghost" onClick={() => void toggle(e)}>
                      {e.open ? "Tutup" : "Buka"}
                    </button>
                    <button type="button" className="small-btn ghost" onClick={() => setEditing(e)} aria-label={`Ubah ${e.name}`}>
                      <Pencil size={14} aria-hidden />
                    </button>
                    {e.count === 0 && (
                      <button type="button" className="small-btn ghost" onClick={() => void remove(e)} aria-label={`Hapus ${e.name}`}>
                        <Trash2 size={14} aria-hidden />
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && <EventForm key={editing === "new" ? "new" : editing.id} event={editing === "new" ? undefined : editing} onSave={save} onClose={() => setEditing(null)} />}
      {viewed && <Registrants key={viewed.id} event={viewed} onToast={onToast} onChanged={load} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** What the API takes back for an event, from what it sent. */
const eventBody = (e: PreregEvent) => ({
  name: e.name,
  slug: e.slug,
  startDate: e.startDate,
  endDate: e.endDate,
  location: e.location,
  about: e.about,
  banner: e.banner,
  capacity: e.capacity,
  open: e.open,
  deadline: e.deadline ? new Date(e.deadline).toISOString() : null,
});

/** "2027-03-10T09:00" in this device's time, for a datetime-local input. */
const localInput = (t: number | null) => {
  if (!t) return "";
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

function EventForm({ event, onSave, onClose }: { event?: PreregEvent; onSave: (input: Record<string, unknown>, id?: string) => Promise<string | null>; onClose: () => void }) {
  const [name, setName] = useState(event?.name ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [start, setStart] = useState(event?.startDate ?? "");
  const [end, setEnd] = useState(event?.endDate ?? "");
  const [loc, setLoc] = useState(event?.location ?? "Online");
  const [about, setAbout] = useState(event?.about ?? "");
  const [banner, setBanner] = useState<string | null>(event?.banner ?? null);
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : "");
  const [open, setOpen] = useState(event?.open ?? true);
  const [deadline, setDeadline] = useState(localInput(event?.deadline ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rangeError = dateRangeError(start, end);
  const autoSlug = preregSlug(name || "event");
  const finalSlug = slug.trim() || (event ? event.slug : autoSlug);

  return (
    <form
      className="card cp-form pe-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (rangeError) return;
        setBusy(true);
        const msg = await onSave(
          {
            name: name.trim(),
            ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
            startDate: start,
            endDate: end && end !== start ? end : "",
            location: loc.trim(),
            about: about.trim(),
            banner,
            capacity: capacity ? Number(capacity) : null,
            open,
            deadline: deadline ? new Date(deadline).toISOString() : null,
          },
          event?.id,
        );
        setBusy(false);
        if (msg) setError(msg);
      }}
    >
      <h2 className="cp-h2 cp-span" style={{ margin: 0 }}>
        {event ? `Ubah ${event.name}` : "Event baru"}
      </h2>
      <label>
        Nama event
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={80} placeholder="Job Fair Bandung 2027" autoFocus={!event} />
      </label>
      <label>
        Link pendaftaran
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          maxLength={48}
          placeholder={event ? event.slug : autoSlug}
          aria-describedby="pe-slug-note"
        />
        <small id="pe-slug-note" className="muted">
          {location.host}/daftar/{finalSlug}
          {event && slug && slug !== event.slug && " · link lama tidak berlaku lagi"}
        </small>
      </label>
      <fieldset className="org-range">
        <legend>
          <CalendarDays size={14} aria-hidden /> Tanggal acara
        </legend>
        <label>
          Mulai
          <input
            type="date"
            value={start}
            min="2000-01-01"
            max="2100-12-31"
            onChange={(e) => (setStart(e.target.value), end && e.target.value && end < e.target.value && setEnd(e.target.value))}
          />
        </label>
        <label>
          Selesai
          <input type="date" value={end} min={start || "2000-01-01"} max="2100-12-31" disabled={!start} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <small className="muted org-range-note" role={rangeError ? "alert" : undefined} data-error={rangeError ? "" : undefined}>
          {rangeError ?? (start ? `Tampil: ${formatDateRange(start, end && end !== start ? end : undefined)}` : "Kosongkan selesai untuk acara satu hari.")}
        </small>
      </fieldset>
      <label>
        Lokasi
        <input value={loc} onChange={(e) => setLoc(e.target.value)} required minLength={2} maxLength={80} placeholder="Online, atau kota dan tempat" />
        <small className="muted">
          Acara virtual?{" "}
          <button type="button" className="cp-linkbtn" onClick={() => setLoc("Online")}>
            Pakai &quot;Online&quot;
          </button>
        </small>
      </label>
      <label>
        Kuota pendaftar (opsional)
        <input type="number" inputMode="numeric" min={1} max={1000000} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Tanpa batas" />
      </label>
      <label className="cp-span">
        Keterangan singkat (opsional)
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={400}
          rows={2}
          placeholder="Siapa yang cocok ikut, perusahaan peserta, hal yang perlu disiapkan."
        />
        <small className="muted">{about.length}/400</small>
      </label>
      <div className="cp-span pe-banner">
        <span className="pe-banner-label">Banner (opsional)</span>
        {banner ? <img src={banner} alt="Banner event" /> : <span className="muted small">Belum ada banner. Tampil di halaman pendaftaran.</span>}
        <span className="org-row">
          <label className="small-btn ghost pe-file">
            <ImagePlus size={14} aria-hidden /> {banner ? "Ganti" : "Pilih gambar"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setBanner(await readImageFile(file, 960, { square: false }));
                  setError("");
                } catch (x) {
                  setError((x as Error).message);
                }
              }}
            />
          </label>
          {banner && (
            <button type="button" className="small-btn ghost" onClick={() => setBanner(null)}>
              <X size={14} aria-hidden /> Hapus banner
            </button>
          )}
        </span>
      </div>
      <label>
        Batas pendaftaran (opsional)
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      <label className="pe-check">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Pendaftaran dibuka
      </label>
      {error && <p className="bk-err cp-span">{error}</p>}
      <div className="cp-span row">
        <button type="button" className="ghost" onClick={onClose}>
          Batal
        </button>
        <button type="submit" className="small-btn" disabled={busy || !!rangeError || name.trim().length < 3}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}

/** Who signed up for one event: searched, each opened for the full form, exported to CSV. Event admins only (the API checks). */
function Registrants({ event, onToast, onChanged, onClose }: { event: PreregEvent; onToast: (t: string) => void; onChanged: () => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Registrant[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [onlySuspect, setOnlySuspect] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const base = `/api/jobfair/prereg-events/${event.id}/registrants`;
  useEffect(() => {
    let gone = false;
    const t = setTimeout(
      () =>
        void call<{ registrants: Registrant[] }>(`${base}?q=${encodeURIComponent(q.trim())}`).then((r) => {
          if (gone) return;
          if (r.ok) (setRows(r.data.registrants), setError(""));
          else setError(err(r.error, "Pendaftar gagal dimuat."));
        }),
      q ? 300 : 0,
    );
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [base, q, event.count]);

  const exportCsv = async () => {
    try {
      const r = await fetch(`${base}?format=csv`, { credentials: "same-origin" });
      if (!r.ok) return setError(err("", "Ekspor gagal. Coba lagi."));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `pendaftar-${event.slug}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("Ekspor gagal. Periksa internet lalu coba lagi.");
    }
  };
  const moveEmail = async (x: Registrant) => {
    const email = prompt(`Pindahkan pendaftaran ${x.code} ke email Google lain (akun dengan email itu yang akan tertaut saat masuk):`, x.email)?.trim();
    if (!email || email === x.email) return;
    const r = await call<{ registrant: Registrant }>(`${base}/${x.id}`, { method: "PATCH", body: { email } });
    if (!r.ok) return setError(err(r.error, "Gagal memindahkan email."));
    setRows((all) => all?.map((y) => (y.id === x.id ? { ...r.data.registrant, suspect: y.suspect } : y)) ?? null);
    onToast(`${x.code} dipindah ke ${email}`);
  };
  const remove = async (x: Registrant) => {
    if (!confirm(`Hapus pendaftaran ${x.data.fullName} (${x.code})?`)) return;
    const r = await call(`${base}/${x.id}`, { method: "DELETE" });
    if (!r.ok) return setError(err(r.error, "Gagal menghapus."));
    setRows((all) => all?.filter((y) => y.id !== x.id) ?? null);
    onToast(`Pendaftaran ${x.code} dihapus`);
    onChanged();
  };

  const suspects = rows?.filter((x) => x.suspect?.flagged) ?? [];
  const shown = onlySuspect ? suspects : (rows ?? []);
  const pick = (id: string) =>
    setPicked((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const removeMany = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Hapus ${ids.length} pendaftaran? Pendaftar yang dihapus harus mendaftar ulang dan kodenya tidak berlaku lagi.`)) return;
    const r = await call<{ deleted: number }>(base, { method: "DELETE", body: { ids } });
    if (!r.ok) return setError(err(r.error, "Gagal menghapus."));
    const gone = new Set(ids);
    setRows((all) => all?.filter((y) => !gone.has(y.id)) ?? null);
    setPicked(new Set());
    onToast(`${r.data.deleted} pendaftaran dihapus`);
    onChanged();
  };

  return (
    <div className="card">
      <div className="org-row org-row-head">
        <h2 className="cp-h2" style={{ margin: 0 }}>
          Pendaftar · {event.name}
        </h2>
        <span className="org-row">
          <button type="button" className="small-btn" onClick={() => void exportCsv()} disabled={!event.count}>
            <Download size={14} aria-hidden /> Ekspor CSV
          </button>
          <button type="button" className="small-btn ghost" onClick={onClose} aria-label="Tutup daftar pendaftar">
            <X size={14} aria-hidden />
          </button>
        </span>
      </div>
      <label className="pe-search">
        <Search size={15} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="Cari nama, email, kode, kota, atau kampus" aria-label="Cari pendaftar" />
      </label>
      {rows && rows.length > 0 && (
        <div className="org-row pe-bulk">
          <label className="pe-filter">
            <input type="checkbox" checked={onlySuspect} onChange={(e) => (setOnlySuspect(e.target.checked), setPicked(new Set()))} />
            Hanya yang mencurigakan ({suspects.length})
          </label>
          {suspects.length > 0 && (
            <button type="button" className="small-btn ghost" onClick={() => setPicked(new Set(suspects.map((x) => x.id)))}>
              Pilih semua yang mencurigakan
            </button>
          )}
          {picked.size > 0 && (
            <>
              <button type="button" className="small-btn" onClick={() => void removeMany([...picked])}>
                <Trash2 size={14} aria-hidden /> Hapus {picked.size} terpilih
              </button>
              <button type="button" className="small-btn ghost" onClick={() => setPicked(new Set())}>
                Batal pilih
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="bk-err">{error}</p>}
      {!rows && !error && <p className="muted small">Memuat…</p>}
      {rows && shown.length === 0 && <p className="muted small">{onlySuspect ? "Tidak ada pendaftar yang mencurigakan." : q ? "Tidak ada yang cocok." : "Belum ada pendaftar."}</p>}
      {rows && shown.length > 0 && (
        <div className="org-scroll">
          <table className="list cp-table pe-table">
            <thead>
              <tr>
                <th aria-label="Pilih" />
                <th>Kode</th>
                <th>Nama</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Domisili</th>
                <th>Pendidikan</th>
                <th>Status</th>
                <th>Daftar</th>
                <th>Akun</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <RegistrantRow
                  key={x.id}
                  x={x}
                  picked={picked.has(x.id)}
                  onPick={() => pick(x.id)}
                  open={open === x.id}
                  onToggle={() => setOpen(open === x.id ? null : x.id)}
                  onMove={() => void moveEmail(x)}
                  onRemove={() => void remove(x)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        Data pendaftar hanya untuk panitia. &quot;Tertaut&quot; berarti pelamar sudah masuk dengan akun Google emailnya dan profilnya terisi. Salah email? Pindahkan ke email Google
        yang benar; akun itu tertaut saat masuk. &quot;Mencurigakan&quot; hanya tanda (banyak dari jaringan yang sama, diisi sangat cepat, email sama ditulis berbeda, isian tidak
        wajar); periksa dulu sebelum menghapus.
      </p>
    </div>
  );
}

function RegistrantRow({
  x,
  picked,
  onPick,
  open,
  onToggle,
  onMove,
  onRemove,
}: {
  x: Registrant;
  picked: boolean;
  onPick: () => void;
  open: boolean;
  onToggle: () => void;
  onMove: () => void;
  onRemove: () => void;
}) {
  const d = x.data;
  const why = x.suspect?.reasons.map((r) => SUSPECT_LABELS[r] ?? r).join(", ") ?? "";
  return (
    <>
      <tr className="pe-row" data-open={open ? "" : undefined} onClick={onToggle}>
        <td onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={picked} onChange={onPick} aria-label={`Pilih ${d.fullName}`} />
        </td>
        <td>
          <code className="pe-code">{x.code}</code>
        </td>
        <td>
          <b>{d.fullName}</b>
          {x.suspect?.flagged && (
            <span className="pe-suspect" title={why}>
              Mencurigakan
            </span>
          )}
        </td>
        <td>{x.email}</td>
        <td>{d.whatsapp}</td>
        <td>{d.city}</td>
        <td>
          {d.education}
          {d.major && ` ${d.major}`}
        </td>
        <td>{d.status}</td>
        <td>{new Date(x.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
        <td>{x.linkedAt ? <span className="pe-linked">Tertaut</span> : <span className="muted small">Belum</span>}</td>
      </tr>
      {open && (
        <tr className="pe-detail">
          <td colSpan={10}>
            <dl>
              <dt>Kampus / sekolah</dt>
              <dd>{d.institution}</dd>
              <dt>Usia</dt>
              <dd>{d.age} tahun</dd>
              <dt>Bidang minat</dt>
              <dd>{d.fields?.join(", ")}</dd>
              <dt>Jenis kerja</dt>
              <dd>{d.jobTypes?.join(", ")}</dd>
              {d.skills && (
                <>
                  <dt>Keahlian</dt>
                  <dd>{d.skills}</dd>
                </>
              )}
              {d.experience && (
                <>
                  <dt>Pengalaman</dt>
                  <dd className="pe-pre">{d.experience}</dd>
                </>
              )}
              {d.link && /^https?:\/\//i.test(d.link) && (
                <>
                  <dt>Link</dt>
                  <dd>
                    <a href={d.link} target="_blank" rel="noreferrer noopener">
                      {d.link}
                    </a>
                  </dd>
                </>
              )}
              {x.suspect?.flagged && (
                <>
                  <dt>Mencurigakan</dt>
                  <dd>{why}</dd>
                </>
              )}
              <dt>Terdaftar</dt>
              <dd>
                {when(x.at)}
                {x.updatedAt - x.at > 60_000 && ` · diubah ${when(x.updatedAt)}`}
                {x.linkedAt && ` · tertaut ${when(x.linkedAt)}`}
              </dd>
            </dl>
            <span className="org-row">
              <button type="button" className="small-btn ghost" onClick={onMove}>
                Pindahkan ke email lain
              </button>
              <button type="button" className="small-btn ghost" onClick={onRemove}>
                <Trash2 size={14} aria-hidden /> Hapus
              </button>
            </span>
          </td>
        </tr>
      )}
    </>
  );
}
