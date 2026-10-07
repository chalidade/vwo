import { useState } from "react";
import type { CoinStandView } from "@vwo/shared";
import type { PlayerState } from "../jobfair-engine";
import { APPLY_COST, DAILY_COINS } from "./content";
import { Modal } from "./Modal";

const METHODS = ["QRIS", "GoPay", "OVO", "Transfer bank"];
const when = (at: number) => (at ? new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Awal");

/** The coin wallet: balance, top-up packages (demo payment), vouchers, and history. */
export function WalletPanel({
  player,
  stand,
  atStand,
  canClaim,
  onBuy,
  onClaim,
  onGoToStand,
  onClose,
}: {
  player: PlayerState;
  stand: CoinStandView;
  /** At the coin stand you can buy; elsewhere you are pointed to it. */
  atStand: boolean;
  canClaim: boolean;
  onBuy: (packageId: string, method: string) => void;
  onClaim: () => void;
  onGoToStand: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"buy" | "vouchers" | "history">("buy");
  const [pick, setPick] = useState<string | null>(null);
  const [method, setMethod] = useState(METHODS[0]!);
  const [paid, setPaid] = useState<string | null>(null);
  const pkg = stand.packages.find((p) => p.id === pick);
  const open = player.vouchers.filter((v) => !v.used);

  return (
    <Modal title={<>🪙 Dompet koin · <b className="fx-coins">{player.coins}</b></>} onClose={onClose} className="fx-wallet">
      <div className="mb-tabs fx-tabs">
        {(
          [
            ["buy", "Isi koin"],
            ["vouchers", `🎟️ Voucher (${open.length})`],
            ["history", "Riwayat"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" data-active={tab === id ? "" : undefined} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "buy" && (
        <>
          <p className="sp-summary">
            Koin dipakai untuk melamar ({APPLY_COST} koin per lamaran) dan masuk ruangan premium seperti Ruang Psikotes dan Ruang Seminar.
          </p>
          <div className="fx-daily">
            <span>🎁 Koin gratis harian +{DAILY_COINS}</span>
            <button type="button" className="mb-order" disabled={!canClaim} onClick={onClaim}>
              {canClaim ? "Klaim" : "Sudah diklaim hari ini"}
            </button>
          </div>
          {!atStand ? (
            <div className="fx-callout">
              <span>
                Beli koin di <b>Stand Koin</b>, Lantai 1 dekat pintu masuk.
              </span>
              <button type="button" className="mb-order" onClick={onGoToStand}>
                Antar ke Stand Koin
              </button>
            </div>
          ) : paid ? (
            <div className="fx-callout fx-ok">
              <span>✅ {paid}</span>
              <button type="button" className="mb-order" onClick={() => setPaid(null)}>
                Beli lagi
              </button>
            </div>
          ) : (
            <>
              <div className="fx-packages">
                {stand.packages.map((p) => (
                  <button key={p.id} type="button" className="fx-package" data-active={pick === p.id ? "" : undefined} onClick={() => setPick(p.id)}>
                    <b>{p.coins + p.bonus} 🪙</b>
                    {p.bonus > 0 && <span className="fx-bonus">+{p.bonus} bonus</span>}
                    <span>{p.price}</span>
                  </button>
                ))}
              </div>
              {pkg && (
                <div className="fx-pay">
                  <span>Bayar pakai</span>
                  <div className="fx-methods">
                    {METHODS.map((m) => (
                      <button key={m} type="button" data-active={method === m ? "" : undefined} onClick={() => setMethod(m)}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mb-order jb-apply"
                    onClick={() => {
                      onBuy(pkg.id, method);
                      setPaid(`Pembayaran ${pkg.price} lewat ${method} berhasil. +${pkg.coins + pkg.bonus} koin.`);
                      setPick(null);
                    }}
                  >
                    Bayar {pkg.price}
                  </button>
                  <span className="sp-muted">Demo: tidak ada uang sungguhan yang ditarik.</span>
                </div>
              )}
            </>
          )}
        </>
      )}
      {tab === "vouchers" &&
        (player.vouchers.length === 0 ? (
          <p className="sp-empty">Belum ada voucher. Makan di Food Court (Lantai 4, naik lift) untuk dapat voucher.</p>
        ) : (
          <ul className="fx-vouchers">
            {player.vouchers.map((v) => (
              <li key={v.id} data-used={v.used ? "" : undefined}>
                <span className="fx-ticket">🎟️</span>
                <span>
                  <b>{v.title}</b>
                  <span className="sp-muted">
                    {" "}
                    · dari {v.from}
                    {v.code ? ` · kode ${v.code}` : ""}
                  </span>
                </span>
                <span className="fx-state">{v.used ? "Terpakai" : v.kind === "sponsor" ? "Tunjukkan kode" : "Aktif"}</span>
              </li>
            ))}
          </ul>
        ))}
      {tab === "history" && (
        <ul className="fx-history">
          {player.txns.map((t, i) => (
            <li key={i}>
              <span className="sp-muted">{when(t.at)}</span>
              <span>{t.reason}</span>
              <b data-plus={t.amount > 0 ? "" : undefined}>
                {t.amount > 0 ? "+" : ""}
                {t.amount}
              </b>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
