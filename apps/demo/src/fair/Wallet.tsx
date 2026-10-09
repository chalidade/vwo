import { useEffect, useState } from "react";
import type { CoinStandView } from "@vwo/shared";
import type { PlayerState } from "../jobfair-engine";
import { price } from "@vwo/shared";
import { streakBonus } from "./content";
import { Modal } from "./Modal";
import { type Gateway, paymentGateway } from "../payments";

const METHODS = ["QRIS", "GoPay", "OVO", "Transfer bank"];
const when = (at: number) => (at ? new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Awal");

/** What a top-up did: done (with a message), failed, or the browser is going to the checkout page. */
export type BuyResult = { ok: boolean; text: string } | "redirect";

/** The coin wallet: balance, top-up packages (paid through the gateway on the live site), vouchers, and history. */
export function WalletPanel({
  player,
  stand,
  atStand,
  canClaim,
  onBuy,
  live,
  onClaim,
  onGoToStand,
  onClose,
}: {
  player: PlayerState;
  stand: CoinStandView;
  /** At the coin stand you can buy; elsewhere you are pointed to it. */
  atStand: boolean;
  canClaim: boolean;
  onBuy: (packageId: string, method: string) => BuyResult | Promise<BuyResult>;
  /** Live site: pay through the server's gateway instead of the offline demo. */
  live?: boolean;
  onClaim: () => void;
  onGoToStand: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"buy" | "vouchers" | "history">("buy");
  const [pick, setPick] = useState<string | null>(null);
  const [method, setMethod] = useState(METHODS[0]!);
  const [paid, setPaid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateway, setGateway] = useState<Gateway | "local">(live ? "xendit" : "local");
  useEffect(() => {
    if (live) void paymentGateway().then(setGateway);
  }, [live]);
  const viaXendit = gateway === "xendit";
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
            Koin dipakai untuk melamar ({price("coin.apply")} koin per lamaran) dan masuk ruangan premium seperti Ruang Psikotes dan Ruang Seminar.
          </p>
          <div className="fx-daily">
            <span>
              🎁 Koin gratis harian +{price("coin.daily") + streakBonus((player.streak ?? 0) + 1)}
              {player.streak ? <span className="sp-muted"> · 🔥 {player.streak} hari beruntun</span> : null}
            </span>
            <button type="button" className="mb-order" disabled={!canClaim} onClick={onClaim}>
              {canClaim ? "Klaim" : "Sudah diklaim hari ini"}
            </button>
          </div>
          {!atStand ? (
            <div className="fx-callout">
              <span>
                Beli koin di <b>Stand Koin</b>, Lantai 2.
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
                  {viaXendit ? (
                    <span>Bayar lewat Xendit: QRIS, e-wallet, virtual account atau kartu. Kamu akan dibawa ke halaman pembayaran yang aman.</span>
                  ) : (
                    <>
                      <span>Bayar pakai</span>
                      <div className="fx-methods">
                        {METHODS.map((m) => (
                          <button key={m} type="button" data-active={method === m ? "" : undefined} onClick={() => setMethod(m)}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    className="mb-order jb-apply"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      const r = await onBuy(pkg.id, method);
                      if (r === "redirect") return;
                      setBusy(false);
                      if (!r.ok) return setError(r.text);
                      setPaid(r.text);
                      setPick(null);
                    }}
                  >
                    {busy ? "Memproses…" : `Bayar ${pkg.price}`}
                  </button>
                  {error && <span className="fx-error">{error}</span>}
                  {!viaXendit && <span className="sp-muted">Demo: tidak ada uang sungguhan yang ditarik.</span>}
                </div>
              )}
            </>
          )}
        </>
      )}
      {tab === "vouchers" &&
        (player.vouchers.length === 0 ? (
          <p className="sp-empty">Belum ada voucher. Beli voucher cafe dan tempat makan di Food Court (Lantai 8, naik lift), tiap pembelian juga dapat bonus job fair.</p>
        ) : (
          <ul className="fx-vouchers">
            {player.vouchers.map((v) => (
              <li key={v.id} data-used={v.used ? "" : undefined}>
                <span className="fx-ticket">{v.kind === "merchant" ? "🍽️" : "🎟️"}</span>
                <span>
                  <b>{v.title}</b>
                  <span className="sp-muted">
                    {" "}
                    · {v.outlet ?? `dari ${v.from}`}
                    {v.worth ? ` · senilai ${v.worth}` : ""}
                  </span>
                  {v.code && <span className="fx-code">{v.code}</span>}
                </span>
                <span className="fx-state">{v.used ? "Terpakai" : v.kind === "sponsor" || v.kind === "merchant" ? "Tunjukkan kode" : "Aktif"}</span>
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
