import { Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";

type Closed = { eventName: string; booths: number; at: number };

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(
      path,
      init ? { method: init.method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : { credentials: "same-origin" },
    );
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: d.error ?? `http_${r.status}` };
  } catch {
    return { ok: false, error: "offline" };
  }
}

const date = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Closing an event: every booth's post-event report is saved under the event's name. Companies then
 * see their next event compared with this one, and can open this report again from their portal.
 */
export function OrgReports({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const [list, setList] = useState<Closed[] | null>(null);
  const [name, setName] = useState(fair.fair.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    void call<{ events: Closed[] }>("/api/jobfair/reports").then((r) =>
      r.ok ? setList(r.data.events) : setError(r.error === "not_allowed" ? "Hanya panitia yang bisa melihat ini." : "Daftar event gagal dimuat."),
    );
  useEffect(() => {
    if (LIVE) load();
  }, []);

  if (!LIVE)
    return (
      <div className="org">
        <p className="card cp-server-note">
          Menutup event dan menyimpan laporan hanya ada di versi live (jobfair.co.id). Di demo, perusahaan tetap bisa melihat laporan event berjalan di portalnya.
        </p>
      </div>
    );

  const close = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventName = name.trim();
    if (eventName.length < 3) return setError("Nama event minimal 3 huruf.");
    if (!confirm(`Tutup event "${eventName}" dan simpan laporan semua stand? Laporan berikutnya tiap stand mulai dihitung dari sekarang.`)) return;
    setError("");
    setBusy(true);
    const r = await call<{ saved: number }>("/api/jobfair/reports", { method: "POST", body: { eventName } });
    setBusy(false);
    if (!r.ok)
      return setError(
        r.error === "name_taken"
          ? "Nama event itu sudah dipakai. Pakai nama lain, misalnya dengan bulan dan tahun."
          : r.error === "not_allowed"
            ? "Hanya panitia yang bisa menutup event."
            : r.error === "too_many_requests"
              ? "Terlalu sering. Coba lagi nanti."
              : "Gagal menyimpan laporan. Coba lagi.",
      );
    onToast(`Laporan ${r.data.saved} stand tersimpan sebagai "${eventName}"`);
    load();
  };

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Tutup event & simpan laporan</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Laporan pasca-event setiap stand (kunjungan, pelamar, corong rekrutmen, demografi, dan biaya) dibekukan dengan nama event ini. Perusahaan bisa membukanya lagi di tab{" "}
          <b>Laporan</b> portal mereka, dan event berikutnya otomatis dibandingkan dengan laporan ini. Data lamaran dan stand tidak dihapus.
        </p>
        <form className="ea-form" onSubmit={close}>
          <label>
            Nama event
            <input required minLength={3} maxLength={80} placeholder="Job Fair Oktober 2026" value={name} onChange={(e) => (setName(e.target.value), setError(""))} />
          </label>
          <button type="submit" disabled={busy || name.trim().length < 3}>
            <Archive size={15} aria-hidden /> {busy ? "Menyimpan…" : "Tutup event & simpan laporan"}
          </button>
        </form>
        {error && <p className="bk-err">{error}</p>}
      </div>
      <div className="card">
        <h2 className="cp-h2">Event yang sudah ditutup</h2>
        {!list && !error && <p className="muted small">Memuat…</p>}
        {list && list.length === 0 && <p className="muted small">Belum ada event yang ditutup.</p>}
        {list && list.length > 0 && (
          <table className="list cp-table">
            <tbody>
              {list.map((e) => (
                <tr key={e.eventName}>
                  <td>
                    <b>{e.eventName}</b>
                  </td>
                  <td>{e.booths} stand</td>
                  <td className="muted">{date(e.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
