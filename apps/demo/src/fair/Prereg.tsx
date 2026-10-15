import { useEffect, useState } from "react";
import { type JoinedEvent, claimPreregCode, loadJoinedEvents } from "../prereg";

const CLAIM_ERRORS: Record<string, string> = {
  not_found:
    "Kode tidak ditemukan untuk email akun ini. Kode hanya bisa dipakai oleh akun Google dengan email yang sama saat mendaftar. Salah email? Minta panitia memindahkannya.",
  verify_first: "Verifikasi email akunmu dulu.",
  too_many_requests: "Terlalu banyak percobaan. Coba lagi nanti.",
};

/** In the bag's profile tab: the events this account pre-registered for, and "Punya kode?". */
export function PreregJoined({ onLinked }: { onLinked?: () => void }) {
  const [events, setEvents] = useState<JoinedEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadJoinedEvents().then((d) => setEvents(d?.events ?? []));
  }, []);
  if (!events) return null;
  return (
    <div className="sp-prereg">
      <h3 className="sp-h3">📝 Event yang kamu ikuti</h3>
      {events.length === 0 ? (
        <p className="sp-muted">Belum ada. Kalau kamu sudah pra-registrasi dengan email akun Google ini, datanya terpasang otomatis saat masuk.</p>
      ) : (
        <ul className="sp-prereg-list">
          {events.map((e) => (
            <li key={e.code}>
              <b>{e.name}</b>
              <span className="sp-muted">{[e.date, e.location].filter(Boolean).join(" · ")}</span>
              <code>{e.code}</code>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button type="button" className="sp-link" onClick={() => setOpen(true)}>
          Punya kode? Masukkan kode
        </button>
      ) : (
        <form
          className="sp-prereg-form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setBusy(true);
            const r = await claimPreregCode(code);
            setBusy(false);
            if (!r.ok) return setMsg({ ok: false, text: CLAIM_ERRORS[r.error] ?? "Gagal. Coba lagi." });
            setEvents(r.events);
            setCode("");
            setMsg({ ok: true, text: "Pendaftaran tertaut. Data pra-registrasi mengisi bagian profil yang masih kosong." });
            onLinked?.();
          }}
        >
          <input
            value={code}
            onChange={(e) => (setCode(e.target.value.toUpperCase()), setMsg(null))}
            placeholder="JF-XXXX-XXXX"
            maxLength={20}
            required
            aria-label="Kode pra-registrasi"
          />
          <button type="submit" className="mb-order" disabled={busy}>
            {busy ? "…" : "Tautkan"}
          </button>
        </form>
      )}
      {msg && <p className={msg.ok ? "sp-ok" : "sp-err"}>{msg.text}</p>}
    </div>
  );
}
