import { useState } from "react";
import { type FoodStall, safeUrl } from "@vwo/shared";
import type { Voucher } from "../jobfair-engine";
import { Modal } from "./Modal";

type Bought = { deal: FoodStall["deals"][number]; voucher: Voucher; bonus: Voucher };

/** A food court stall: the business promotes its real outlet and sells vouchers for it. */
export function FoodMenu({
  stall,
  coins,
  onBuy,
  onVisit,
  onTopUp,
  onClose,
}: {
  stall: FoodStall;
  coins: number;
  onBuy: (dealId: string) => Bought | null;
  /** The visitor opened the business's website. */
  onVisit: () => void;
  onTopUp: () => void;
  onClose: () => void;
}) {
  const [got, setGot] = useState<Bought | null>(null);
  return (
    <Modal title={`${stall.emoji} ${stall.name}`} onClose={onClose} className="fx-food">
      {got ? (
        <div className="fx-won">
          <p>
            Voucher <b>{got.deal.title}</b> sudah jadi milikmu!
          </p>
          <div className="fx-voucher-card fd-voucher" style={{ ["--c" as string]: stall.color }}>
            <span className="fd-v-brand">
              {stall.emoji} {stall.name}
            </span>
            <b>{got.deal.title}</b>
            <span className="fd-code">{got.voucher.code}</span>
            <span className="sp-muted">Senilai {got.deal.worth} · {got.deal.terms}</span>
            <span className="sp-muted">📍 {stall.address}</span>
          </div>
          <p className="fd-bonus">🎁 Bonus job fair: {got.bonus.title}</p>
          <p className="sp-muted">Tunjukkan kode di outlet. Semua voucher tersimpan di dompet koin.</p>
          <button type="button" className="mb-order jb-apply" onClick={() => setGot(null)}>
            Lihat voucher lain
          </button>
        </div>
      ) : (
        <>
          <div className="fd-hero" style={{ ["--c" as string]: stall.color }}>
            <div className="fd-hero-top">
              <span className="fd-ad">PROMO</span>
              <span className="fx-stars-on">★ {stall.rating.toFixed(1)}</span>
            </div>
            <b className="fd-promo">{stall.promo}</b>
            <span>{stall.about}</span>
          </div>
          <ul className="fd-info">
            <li>📍 {stall.address}</li>
            <li>🕒 {stall.hours}</li>
            <li>
              🌐{" "}
              <a href={safeUrl(stall.website)} target="_blank" rel="noopener noreferrer" onClick={onVisit}>
                {stall.website.replace(/^https?:\/\//, "")}
              </a>
            </li>
          </ul>
          <div className="fd-menu">
            {stall.menu.map((m) => (
              <span key={m.id}>
                {m.emoji} {m.name} <b>{m.price}</b>
              </span>
            ))}
          </div>
          <p className="sp-summary">
            🎟️ Beli voucher pakai koin, pakai di outlet aslinya · Saldo <b>{coins} 🪙</b>
          </p>
          <ul className="fd-deals">
            {stall.deals.map((d) => (
              <li key={d.id}>
                <span className="fd-worth">{d.worth}</span>
                <span>
                  <b>{d.title}</b>
                  <span className="sp-muted"> · {d.terms}</span>
                </span>
                {coins >= d.price ? (
                  <button type="button" className="mb-order" onClick={() => setGot(onBuy(d.id))}>
                    {d.price} 🪙
                  </button>
                ) : (
                  <button type="button" className="mb-order" onClick={onTopUp} title={`Butuh ${d.price} koin`}>
                    Isi koin
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
