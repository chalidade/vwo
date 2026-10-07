import { VERIFY_COST } from "./content";
import { Modal } from "./Modal";

/** Buy the blue check with coins: it shows by your name for everyone, and on your applications. */
export function VerifyPanel({ name, coins, verified, onBuy, onTopUp, onClose }: { name: string; coins: number; verified: boolean; onBuy: () => void; onTopUp: () => void; onClose: () => void }) {
  return (
    <Modal title="Akun terverifikasi" onClose={onClose} className="fx-verify">
      <div className="vf-hero">
        <span className="vf-name">
          {name}
          <span className="rpg-check vf-check">✔</span>
        </span>
        <span className="sp-muted">{verified ? "Akunmu sudah terverifikasi." : "Begini namamu nanti terlihat di job fair."}</span>
      </div>
      <ul className="vf-perks">
        <li>✔ Centang biru di samping namamu, terlihat oleh semua pengunjung, juga dari device lain.</li>
        <li>📋 Lamaranmu ditandai <b>Verified</b> di daftar pelamar recruiter, jadi lebih menonjol.</li>
        <li>🤝 Pelamar lain lebih percaya saat kamu menyapa.</li>
      </ul>
      {verified ? (
        <button type="button" className="mb-order jb-apply" onClick={onClose}>
          Mantap 👍
        </button>
      ) : coins >= VERIFY_COST ? (
        <button type="button" className="mb-order jb-apply vf-buy" onClick={onBuy}>
          Beli centang biru · {VERIFY_COST} 🪙
        </button>
      ) : (
        <div className="fx-callout">
          <span>
            Butuh <b>{VERIFY_COST} 🪙</b>, saldomu {coins} 🪙.
          </span>
          <button type="button" className="mb-order" onClick={onTopUp}>
            Isi koin
          </button>
        </div>
      )}
      <p className="sp-muted">Demo: dibayar pakai koin permainan, bukan uang sungguhan. Berlaku untuk semua acara di aplikasi ini.</p>
    </Modal>
  );
}
