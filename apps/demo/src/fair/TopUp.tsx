import { useState } from "react";
import { BUSINESS_PACKAGES, koinText, price, rp } from "@vwo/shared";
import { LIVE } from "../mode";
import { pay } from "../payments";
import { fair } from "../useFair";

/**
 * Coin top-up for companies and food court businesses: everything they buy is paid in coins, and
 * coins are bought here (through Xendit on the live site, a demo payment offline).
 */
export function TopUp({ back, need = 0, compact }: { back: string; /** Coins still missing for what is being bought. */ need?: number; compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const packs = BUSINESS_PACKAGES.map((p) => ({ ...p, total: p.coins + p.bonus, price: price(`pack.${p.id}`) }));
  // The smallest package that covers what is missing gets the highlight.
  const best = need > 0 ? (packs.find((p) => p.total >= need) ?? packs[packs.length - 1]) : undefined;

  const buy = async (id: string) => {
    setBusy(id);
    setError("");
    setDone("");
    if (!LIVE) {
      const got = fair.buyCoins(id, "Demo");
      setBusy(null);
      if (got) setDone(`+${koinText(got)} masuk ke saldo.`);
      return;
    }
    const r = await pay({ kind: "coins", pack: id, back });
    if (r.ok && "redirect" in r) return;
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setDone("Koin sudah masuk ke saldo.");
  };

  return (
    <div className="tu" data-compact={compact ? "" : undefined}>
      <div className="tu-packs">
        {packs.map((p) => (
          <button key={p.id} type="button" className="tu-pack" data-best={best?.id === p.id ? "" : undefined} disabled={!!busy} onClick={() => void buy(p.id)}>
            {best?.id === p.id && <span className="tu-tag">Pas untuk ini</span>}
            <span className="tu-coins">🪙 {p.total.toLocaleString("id-ID")}</span>
            {p.bonus > 0 ? <span className="tu-bonus">termasuk bonus {p.bonus.toLocaleString("id-ID")}</span> : <span className="tu-bonus tu-none">tanpa bonus</span>}
            <span className="tu-price">{busy === p.id ? "Memproses…" : rp(p.price)}</span>
          </button>
        ))}
      </div>
      {error && <p className="cp-warn">{error}</p>}
      {done && <p className="cp-saved">✓ {done}</p>}
      <p className="muted small tu-note">
        {LIVE ? "Bayar lewat Xendit: QRIS, virtual account, e-wallet atau kartu. Koin masuk otomatis setelah pembayaran diterima." : "Demo: tidak ada uang sungguhan yang ditarik, koin langsung masuk."}
      </p>
    </div>
  );
}

/** The account's coin balance, for the pages where companies pay. */
export function CoinBalance({ need }: { need?: number }) {
  const have = fair.player.coins;
  const short = need !== undefined && need > have;
  return (
    <div className="tu-balance" data-short={short ? "" : undefined}>
      <span className="muted small">Saldo koin</span>
      <b>🪙 {have.toLocaleString("id-ID")}</b>
      {need !== undefined && <span className="small">{short ? `Kurang ${koinText(need - have)}` : `Cukup untuk ${koinText(need)}`}</span>}
    </div>
  );
}
