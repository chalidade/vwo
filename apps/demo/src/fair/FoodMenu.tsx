import { useState } from "react";
import type { FoodStall } from "@vwo/shared";
import type { Voucher } from "../jobfair-engine";
import { Modal } from "./Modal";

/** Ordering at a food court stall. Every order comes with a voucher. */
export function FoodMenu({
  stall,
  coins,
  onOrder,
  onTopUp,
  onClose,
}: {
  stall: FoodStall;
  coins: number;
  onOrder: (itemId: string) => { item: FoodStall["menu"][number]; voucher: Voucher } | null;
  onTopUp: () => void;
  onClose: () => void;
}) {
  const [got, setGot] = useState<{ item: FoodStall["menu"][number]; voucher: Voucher } | null>(null);
  return (
    <Modal title={`${stall.emoji} ${stall.name}`} onClose={onClose} className="fx-food">
      {got ? (
        <div className="fx-won">
          <div className="fx-won-food">{got.item.emoji}</div>
          <p>
            <b>{got.item.name}</b> siap! Selamat makan.
          </p>
          <div className="fx-voucher-card">
            <span>🎟️ Voucher kamu</span>
            <b>{got.voucher.title}</b>
            {got.voucher.code && <span>Kode: {got.voucher.code}</span>}
          </div>
          <p className="sp-muted">Duduk di meja yang kosong untuk makan. Voucher tersimpan di dompet koin.</p>
          <button type="button" className="mb-order jb-apply" onClick={() => setGot(null)}>
            Pesan lagi
          </button>
        </div>
      ) : (
        <>
          <p className="sp-summary">
            {stall.vendor}: "Mau pesan apa? Tiap pesanan dapat voucher!" · Saldo <b>{coins} 🪙</b>
          </p>
          <div className="mb-grid">
            {stall.menu.map((m) => (
              <div key={m.id} className="mb-item">
                <div className="mb-art fx-emoji">{m.emoji}</div>
                <div className="mb-name">{m.name}</div>
                <div className="mb-foot">
                  <span className="mb-price">{m.price} 🪙</span>
                  {coins >= m.price ? (
                    <button type="button" className="mb-order" onClick={() => setGot(onOrder(m.id))}>
                      Pesan
                    </button>
                  ) : (
                    <button type="button" className="mb-order" onClick={onTopUp}>
                      Isi koin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
