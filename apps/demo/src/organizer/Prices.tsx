import { useState } from "react";
import { ALL_COIN_PACKAGES, coinsFor, PRICE_CATALOG, PRICE_GROUPS, type Prices, price, priceTable } from "@vwo/shared";
import { rupiah } from "../fair/company";
import { savePrices } from "../prices-sync";
import { useFair } from "../useFair";

const show = (unit: string, n: number) => (unit === "koin" ? `${n} koin` : rupiah(n));

/** The organiser's price list: every price in the event in one table, changed and saved together. */
export function OrgPrices({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const [draft, setDraft] = useState<Prices>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = (key: string) => draft[key] ?? price(key);
  const changed = Object.keys(draft).filter((k) => draft[k] !== price(k));
  // Company prices in coins, at the coin value being edited.
  const table = { ...priceTable(), ...draft };
  const COMPANY = new Set(["Sewa stand", "Upgrade & paket VIP", "Printilan booth"]);

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Daftar harga</h2>
        <ul className="pr-help muted small">
          <li>Pengunjung dan perusahaan selalu membayar dengan koin. Koin dibeli lewat paket koin (Xendit).</li>
          <li>Harga perusahaan ditulis dalam rupiah, lalu dibayar dengan koin senilai "Nilai 1 koin".</li>
          <li>Harga baru langsung berlaku setelah disimpan. Tagihan yang sudah dibuat tetap memakai harga lama.</li>
          <li>Tiket lantai diatur di tab Lantai, harga voucher makan di tab Food Court.</li>
        </ul>
        {PRICE_GROUPS.map((group) => (
          <section key={group} className="pr-group">
            <h3 className="cp-h3">{group}</h3>
            <ul className="pr-list">
              {PRICE_CATALOG.filter((p) => p.group === group).map((p) => {
                const v = value(p.key);
                const pack = ALL_COIN_PACKAGES.find((c) => `pack.${c.id}` === p.key);
                return (
                  <li key={p.key} className="pr-row" data-changed={draft[p.key] !== undefined && draft[p.key] !== price(p.key) ? "" : undefined}>
                    <div className="pr-main">
                      <b>{p.label}</b>
                      <span className="pr-meta">
                        <span>Bawaan {show(p.unit, p.default)}</span>
                        {p.note && <span>{p.note}</span>}
                        {pack && v > 0 && <span>≈ {rupiah(Math.round(v / (pack.coins + pack.bonus)))} per koin</span>}
                        {COMPANY.has(group) && v > 0 && <span className="pr-koin">= {coinsFor(table, v).toLocaleString("id-ID")} koin</span>}
                      </span>
                    </div>
                    <div className="pr-edit">
                      <label className="pr-field">
                        <span className="pr-unit">{p.unit === "koin" ? "Koin" : "Rp"}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={v.toLocaleString("id-ID")}
                          aria-label={`Harga ${p.label}`}
                          onChange={(e) => {
                            setError("");
                            const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setDraft((d) => ({ ...d, [p.key]: Math.min(p.max, n) }));
                          }}
                        />
                      </label>
                      {v !== p.default && (
                        <button type="button" className="cp-linkbtn small" onClick={() => setDraft((d) => ({ ...d, [p.key]: p.default }))}>
                          Pakai bawaan
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {error && <p className="bk-err">{error}</p>}
        <div className="pr-save" data-dirty={changed.length ? "" : undefined}>
          <span className="small muted">{changed.length ? `${changed.length} harga diubah, belum disimpan` : "Semua harga tersimpan"}</span>
          {changed.length > 0 && (
            <button type="button" className="ghost" onClick={() => setDraft({})}>
              Batal
            </button>
          )}
          <button
            type="button"
            disabled={!changed.length || busy}
            onClick={async () => {
              setBusy(true);
              const err = await savePrices(Object.fromEntries(changed.map((k) => [k, draft[k]!])));
              setBusy(false);
              if (err) return setError(err);
              setDraft({});
              onToast(`${changed.length} harga disimpan`);
            }}
          >
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
