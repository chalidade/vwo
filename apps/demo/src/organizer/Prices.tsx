import { useState } from "react";
import { ALL_COIN_PACKAGES, coinsFor, PRICE_CATALOG, PRICE_GROUPS, type Prices, price, priceTable } from "@vwo/shared";
import { rupiah } from "../fair/company";
import { savePrices } from "../prices-sync";
import { useFair } from "../useFair";

const show = (unit: string, n: number) => (unit === "koin" ? `${n} 🪙` : rupiah(n));

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
        <h2 className="cp-h2">💰 Daftar harga</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Semua harga di job fair dalam satu tabel. Pembeli selalu membayar dengan koin. Harga perusahaan ditulis dalam rupiah lalu dibayar dengan koin senilai "Nilai 1 koin"; koin sendiri dibeli lewat paket koin (Xendit). Ubah angkanya lalu simpan: harga baru langsung berlaku untuk semua pengunjung. Tagihan yang sudah dibuat tetap memakai harga lama. Tiket lantai dan ruangan diatur di tab 🏢 Lantai, harga voucher makan di tab 🍜 Food Court.
        </p>
        {PRICE_GROUPS.map((group) => (
          <section key={group} className="pr-group">
            <h3 className="cp-h3">{group}</h3>
            <div className="org-scroll">
              <table className="list pr-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Satuan</th>
                    <th>Bawaan</th>
                    <th>Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICE_CATALOG.filter((p) => p.group === group).map((p) => {
                    const v = value(p.key);
                    const pack = ALL_COIN_PACKAGES.find((c) => `pack.${c.id}` === p.key);
                    return (
                      <tr key={p.key} data-changed={draft[p.key] !== undefined && draft[p.key] !== price(p.key) ? "" : undefined}>
                        <td>
                          {p.label}
                          {p.note && <span className="muted small"> · {p.note}</span>}
                          {pack && v > 0 && <span className="muted small"> · ≈ {rupiah(Math.round(v / (pack.coins + pack.bonus)))} per koin</span>}
                          {COMPANY.has(group) && v > 0 && <span className="pr-koin"> = {coinsFor(table, v).toLocaleString("id-ID")} 🪙</span>}
                        </td>
                        <td className="muted small">{p.unit === "koin" ? "koin" : "Rp"}</td>
                        <td className="muted small">{show(p.unit, p.default)}</td>
                        <td>
                          <input
                            className="pr-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={p.max}
                            step={p.unit === "koin" ? 1 : 1000}
                            value={v}
                            aria-label={`Harga ${p.label}`}
                            onChange={(e) => {
                              setError("");
                              setDraft((d) => ({ ...d, [p.key]: Math.max(0, Math.min(p.max, Math.round(Number(e.target.value) || 0))) }));
                            }}
                          />
                          {v !== p.default && (
                            <button type="button" className="cp-linkbtn small" onClick={() => setDraft((d) => ({ ...d, [p.key]: p.default }))}>
                              bawaan
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {error && <p className="bk-err">{error}</p>}
        <div className="row pr-save">
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
            {busy ? "Menyimpan…" : changed.length ? `Simpan ${changed.length} perubahan` : "Belum ada perubahan"}
          </button>
          {changed.length > 0 && (
            <button type="button" className="ghost" onClick={() => setDraft({})}>
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
