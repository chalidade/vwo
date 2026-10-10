import { useEffect, useState } from "react";
import { coinText, rupiah } from "../fair/company";
import { BOOTH_SLOTS } from "../jobfair-engine";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";

interface Registration {
  id: string;
  company: string;
  industry: string;
  color: string;
  website: string | null;
  city: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  tier: string;
  price: number;
  method: string | null;
  status: "unpaid" | "paid" | "verified" | "rejected";
  boothKey: string | null;
  pin: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
}

const STATUS = { paid: "Perlu diverifikasi", unpaid: "Belum bayar", verified: "Terverifikasi", rejected: "Ditolak" } as const;
const SLOT_NAMES = ["Kiri atas", "Kiri bawah", "Tengah atas", "Tengah bawah", "Kanan atas", "Kanan bawah"];
const slotName = (x: number, y: number) => SLOT_NAMES[BOOTH_SLOTS.findIndex((s) => s.x === x && s.y === y)] ?? "";

async function call<T>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(path, body === undefined ? { credentials: "same-origin" } : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    return r.ok ? { ok: true, data: d } : { ok: false, error: d.error ?? `http_${r.status}` };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Companies that registered through the company link: the organiser checks they are real, then opens their booth. */
export function OrgRegistrations({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const [list, setList] = useState<Registration[] | null>(null);
  const [error, setError] = useState("");
  const load = () => void call<{ registrations: Registration[] }>("/api/jobfair/registrations").then((r) => (r.ok ? setList(r.data.registrations) : setError("Daftar pendaftaran gagal dimuat.")));
  useEffect(load, []);

  if (!LIVE)
    return (
      <div className="org">
        <p className="card cp-server-note">Pendaftaran perusahaan lewat link registrasi hanya ada di versi live (jobfair.co.id/daftar-perusahaan).</p>
      </div>
    );
  const order = ["paid", "unpaid", "verified", "rejected"] as const;
  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">📝 Pendaftaran perusahaan</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Perusahaan mendaftar lewat <b>jobfair.co.id/daftar-perusahaan</b>, memilih paket, lalu membayar. Cek website, email kantor, dan nomor HP-nya. Kalau benar perusahaan nyata, pilih tempat stand lalu verifikasi: booth langsung berdiri dan perusahaan menerima kode dan PIN lewat email dan halaman pendaftarannya.
        </p>
        {error && <p className="bk-err">{error}</p>}
        {!list && !error && <p className="muted small">Memuat…</p>}
        {list && list.length === 0 && <p className="muted small">Belum ada pendaftaran.</p>}
        {list &&
          order.map((s) => {
            const rows = list.filter((r) => r.status === s);
            if (!rows.length) return null;
            return (
              <section key={s} className="pr-group">
                <h3 className="cp-h3">
                  {STATUS[s]} ({rows.length})
                </h3>
                <ul className="cp-jobs">
                  {rows.map((r) => (
                    <Row key={r.id} r={r} onDone={(t) => (onToast(t), load())} />
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
    </div>
  );
}

function Row({ r, onDone }: { r: Registration; onDone: (t: string) => void }) {
  const free = fair.freeSlots();
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = free[slot];
  return (
    <li style={{ display: "block" }}>
      <b style={{ color: r.color }}>■</b> <b>{r.company}</b> · {r.tier === "premium" ? "👑 Stand VIP" : "Stand reguler"} · {coinText(r.price)} (≈ {rupiah(r.price)})
      {r.method && <span className="muted small"> · dibayar via {r.method}</span>}
      <div className="muted small">
        {r.industry} · {r.city} · {r.website ? (
          <a href={r.website} target="_blank" rel="noopener noreferrer">
            {r.website}
          </a>
        ) : (
          "tanpa website"
        )}
      </div>
      <div className="muted small">
        PIC {r.contactName} ({r.contactRole}) · {r.email} · {r.phone} · daftar {new Date(r.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </div>
      {r.status === "verified" && (
        <div className="small">
          🔑 Kode <code>{r.boothKey}</code> · PIN <code>{r.pin}</code>
        </div>
      )}
      {r.status === "rejected" && <div className="small bk-err">Ditolak: {r.note}</div>}
      {(r.status === "paid" || r.status === "unpaid") && (
        <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {r.status === "paid" &&
            (free.length ? (
              <>
                <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} aria-label="Tempat stand">
                  {free.map((s, i) => (
                    <option key={`${s.floor}-${s.x}-${s.y}`} value={i}>
                      {fair.fair.floors[s.floor]?.name} · {slotName(s.x, s.y)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="small-btn"
                  disabled={busy}
                  onClick={async () => {
                    if (!pick || !confirm(`Verifikasi ${r.company} dan buka stand di ${fair.fair.floors[pick.floor]?.name} · ${slotName(pick.x, pick.y)}?`)) return;
                    setBusy(true);
                    const res = await call<{ boothId: string; pin: string }>(`/api/jobfair/registrations/${r.id}/verify`, pick);
                    setBusy(false);
                    if (!res.ok) return setError(res.error === "slot_taken" ? "Tempat ini baru saja terisi. Pilih tempat lain." : "Verifikasi gagal. Coba lagi.");
                    onDone(`${r.company} terverifikasi · kode ${res.data.boothId} · PIN ${res.data.pin}`);
                  }}
                >
                  ✓ Verifikasi & buka stand
                </button>
              </>
            ) : (
              <span className="muted small">Tidak ada tempat stand kosong. Kosongkan atau tambah lantai dulu.</span>
            ))}
          <button
            type="button"
            className="small-btn ghost"
            disabled={busy}
            onClick={async () => {
              const note = prompt(`Alasan menolak ${r.company} (dikirim ke perusahaan):`, "Data perusahaan tidak bisa kami verifikasi.");
              if (!note || note.trim().length < 3) return;
              setBusy(true);
              const res = await call(`/api/jobfair/registrations/${r.id}/reject`, { note: note.trim() });
              setBusy(false);
              if (!res.ok) return setError("Gagal menolak. Coba lagi.");
              onDone(`${r.company} ditolak`);
            }}
          >
            Tolak
          </button>
        </div>
      )}
      {error && <p className="bk-err">{error}</p>}
    </li>
  );
}
