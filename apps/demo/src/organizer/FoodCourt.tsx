import { useState } from "react";
import { STALL_SLOTS, stallSlot } from "@vwo/shared";
import { stallPrice } from "../jobfair-engine";
import { coinText, rupiah } from "../fair/company";
import { fair } from "../useFair";

const COLORS = ["#ea580c", "#dc2626", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#9333ea", "#7c2d12"];
const sideOf = (slot: number) => (slot < 8 ? `Belakang ${slot + 1}` : slot < 12 ? `Kiri ${slot - 7}` : `Kanan ${slot - 11}`);

/** The organiser fills, empties and resets the food court's stands. Empty ones can be rented from the map. */
export function OrgFoodCourt({ onToast }: { onToast: (t: string) => void }) {
  const room = fair.foodCourt();
  const [adding, setAdding] = useState<number | null>(null);
  if (!room?.stalls) return <div className="card">Acara ini tidak punya food court.</div>;
  const bySlot = new Map(room.stalls.map((st, i) => [stallSlot(st, i), st]));
  const free = fair.freeStallSlots(room.id).length;

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Stan food court</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          {STALL_SLOTS.length} tempat stan: 8 di dinding belakang, 4 di sisi kiri, 3 di sisi kanan. {free} kosong. Stan kosong tampil di peta dengan tanda "Sewa stan" dan bisa disewa usaha sendiri seharga {coinText(stallPrice())} (≈ {rupiah(stallPrice())}).
        </p>
        <div className="org-slots">
          {STALL_SLOTS.map((_, slot) => {
            const st = bySlot.get(slot);
            if (!st)
              return (
                <button key={slot} type="button" className="org-slot org-slot-free" onClick={() => setAdding(slot)}>
                  <span className="org-plus">＋</span>
                  <span className="small">Tambah stan</span>
                  <span className="muted small">{sideOf(slot)}</span>
                </button>
              );
            const a = fair.ads.get(`stall:${st.id}`);
            return (
              <div key={st.id} className="org-slot" style={{ ["--c" as string]: st.color }}>
                <span className="cp-logo">{st.emoji}</span>
                <b className="org-slot-name">{st.name}</b>
                <span className="muted small">
                  {sideOf(slot)} · {st.vendor} · {st.deals.length} voucher · {a?.sold ?? 0} terjual
                </span>
                <span className="org-slot-tools">
                  <button
                    type="button"
                    className="small-btn ghost"
                    onClick={() => {
                      if (!confirm(`Lepas stan ${st.name}? Tempatnya jadi kosong dan bisa disewa.`)) return;
                      fair.removeStall(st.id);
                      onToast(`Stan ${st.name} dilepas`);
                    }}
                  >
                    Lepas
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className="small-btn ghost"
            onClick={() => {
              if (!confirm("Kembalikan food court seperti awal? Stan yang ditambah atau disewa akan hilang.")) return;
              fair.resetStalls(room.id);
              onToast("Food court dikembalikan seperti awal");
            }}
          >
            Kembalikan seperti awal
          </button>
        </p>
      </div>
      {adding !== null && (
        <StallForm
          where={sideOf(adding)}
          onClose={() => setAdding(null)}
          onSave={(input) => {
            const st = fair.addStall(adding, input, room.id);
            if (!st) return onToast("Tempat ini sudah terisi");
            setAdding(null);
            onToast(`Stan ${st.name} ditambahkan`);
          }}
        />
      )}
    </div>
  );
}

function StallForm({ where, onClose, onSave }: { where: string; onClose: () => void; onSave: (input: Parameters<typeof fair.addStall>[1]) => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [vendor, setVendor] = useState("");
  const [promo, setPromo] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [deal, setDeal] = useState("");
  const [worth, setWorth] = useState("");
  const [price, setPrice] = useState(8);
  return (
    <form
      className="card bk-form org-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ name, emoji, vendor, promo, color, deal: deal.trim() ? { title: deal, worth, price } : undefined });
      }}
    >
      <h3 className="cp-h3">Stan baru · {where}</h3>
      <label>
        Nama usaha
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus />
      </label>
      <label>
        Ikon (emoji)
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
      </label>
      <label>
        Penjaga stan
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={30} />
      </label>
      <label>
        Promo singkat
        <input value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={80} />
      </label>
      <div className="bk-colors" role="radiogroup" aria-label="Warna">
        <span className="small">Warna</span>
        {COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} data-active={color === c ? "" : undefined} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
      <label>
        Voucher (boleh dikosongkan)
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
      <div className="row">
        <button type="button" className="ghost" onClick={onClose}>
          Batal
        </button>
        <button type="submit">Simpan stan</button>
      </div>
    </form>
  );
}
