import { useState } from "react";
import { STAND_PRICES } from "../jobfair-engine";
import { sessionLogin } from "../company/login";
import { LIVE } from "../mode";
import { fair } from "../useFair";
import { PAY_METHODS, rupiah } from "./company";
import { Modal } from "./Modal";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0d9488", "#db2777", "#334155"];

/** Booking an empty stand from the hall: company details, demo payment, then the portal code and PIN. */
export function BookStand({ slot, onClose }: { slot: { floor: number; x: number; y: number }; onClose: () => void }) {
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [tier, setTier] = useState<"regular" | "premium">("regular");
  const [method, setMethod] = useState<string>(PAY_METHODS[0]);
  const [done, setDone] = useState<{ id: string; company: string; pin: string } | null>(null);
  const [error, setError] = useState("");
  const floorName = fair.fair.floors[slot.floor]?.name ?? "Aula";
  if (LIVE)
    return (
      <Modal title="🏬 Booking stand" onClose={onClose} className="bk">
        <div className="bk-form">
          <p className="bk-place">📍 Stand ini masih kosong.</p>
          <p className="small">
            Untuk membuka booth, perusahaan mendaftar lewat formulir perusahaan: isi data perusahaan, pilih paket, dan bayar. Panitia memverifikasi bahwa perusahaannya nyata, lalu mengirim kode dan PIN untuk masuk ke portal perusahaan.
          </p>
          <div className="row">
            <a className="small-btn cp-link" href="/daftar-perusahaan">
              Daftarkan perusahaan →
            </a>
            <button type="button" className="ghost" onClick={onClose}>
              Kembali
            </button>
          </div>
        </div>
      </Modal>
    );
  const place = `${floorName}, ${slot.y < 5 ? "baris belakang" : "baris depan"} ${slot.x < 10 ? "kiri" : slot.x < 25 ? "tengah" : "kanan"}`;

  return (
    <Modal title="🏬 Booking stand" onClose={onClose} className="bk">
      {step === "form" && (
        <form
          className="bk-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (company.trim() && contact.trim() && email.includes("@")) setStep("pay");
          }}
        >
          <p className="bk-place">
            📍 {place} · <b>tersedia</b>
          </p>
          <div className="bk-tiers">
            {(["regular", "premium"] as const).map((t) => (
              <button key={t} type="button" className="bk-tier" data-active={tier === t ? "" : undefined} onClick={() => setTier(t)}>
                <b>{t === "premium" ? "👑 Stand VIP" : "Stand reguler"}</b>
                <span>{rupiah(STAND_PRICES[t])}</span>
                <small>{t === "premium" ? "Lampu sorot, karpet emas, LED berjalan" : "Panel, meja recruiter, roll-up banner"}</small>
              </button>
            ))}
          </div>
          <label>
            Nama perusahaan
            <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={40} placeholder="PT Contoh Maju" />
          </label>
          <label>
            Bidang usaha
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={40} placeholder="Teknologi, Retail, …" />
          </label>
          <label>
            Nama PIC / recruiter
            <input value={contact} onChange={(e) => setContact(e.target.value)} required maxLength={30} />
          </label>
          <label>
            Email PIC
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={60} placeholder="hr@perusahaan.example" />
          </label>
          <div className="bk-colors" role="radiogroup" aria-label="Warna brand">
            <span className="small">Warna brand</span>
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} data-active={color === c ? "" : undefined} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <button type="submit" className="bk-go">
            Lanjut ke pembayaran · {rupiah(STAND_PRICES[tier])}
          </button>
        </form>
      )}

      {step === "pay" && (
        <div className="bk-form">
          <table className="list bk-sum">
            <tbody>
              <tr>
                <td>{tier === "premium" ? "Stand VIP" : "Stand reguler"}</td>
                <td>{rupiah(STAND_PRICES[tier])}</td>
              </tr>
              <tr>
                <td className="muted small">
                  {company} · {place}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <label>
            Metode pembayaran
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <p className="muted small">Pembayaran di demo ini simulasi: tidak ada uang yang ditarik.</p>
          {error && <p className="bk-err">{error}</p>}
          <div className="row">
            <button type="button" className="ghost" onClick={() => setStep("form")}>
              ← Ubah data
            </button>
            <button
              type="button"
              className="bk-go"
              onClick={() => {
                const r = fair.bookStand({ company, industry, color, contact, email, tier, method, ...slot });
                if (!r) return setError("Maaf, stand ini baru saja dibooking perusahaan lain. Pilih stand kosong lain.");
                setDone({ id: r.booth.id, company: r.booth.company, pin: r.pin });
                setStep("done");
              }}
            >
              Bayar {rupiah(STAND_PRICES[tier])}
            </button>
          </div>
        </div>
      )}

      {step === "done" && done && (
        <div className="bk-form bk-done">
          <p className="bk-ok">✓ Pembayaran diterima. Stand {done.company} sudah berdiri di {floorName}.</p>
          <p className="small">
            {LIVE
              ? "Akunmu sudah jadi pengelola stand ini. Bagikan kode dan PIN ke rekan kerja supaya mereka bisa ikut mengelola dengan akun Google masing-masing:"
              : "Masuk ke portal perusahaan untuk mengisi lowongan, profil, dan dekorasi stand:"}
          </p>
          <dl className="bk-cred">
            <dt>Kode perusahaan</dt>
            <dd>{done.id}</dd>
            <dt>PIN</dt>
            <dd>{done.pin}</dd>
          </dl>
          <div className="row">
            <a className="small-btn cp-link" href={`#/jobfair/company/${done.id}`} onClick={() => !LIVE && sessionLogin(done.id)}>
              Buka portal perusahaan →
            </a>
            <button type="button" className="ghost" onClick={onClose}>
              Kembali ke job fair
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

