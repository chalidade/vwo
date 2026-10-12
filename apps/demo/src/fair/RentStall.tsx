import { useState } from "react";
import { currentAccount } from "../account";
import { leadError, sendLead } from "../leads";
import { LIVE } from "../mode";
import { Modal } from "./Modal";

/**
 * An empty food court stand: the food business fills in a short form (no prices, no coins) and the
 * organiser calls back, then opens the stall from the organiser hub.
 */
export function RentStall({ slot, onClose }: { slot: number; onClose: () => void }) {
  const account = currentAccount();
  const [f, setF] = useState({ business: "", sells: "", contactName: account?.name ?? "", email: account?.email ?? "", phone: "", note: "", website2: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const side = slot < 8 ? "dinding belakang" : slot < 12 ? "sisi kiri" : "sisi kanan";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => (setF({ ...f, [k]: e.target.value }), setError(""));

  if (LIVE && !account)
    return (
      <Modal title="🍜 Ajukan stan food court" onClose={onClose} className="bk">
        <div className="bk-form">
          <p className="bk-place">📍 Food Court, {side} · masih kosong</p>
          <p className="small">Masuk dulu ke job fair, lalu ketuk stan ini lagi untuk mengisi formulir.</p>
          <button type="button" className="ghost" onClick={onClose}>
            Kembali
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal title="🍜 Ajukan stan food court" onClose={onClose} className="bk">
      {sent ? (
        <div className="bk-form bk-done">
          <p className="bk-ok">✓ Formulir terkirim. Panitia akan menghubungi kamu.</p>
          <p className="small">
            Panitia akan menelepon atau mengirim WhatsApp ke {f.phone}. Setelah sepakat, panitia membuka stan {f.business} di Food Court.
          </p>
          <button type="button" className="ghost" onClick={onClose}>
            Kembali ke job fair
          </button>
        </div>
      ) : (
        <form
          className="bk-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await sendLead({ kind: "stall", data: { ...f, slot } });
            setBusy(false);
            if (!r.ok) return setError(leadError(r.error));
            setSent(true);
          }}
        >
          <p className="bk-place">
            📍 Food Court, {side} · <b>tersedia</b>
          </p>
          <p className="small lead-intro">Punya usaha kuliner? Isi formulir ini, panitia akan menghubungi kamu lalu membuka stan untukmu.</p>
          <label>
            Nama usaha / stan
            <input value={f.business} onChange={set("business")} required minLength={2} maxLength={60} placeholder="Warung Contoh" />
          </label>
          <label>
            Jualan apa
            <input value={f.sells} onChange={set("sells")} required minLength={2} maxLength={120} placeholder="Nasi uduk, kopi susu, kue basah" />
          </label>
          <label>
            Nama kontak
            <input value={f.contactName} onChange={set("contactName")} required minLength={2} maxLength={60} />
          </label>
          <div className="lead-pair">
            <label>
              Email
              <input type="email" value={f.email} onChange={set("email")} required maxLength={120} />
            </label>
            <label>
              No. HP / WhatsApp
              <input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} required maxLength={20} placeholder="0812 3456 7890" />
            </label>
          </div>
          <label>
            Catatan (boleh dikosongkan)
            <textarea rows={2} value={f.note} onChange={set("note")} maxLength={500} placeholder="Misalnya: punya outlet di Bekasi, waktu terbaik dihubungi" />
          </label>
          <label className="lead-hp" aria-hidden>
            Website kedua
            <input tabIndex={-1} autoComplete="off" value={f.website2} onChange={set("website2")} />
          </label>
          {error && <p className="bk-err">{error}</p>}
          <button type="submit" className="bk-go" disabled={busy}>
            {busy ? "Mengirim…" : "Kirim formulir"}
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            Belum ada pembayaran di sini. Semua dibicarakan langsung dengan panitia.
          </p>
        </form>
      )}
    </Modal>
  );
}
