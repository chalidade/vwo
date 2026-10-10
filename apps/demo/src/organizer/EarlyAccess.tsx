import { useEffect, useState } from "react";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";

interface Tester {
  email: string;
  role: "seeker" | "company" | "organizer";
  boothKey: string | null;
  note: string | null;
  since: number;
}

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(path, init ? { method: init.method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: init.body === undefined ? undefined : JSON.stringify(init.body) } : { credentials: "same-origin" });
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: d.error ?? `http_${r.status}` };
  } catch {
    return { ok: false, error: "offline" };
  }
}

const ROLE = { seeker: "Pelamar", company: "Perusahaan", organizer: "Panitia" } as const;

/** People who may try the app before launch: as a job seeker, a company running a trial booth, or panitia. */
export function OrgEarlyAccess({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const [list, setList] = useState<Tester[] | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Tester["role"]>("seeker");
  const booths = [...fair.fair.booths].sort((a, b) => a.company.localeCompare(b.company));
  const [booth, setBooth] = useState("");
  const [note, setNote] = useState("");
  const [invite, setInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = () => void call<{ testers: Tester[] }>("/api/jobfair/early-access").then((r) => (r.ok ? setList(r.data.testers) : setError("Daftar early access gagal dimuat.")));
  useEffect(load, []);

  if (!LIVE)
    return (
      <div className="org">
        <p className="card cp-server-note">Early access hanya ada di versi live (jobfair.co.id).</p>
      </div>
    );

  const boothName = (id: string | null) => (id ? (fair.booth(id)?.company ?? id) : "");
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const boothKey = role === "company" ? booth || booths[0]?.id : null;
    setBusy(true);
    const r = await call("/api/jobfair/early-access", { method: "POST", body: { email: email.trim(), role, boothKey, note: note.trim() || null, invite } });
    setBusy(false);
    if (!r.ok) return setError(r.error === "invalid_input" ? "Cek lagi alamat emailnya." : r.error === "not_allowed" ? "Hanya admin utama acara yang bisa menambah atau mengubah panitia." : "Gagal menyimpan. Coba lagi.");
    onToast(`${email.trim()} bisa masuk sebagai ${role === "company" ? `perusahaan (${boothName(boothKey ?? null)})` : role === "organizer" ? "panitia" : "pelamar"}${invite ? " · undangan terkirim" : ""}`);
    setEmail("");
    setNote("");
    load();
  };
  const remove = async (t: Tester) => {
    if (!confirm(`Cabut early access ${t.email}?${t.role === "company" ? " Akunnya juga dilepas dari stand percobaan." : ""}`)) return;
    const r = await call(`/api/jobfair/early-access?email=${encodeURIComponent(t.email)}`, { method: "DELETE" });
    if (!r.ok) return setError(r.error === "not_allowed" ? "Hanya admin utama acara yang bisa mencabut panitia." : "Gagal mencabut. Coba lagi.");
    onToast(`Early access ${t.email} dicabut`);
    load();
  };

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Early access</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Email yang terdaftar di sini bisa masuk ke jobfair sebelum rilis untuk mencoba sistem. Pelamar masuk lewat <b>jobfair.co.id/masuk</b>. Perusahaan mendapat satu stand percobaan dan masuk lewat <b>jobfair.co.id/masuk-perusahaan</b>, tanpa PIN. Semua masuk dengan akun Google yang emailnya sama.
        </p>
        <form className="ea-form" onSubmit={add}>
          <label>
            Email Google
            <input id="ea-email" type="email" required maxLength={200} placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Coba sebagai
            <select id="ea-role" value={role} onChange={(e) => setRole(e.target.value as Tester["role"])}>
              <option value="seeker">Pelamar</option>
              <option value="company">Perusahaan</option>
              <option value="organizer">Panitia</option>
            </select>
          </label>
          {role === "company" && (
            <label>
              Stand percobaan
              <select id="ea-booth" value={booth || booths[0]?.id || ""} onChange={(e) => setBooth(e.target.value)}>
                {booths.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.company}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Catatan (opsional)
            <input id="ea-note" maxLength={200} placeholder="Teman HR, investor, …" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="ea-check">
            <input id="ea-invite" type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Kirim email undangan
          </label>
          <button type="submit" disabled={busy || !email.trim()}>
            + Beri akses
          </button>
        </form>
        {role === "organizer" && <p className="muted small">Panitia bisa mengatur semua hal di acara seperti admin: stand, harga, verifikasi perusahaan, dan pengumuman. Hanya admin utama yang bisa menambah atau mencabut panitia.</p>}
        {role === "company" && <p className="muted small">Perubahan tester di stand percobaan langsung terlihat oleh semua yang punya akses. Pakai stand contoh, bukan stand perusahaan asli.</p>}
        {error && <p className="bk-err">{error}</p>}
        {!list && !error && <p className="muted small">Memuat…</p>}
        {list && list.length === 0 && <p className="muted small">Belum ada email early access.</p>}
        {list && list.length > 0 && (
          <ul className="cp-jobs">
            {list.map((t) => (
              <li key={t.email}>
                <span style={{ minWidth: 0 }}>
                  <b>{t.email}</b>
                  <span className="muted small">
                    {" "}
                    · {ROLE[t.role]}
                    {t.role === "company" && ` · ${boothName(t.boothKey)}`}
                    {t.note && ` · ${t.note}`}
                    {` · sejak ${new Date(t.since).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                  </span>
                </span>
                <button type="button" className="small-btn ghost" onClick={() => void remove(t)}>
                  Cabut
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
