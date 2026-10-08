import { useState } from "react";
import type { CompanyBooth } from "@vwo/shared";
import type { CompanyInvoice } from "../jobfair-engine";
import { ACCESSORY_PRODUCTS, PAY_METHODS, PROMOTER_PRODUCT, VIP_PRODUCT, rupiah } from "../fair/company";
import { fair } from "../useFair";

const day = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Pay for the VIP booth and decorations. Demo payments only: nothing is charged. */
export function Billing({ booth }: { booth: CompanyBooth }) {
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<CompanyInvoice | null>(null);
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
  const checkout = () => {
    const inv = fair.createInvoice(booth.id, [...cart]);
    setCart(new Set());
    if (inv) setPaying(inv);
  };

  return (
    <div className="cp-grid">
      <div className="card cp-vip-card" data-vip={vip ? "" : undefined}>
        <div className="cp-vip-crown">👑</div>
        <h2 className="cp-h2">Stand VIP</h2>
        <p>{VIP_PRODUCT.about}</p>
        <ul className="cp-ul">
          <li>Lampu sorot bergerak dan bingkai lampu emas</li>
          <li>LED berjalan dengan teks promosimu sendiri</li>
          <li>Karpet emas berkilau dan label 👑 di daftar stand</li>
          <li>Prioritas di layar informasi panitia</li>
        </ul>
        {vip ? (
          <p className="cp-saved">✓ Stand kamu sudah VIP</p>
        ) : pending.has("vip") ? (
          <p className="muted">Menunggu pembayaran tagihan di bawah.</p>
        ) : (
          <label className="cp-check">
            <input type="checkbox" checked={cart.has("vip")} onChange={() => toggle("vip")} />
            <b>{rupiah(VIP_PRODUCT.price)}</b> / acara
          </label>
        )}
      </div>
      <div className="card">
        <h2 className="cp-h2">📣 {PROMOTER_PRODUCT.name}</h2>
        <p className="small" style={{ marginTop: 0 }}>
          {PROMOTER_PRODUCT.about}
        </p>
        {fair.owns(booth.id, PROMOTER_PRODUCT.id) ? (
          <p className="cp-saved">✓ Promotor kamu sedang berkeliling. Atur sapaannya di tab Booth.</p>
        ) : pending.has(PROMOTER_PRODUCT.id) ? (
          <p className="muted">Menunggu pembayaran tagihan di bawah.</p>
        ) : (
          <label className="cp-check">
            <input type="checkbox" checked={cart.has(PROMOTER_PRODUCT.id)} onChange={() => toggle(PROMOTER_PRODUCT.id)} />
            <b>{rupiah(PROMOTER_PRODUCT.price)}</b> / acara
          </label>
        )}
      </div>
      <div className="card">
        <h2 className="cp-h2">Aksesoris berbayar</h2>
        <ul className="cp-acc">
          {ACCESSORY_PRODUCTS.filter((p) => p.price > 0).map((p) => {
            const owned = fair.owns(booth.id, p.id);
            return (
              <li key={p.id}>
                <span className="cp-acc-emoji">{p.emoji}</span>
                <span className="cp-acc-main">
                  <b>{p.name}</b>
                  <span className="muted small">{rupiah(p.price)}</span>
                </span>
                {owned ? (
                  <span className="cp-saved">Dimiliki</span>
                ) : pending.has(p.id) ? (
                  <span className="muted small">Menunggu bayar</span>
                ) : (
                  <input type="checkbox" checked={cart.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Beli ${p.name}`} />
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card cp-cart">
        <h2 className="cp-h2">Keranjang</h2>
        {items.length === 0 ? (
          <p className="muted small">Centang VIP atau aksesoris untuk dibeli.</p>
        ) : (
          <>
            <table className="list cp-table">
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.emoji} {p.name}
                    </td>
                    <td className="cp-num">{rupiah(p.price)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>Total</b>
                  </td>
                  <td className="cp-num">
                    <b>{rupiah(total)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="button" onClick={checkout}>
              Buat tagihan
            </button>
          </>
        )}
        <h2 className="cp-h2">Tagihan</h2>
        {invoices.length === 0 ? (
          <p className="muted small">Belum ada tagihan.</p>
        ) : (
          <ul className="cp-invoices">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <span>
                  <b>{inv.no}</b>
                  <span className="muted small">
                    {day(inv.at)} · {inv.items.map((i) => i.name).join(", ")}
                  </span>
                </span>
                <span className="cp-num">{rupiah(inv.total)}</span>
                {inv.status === "Belum dibayar" ? (
                  <span className="row">
                    <button type="button" className="small-btn" onClick={() => setPaying(inv)}>
                      Bayar
                    </button>
                    <button type="button" className="small-btn ghost" onClick={() => fair.cancelInvoice(booth.id, inv.id)}>
                      Batal
                    </button>
                  </span>
                ) : (
                  <span className="status" data-status={inv.status === "Lunas" ? "Diterima" : "Belum cocok"}>
                    {inv.status}
                    {inv.method ? ` · ${inv.method}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {paying && <PayDialog booth={booth} invoice={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PayDialog({ booth, invoice, onClose }: { booth: CompanyBooth; invoice: CompanyInvoice; onClose: () => void }) {
  const [method, setMethod] = useState<string>(PAY_METHODS[0]);
  const [done, setDone] = useState(false);
  const va = `8808${(invoice.total % 1e8).toString().padStart(8, "0")}`;
  return (
    <div className="cp-modal" onClick={onClose}>
      <div className="card cp-pay" role="dialog" aria-label="Pembayaran" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2 className="cp-h2">✅ Pembayaran berhasil</h2>
            <p>
              {invoice.no} lunas. {invoice.items.some((i) => i.id === "vip") ? "Stand kamu sekarang VIP. " : ""}Aksesoris yang dibeli sudah dipasang di stand.
            </p>
            <button type="button" onClick={onClose}>
              Selesai
            </button>
          </>
        ) : (
          <>
            <h2 className="cp-h2">Bayar {invoice.no}</h2>
            <p className="muted small">
              Ditagihkan ke {booth.company} · Total <b>{rupiah(invoice.total)}</b>
            </p>
            <div className="cp-methods">
              {PAY_METHODS.map((m) => (
                <label key={m} className="cp-method" data-active={method === m ? "" : undefined}>
                  <input type="radio" name="pay" checked={method === m} onChange={() => setMethod(m)} />
                  {m}
                </label>
              ))}
            </div>
            <div className="cp-pay-box">
              {method === "QRIS" ? (
                <div className="cp-qr" aria-label="Kode QR contoh">
                  {Array.from({ length: 49 }, (_, i) => (
                    <span key={i} data-on={(i * 7 + invoice.total) % 3 === 0 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(i) ? "" : undefined} />
                  ))}
                </div>
              ) : method.startsWith("Virtual") ? (
                <p>
                  Nomor VA: <b className="cp-mono">{va}</b>
                </p>
              ) : method === "Kartu kredit" ? (
                <p className="muted small">Form kartu muncul di sini pada versi asli (lewat payment gateway).</p>
              ) : (
                <p>
                  Transfer ke rekening panitia <b className="cp-mono">123-456-7890</b> a.n. Panitia Job Fair
                </p>
              )}
            </div>
            <p className="cp-warn">Ini demo: tidak ada uang yang ditarik. Tombol di bawah langsung menandai tagihan lunas.</p>
            <div className="row">
              <button
                type="button"
                onClick={() => {
                  if (fair.payInvoice(booth.id, invoice.id, method)) setDone(true);
                }}
              >
                Saya sudah bayar (demo)
              </button>
              <button type="button" className="ghost" onClick={onClose}>
                Nanti
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
