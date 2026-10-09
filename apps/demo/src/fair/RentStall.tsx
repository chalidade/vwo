import { useState } from "react";
import { STALL_PRICE } from "../jobfair-engine";
import { fair } from "../useFair";
import { PAY_METHODS, rupiah } from "./company";
import { Modal } from "./Modal";

const COLORS = ["#ea580c", "#dc2626", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#9333ea", "#7c2d12"];
const EMOJIS = ["🍽️", "🍜", "🍛", "🍔", "🍕", "🍢", "🥟", "🧋", "☕", "🍰", "🥗", "🍦"];

/** Renting an empty food court stand: the business, one voucher to sell, demo payment. */
export function RentStall({ slot, onClose }: { slot: number; onClose: () => void }) {
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [promo, setPromo] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const [color, setColor] = useState(COLORS[0]!);
  const [deal, setDeal] = useState("");
  const [worth, setWorth] = useState("");
  const [price, setPrice] = useState(8);
  const [method, setMethod] = useState<string>(PAY_METHODS[0]);
  const [error, setError] = useState("");
  const side = slot < 8 ? "dinding belakang" : slot < 12 ? "sisi kiri" : "sisi kanan";

  return (
    <Modal title="🍜 Sewa stan food court" onClose={onClose} className="bk">
      {step === "form" && (
        <form
          className="bk-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep("pay");
          }}
        >
          <p className="bk-place">
            📍 Food Court, {side} · <b>tersedia</b> · {rupiah(STALL_PRICE)} per acara
          </p>
          <label>
            Nama usaha
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Warung Contoh" />
          </label>
          <label>
            Penjaga stan
            <input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={30} placeholder="Mas Contoh" />
          </label>
          <label>
            Promo singkat
            <input value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={80} placeholder="Nasi uduk komplit, cocok buat sarapan" />
          </label>
          <div className="bk-colors" role="radiogroup" aria-label="Ikon">
            <span className="small">Ikon</span>
            {EMOJIS.map((x) => (
              <button key={x} type="button" role="radio" aria-checked={emoji === x} data-active={emoji === x ? "" : undefined} className="rs-emoji" onClick={() => setEmoji(x)}>
                {x}
              </button>
            ))}
          </div>
          <div className="bk-colors" role="radiogroup" aria-label="Warna">
            <span className="small">Warna</span>
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} data-active={color === c ? "" : undefined} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <label>
            Voucher yang dijual (boleh dikosongkan)
            <input value={deal} onChange={(e) => setDeal(e.target.value)} maxLength={60} placeholder="Voucher makan Rp20.000" />
          </label>
          {deal.trim() && (
            <div className="row">
              <label>
                Nilai di outlet
                <input value={worth} onChange={(e) => setWorth(e.target.value)} maxLength={20} placeholder="Rp20.000" />
              </label>
              <label>
                Harga (koin)
                <input type="number" min={1} max={200} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </label>
            </div>
          )}
          <button type="submit" className="bk-go">
            Lanjut ke pembayaran · {rupiah(STALL_PRICE)}
          </button>
        </form>
      )}

      {step === "pay" && (
        <div className="bk-form">
          <table className="list bk-sum">
            <tbody>
              <tr>
                <td>
                  Sewa stan food court · {emoji} {name}
                </td>
                <td>{rupiah(STALL_PRICE)}</td>
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
                const r = fair.addStall(slot, { name, vendor, promo, emoji, color, deal: deal.trim() ? { title: deal, worth, price } : undefined });
                if (!r) return setError("Maaf, stan ini baru saja disewa usaha lain. Pilih stan kosong lain.");
                setStep("done");
              }}
            >
              Bayar {rupiah(STALL_PRICE)}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="bk-form bk-done">
          <p className="bk-ok">
            ✓ Pembayaran diterima. Stan {emoji} {name} sudah buka di Food Court.
          </p>
          <p className="small">Panitia bisa mengubah atau melepas stan ini dari halaman admin, tab Food Court.</p>
          <button type="button" className="ghost" onClick={onClose}>
            Kembali ke job fair
          </button>
        </div>
      )}
    </Modal>
  );
}
