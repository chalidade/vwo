import { useState } from "react";
import { standSlotIndex, standSlotName } from "@vwo/shared";
import { currentAccount } from "../account";
import { leadError, sendLead } from "../leads";
import { LIVE } from "../mode";
import { fair } from "../useFair";
import { Modal } from "./Modal";

/**
 * An empty stand in the hall: the company fills in a short form (no prices, no payment) and the
 * organiser calls back, then builds the stand and sends the portal code and PIN.
 */
export function BookStand({ slot, onClose }: { slot: { floor: number; x: number; y: number }; onClose: () => void }) {
  const account = currentAccount();
  const [f, setF] = useState({
    company: "",
    industry: "",
    city: "",
    website: "",
    contactName: account?.name ?? "",
    contactRole: "HR",
    email: account?.email ?? "",
    phone: "",
    note: "",
    website2: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const floorName = fair.fair.floors[slot.floor]?.name ?? "Aula";
  const place = `${floorName}, ${standSlotName(standSlotIndex(slot.x, slot.y)).toLowerCase()}`;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => (setF({ ...f, [k]: e.target.value }), setError(""));

  if (LIVE && !account)
    return (
      <Modal title="🏬 Ajukan stand" onClose={onClose} className="bk">
        <div className="bk-form">
          <p className="bk-place">📍 {place} · masih kosong</p>
          <p className="small">
            Masuk dulu ke job fair dengan akun Google kantor, lalu ketuk stand ini lagi untuk mengisi formulir. Akun itu yang nanti mengelola booth perusahaanmu.
          </p>
          <button type="button" className="ghost" onClick={onClose}>
            Kembali
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal title="🏬 Ajukan stand" onClose={onClose} className="bk">
      {sent ? (
        <div className="bk-form bk-done">
          <p className="bk-ok">✓ Formulir terkirim. Panitia akan menghubungi kamu.</p>
          <p className="small">
            Panitia akan menelepon atau mengirim WhatsApp ke {f.phone} untuk membicarakan paket dan tempat stand. Setelah sepakat, panitia membuat stand {f.company} dan mengirim
            kode serta PIN portal perusahaan ke {f.email}.
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
            const r = await sendLead({ kind: "booth", data: { ...f, want: slot } });
            setBusy(false);
            if (!r.ok) return setError(leadError(r.error));
            setSent(true);
          }}
        >
          <p className="bk-place">
            📍 {place} · <b>tersedia</b>
          </p>
          <p className="small lead-intro">
            Isi data perusahaan. Panitia akan menghubungi kamu untuk membicarakan paket dan tempat, lalu membuatkan stand dan memberi akses portal.
          </p>
          <label>
            Nama perusahaan
            <input value={f.company} onChange={set("company")} required minLength={2} maxLength={60} placeholder="PT Contoh Maju" />
          </label>
          <div className="lead-pair">
            <label>
              Bidang usaha
              <input value={f.industry} onChange={set("industry")} required minLength={2} maxLength={60} placeholder="Teknologi, Retail, …" />
            </label>
            <label>
              Kota kantor
              <input value={f.city} onChange={set("city")} required minLength={2} maxLength={60} placeholder="Jakarta" />
            </label>
          </div>
          <label>
            Website (boleh dikosongkan)
            <input value={f.website} onChange={set("website")} maxLength={120} inputMode="url" placeholder="perusahaan.co.id" />
          </label>
          <div className="lead-pair">
            <label>
              Nama PIC
              <input value={f.contactName} onChange={set("contactName")} required minLength={2} maxLength={60} />
            </label>
            <label>
              Jabatan
              <input value={f.contactRole} onChange={set("contactRole")} required minLength={2} maxLength={60} placeholder="HR Manager" />
            </label>
          </div>
          <div className="lead-pair">
            <label>
              Email kantor
              <input type="email" value={f.email} onChange={set("email")} required maxLength={120} placeholder="hr@perusahaan.co.id" />
            </label>
            <label>
              No. HP / WhatsApp
              <input type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} required maxLength={20} placeholder="0812 3456 7890" />
            </label>
          </div>
          <label>
            Catatan (boleh dikosongkan)
            <textarea rows={2} value={f.note} onChange={set("note")} maxLength={500} placeholder="Misalnya: ingin stand VIP, butuh 2 stand, waktu terbaik dihubungi" />
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
            Belum ada pembayaran di sini. Paket dan biaya dibicarakan langsung dengan panitia.
          </p>
        </form>
      )}
    </Modal>
  );
}
