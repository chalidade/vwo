import { useState } from "react";
import { type CompanyBooth, coinPrice, koinText, rp } from "@vwo/shared";
import type { CompanyInvoice } from "../jobfair-engine";
import { ACCESSORY_PRODUCTS, type CompanyProduct, PROMOTER_PRODUCT, VIP_PRODUCT } from "../fair/company";
import { CoinBalance, TopUp } from "../fair/TopUp";
import { fair } from "../useFair";
import { LIVE } from "../mode";
import { claimPaidCoins, pay } from "../payments";
import { flushShared } from "../shared-state";

const day = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const when = (at: number) => (at ? new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Awal");

/** A company price in coins, with what it is worth in rupiah underneath. */
function Price({ rupiah }: { rupiah: number }) {
  return (
    <span className="bl-price">
      <b>{koinText(coinPrice(rupiah))}</b>
      {rupiah > 0 && <small>≈ {rp(rupiah)}</small>}
    </span>
  );
}

/** Pay a bill with the coins on this account: the server's ledger on the live site, this browser's in the demo. */
async function payBill(booth: CompanyBooth, inv: CompanyInvoice): Promise<string | null> {
  if (!LIVE) {
    const need = coinPrice(inv.total);
    if (fair.player.coins < need) return `Koin belum cukup: perlu ${koinText(need)}, saldo ${koinText(fair.player.coins)}. Isi koin dulu.`;
    fair.payCoins(need, `Tagihan ${inv.no} · ${booth.company}`);
    fair.payInvoice(booth.id, inv.id, "Koin");
    return null;
  }
  // The bill must be on the server before it can be paid.
  await flushShared();
  const r = await pay({ kind: "invoice", booth: booth.id, invoice: inv.id });
  if (!r.ok) return r.error;
  if ("redirect" in r) return null;
  await claimPaidCoins();
  return null;
}

/** Everything a company buys for its stand, paid with coins, and the coin top-up. */
export function Billing({ booth }: { booth: CompanyBooth }) {
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const invoices = fair.company.get(booth.id)?.invoices ?? [];
  const vip = booth.tier === "premium";
  const pending = new Set(invoices.filter((i) => i.status === "Belum dibayar").flatMap((i) => i.items.map((x) => x.id)));
  const toggle = (id: string) => {
    const next = new Set(cart);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCart(next);
  };
  const items = [VIP_PRODUCT, PROMOTER_PRODUCT, ...ACCESSORY_PRODUCTS].filter((p) => cart.has(p.id));
  const total = items.reduce((n, p) => n + p.price, 0);
  const need = coinPrice(total);
  const open = invoices.filter((i) => i.status === "Belum dibayar");
  const short = Math.max(0, need - fair.player.coins, ...open.map((i) => coinPrice(i.total) - fair.player.coins));

  const run = async (inv: CompanyInvoice) => {
    setBusy(inv.id);
    setMsg(null);
    const err = await payBill(booth, inv);
    setBusy(null);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `${inv.no} lunas. ${inv.items.some((i) => i.id === "vip") ? "Stand kamu sekarang VIP. " : ""}Barang yang dibeli sudah dipasang di stand.` });
  };
  const checkout = async () => {
    if (need > fair.player.coins) return setMsg({ ok: false, text: `Koin belum cukup: kurang ${koinText(need - fair.player.coins)}. Pilih paket isi koin di atas.` });
    const inv = fair.createInvoice(booth.id, [...cart]);
    if (!inv) return;
    setCart(new Set());
    await run(inv);
  };

  const product = (p: CompanyProduct, owned: boolean, extra?: string) =>
    owned ? (
      <span className="cp-saved">{extra ?? "✓ Dimiliki"}</span>
    ) : pending.has(p.id) ? (
      <span className="bl-wait">Menunggu bayar</span>
    ) : (
      <label className="bl-pick" data-on={cart.has(p.id) ? "" : undefined}>
        <input type="checkbox" checked={cart.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Beli ${p.name}`} />
        <Price rupiah={p.price} />
      </label>
    );

  return (
    <div className="bl">
      <section className="card bl-wallet">
        <div className="bl-wallet-head">
          <div>
            <h2 className="cp-h2">Dompet koin perusahaan</h2>
            <p className="muted small">Semua pembelian di job fair dibayar dengan koin: sewa stand, upgrade VIP, promotor, aksesoris, dan stan food court. Isi koin sekali, pakai kapan saja.</p>
          </div>
          <CoinBalance need={short > 0 ? fair.player.coins + short : undefined} />
        </div>
        <TopUp back={`/play/#/jobfair/company/${booth.id}`} need={short} />
        {fair.player.txns.length > 0 && (
          <details className="bl-history">
            <summary>Riwayat koin</summary>
            <ul>
              {fair.player.txns.slice(0, 12).map((t, i) => (
                <li key={i}>
                  <span className="muted">{when(t.at)}</span>
                  <span>{t.reason}</span>
                  <b data-plus={t.amount > 0 ? "" : undefined}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount.toLocaleString("id-ID")}
                  </b>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="bl-grid">
        <div className="bl-main">
          <section className="card bl-vip" data-vip={vip ? "" : undefined}>
            <div className="bl-vip-top">
              <span className="bl-vip-crown">👑</span>
              <div>
                <h2 className="cp-h2">Stand VIP</h2>
                <p className="small muted">{VIP_PRODUCT.about}</p>
              </div>
            </div>
            <ul className="bl-feats">
              <li>Stand lebih lebar, umbul-umbul brand kiri dan kanan</li>
              <li>Gapura di pintu masuk, model dan tulisannya bisa diatur</li>
              <li>Layar video besar untuk video perusahaan</li>
              <li>Lampu sorot, karpet emas, LED berjalan, label 👑</li>
              <li>Prioritas di layar informasi panitia</li>
            </ul>
            <div className="bl-row-end">{product(VIP_PRODUCT, vip, "✓ Stand kamu sudah VIP")}</div>
          </section>

          <section className="card">
            <div className="bl-line">
              <span className="bl-emoji">📣</span>
              <span className="bl-line-main">
                <b>{PROMOTER_PRODUCT.name}</b>
                <span className="small muted">{PROMOTER_PRODUCT.about}</span>
              </span>
              {product(PROMOTER_PRODUCT, fair.owns(booth.id, PROMOTER_PRODUCT.id), "✓ Sedang berkeliling")}
            </div>
          </section>

          <section className="card">
            <h2 className="cp-h2">Aksesoris stand</h2>
            <ul className="bl-acc">
              {ACCESSORY_PRODUCTS.filter((p) => p.price > 0).map((p) => (
                <li key={p.id} className="bl-line">
                  <span className="bl-emoji">{p.emoji}</span>
                  <span className="bl-line-main">
                    <b>{p.name}</b>
                    <span className="small muted">{p.about}</span>
                  </span>
                  {product(p, fair.owns(booth.id, p.id), vip && p.id === "gapura" ? "👑 Termasuk VIP" : undefined)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="bl-side">
          <section className="card bl-cart">
            <h2 className="cp-h2">🛒 Keranjang</h2>
            {items.length === 0 ? (
              <p className="muted small">Centang VIP, promotor, atau aksesoris untuk dibeli dengan koin.</p>
            ) : (
              <>
                <ul className="bl-lines">
                  {items.map((p) => (
                    <li key={p.id}>
                      <span>
                        {p.emoji} {p.name}
                      </span>
                      <span className="bl-num">{koinText(coinPrice(p.price))}</span>
                      <button type="button" className="bl-x" onClick={() => toggle(p.id)} aria-label={`Hapus ${p.name}`}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="bl-total">
                  <span>Total</span>
                  <b>{koinText(need)}</b>
                </div>
                <button type="button" className="bl-pay" disabled={!!busy} onClick={() => void checkout()}>
                  {busy ? "Memproses…" : need > fair.player.coins ? `Koin kurang ${koinText(need - fair.player.coins)}` : `Bayar ${koinText(need)}`}
                </button>
              </>
            )}
            {msg && <p className={msg.ok ? "cp-saved" : "cp-warn"}>{msg.text}</p>}
          </section>

          <section className="card">
            <h2 className="cp-h2">🧾 Riwayat pembelian</h2>
            {invoices.length === 0 ? (
              <p className="muted small">Belum ada pembelian.</p>
            ) : (
              <ul className="bl-invoices">
                {invoices.map((inv) => (
                  <li key={inv.id} data-status={inv.status}>
                    <div className="bl-inv-head">
                      <b>{inv.no}</b>
                      <span className="bl-inv-status">{inv.status === "Lunas" ? `✓ Lunas${inv.method ? ` · ${inv.method}` : ""}` : inv.status}</span>
                    </div>
                    <div className="muted small">
                      {day(inv.at)} · {inv.items.map((i) => i.name).join(", ")}
                    </div>
                    <div className="bl-inv-foot">
                      <b className="bl-num">{koinText(coinPrice(inv.total))}</b>
                      {inv.status === "Belum dibayar" && (
                        <span className="row">
                          <button type="button" className="small-btn ghost" onClick={() => fair.cancelInvoice(booth.id, inv.id)}>
                            Batalkan
                          </button>
                          <button type="button" className="small-btn" disabled={!!busy} onClick={() => void run(inv)}>
                            {busy === inv.id ? "Memproses…" : "Bayar dengan koin"}
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
