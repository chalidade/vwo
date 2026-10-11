import { useEffect, useState } from "react";
import { DEFAULT_PPN, type InvoiceStatus, rp, type SellerInfo } from "@vwo/shared";
import {
  cancelInvoice,
  confirmPaid,
  dateText,
  fileUrl,
  type InvoiceView,
  METHOD_NAMES,
  orgInvoices,
  readPdf,
  readSellerSettings,
  recordTaxInvoice,
  saveSellerSettings,
  STATUS_NAMES,
} from "../invoices";
import { LIVE } from "../mode";

/** The organiser as seller on every invoice: name, NPWP, PKP and PPN, and the bank account buyers transfer to. */
function SellerSettings({ onToast }: { onToast: (t: string) => void }) {
  const [f, setF] = useState<SellerInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => void readSellerSettings().then((r) => (r.ok ? setF(r.data.seller) : (setError(r.error), setF(null)))), []);
  if (error && !f) return <p className="cp-warn">{error} Pengaturan penjual dan konfirmasi pembayaran khusus admin utama acara.</p>;
  if (!f) return <p className="muted small">Memuat…</p>;
  const text = (k: "name" | "address" | "npwp" | "email" | "phone", label: string, props: Record<string, unknown> = {}) => (
    <label className={k === "address" ? "cp-span" : undefined}>
      {label}
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  );
  const bank = (k: keyof SellerInfo["bank"], label: string, props: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input value={f.bank[k]} onChange={(e) => setF({ ...f, bank: { ...f.bank, [k]: e.target.value } })} {...props} />
    </label>
  );
  return (
    <form
      className="cp-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveSellerSettings(f);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setError("");
        setF(r.data.seller);
        onToast("Data penjual disimpan");
      }}
    >
      {text("name", "Nama penjual (badan usaha)", { maxLength: 120 })}
      {text("npwp", "NPWP", { maxLength: 24, inputMode: "numeric", placeholder: "15 atau 16 digit" })}
      {text("address", "Alamat", { maxLength: 300 })}
      {text("email", "Email", { type: "email", maxLength: 160 })}
      {text("phone", "Telepon", { maxLength: 40 })}
      <label className="cp-check cp-span">
        <input type="checkbox" checked={f.pkp} onChange={(e) => setF({ ...f, pkp: e.target.checked })} /> Sudah PKP (invoice menampilkan DPP dan PPN, faktur pajak bisa dicatat)
      </label>
      <label>
        Tarif PPN (%)
        <input type="number" min={0} max={50} step={0.01} value={f.ppnRate} disabled={!f.pkp} onChange={(e) => setF({ ...f, ppnRate: Number(e.target.value) || DEFAULT_PPN })} />
      </label>
      <span />
      {bank("name", "Bank", { maxLength: 60, placeholder: "BCA" })}
      {bank("account", "No. rekening", { maxLength: 40, inputMode: "numeric" })}
      {bank("holder", "Atas nama", { maxLength: 120 })}
      <div className="cp-span row inv-actions">
        <button type="submit" className="small-btn" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        {error && <span className="cp-warn">{error}</span>}
      </div>
      <p className="cp-span muted small">
        Harga paket koin dianggap sudah termasuk PPN: saat PKP, invoice memisahkan DPP dan PPN dari harga itu. Data ini hanya terlihat di invoice pembeli, tidak di data acara
        publik. Invoice yang sudah terbit tidak berubah.
      </p>
    </form>
  );
}

/** One invoice for the organiser: confirm transfers, record the faktur pajak, or cancel. */
function OrgInvoiceRow({ inv, onDone }: { inv: InvoiceView; onDone: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tax, setTax] = useState(inv.taxInvoiceNo ?? "");
  const [pdf, setPdf] = useState<{ name: string; data: string } | null>(null);
  const next = inv.instalments.findIndex((p) => !p.paidAt);
  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) => {
    setBusy(true);
    setError("");
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone(done);
  };
  return (
    <li className="inv-row" data-status={inv.status}>
      <div className="inv-row-head">
        <b>{inv.number}</b>
        <span className="inv-badge" data-status={inv.status}>
          {STATUS_NAMES[inv.status]}
        </span>
      </div>
      <div className="small">
        <b>{inv.buyer.name}</b> · {inv.buyer.email}
        {inv.boothKey && <span className="muted"> · stand {inv.boothKey}</span>}
      </div>
      <div className="muted small">
        {dateText(inv.createdAt)} · {METHOD_NAMES[inv.method]} · {inv.items.map((i) => i.name).join(", ")} · <b>{rp(inv.total)}</b>
      </div>
      {inv.method !== "gateway" && (
        <ul className="inv-plan">
          {inv.instalments.map((p, i) => (
            <li key={i}>
              <span>{inv.method === "termin" ? `Termin ${i + 1}` : "Transfer"}</span>
              <span className="muted">{p.paidAt ? `diterima ${dateText(p.paidAt)}` : `jatuh tempo ${dateText(p.dueAt)}`}</span>
              <b>{rp(p.amount)}</b>
            </li>
          ))}
        </ul>
      )}
      {inv.proofs.length > 0 && (
        <div className="small">
          Bukti:{" "}
          {inv.proofs.map((p, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {p.ref} ({dateText(p.at)})
              {p.file && (
                <>
                  {" "}
                  <a href={fileUrl(inv.id, p.file)}>foto</a>
                </>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="row inv-actions">
        {inv.status === "issued" && next >= 0 && (
          <button
            type="button"
            className="small-btn"
            disabled={busy}
            onClick={() => {
              const p = inv.instalments[next]!;
              const last = next === inv.instalments.length - 1;
              if (
                !confirm(
                  `Dana ${rp(p.amount)} untuk ${inv.number} sudah masuk ke rekening?${last && inv.coins ? ` ${inv.coins.toLocaleString("id-ID")} koin langsung masuk ke akun pembeli.` : ""}`,
                )
              )
                return;
              void run(() => confirmPaid(inv.id, next), last ? `${inv.number} lunas` : `Termin ${next + 1} ${inv.number} dikonfirmasi`);
            }}
          >
            ✓ Konfirmasi {inv.method === "termin" ? `termin ${next + 1}` : "transfer"} diterima
          </button>
        )}
        {inv.status === "issued" && inv.instalments.every((p) => !p.paidAt) && inv.method !== "gateway" && (
          <button
            type="button"
            className="small-btn ghost"
            disabled={busy}
            onClick={() => {
              const note = prompt(`Alasan membatalkan ${inv.number}:`, "Tidak dibayar sampai jatuh tempo");
              if (note === null) return;
              void run(() => cancelInvoice(inv.id, note.trim()), `${inv.number} dibatalkan`);
            }}
          >
            Batalkan
          </button>
        )}
        <a className="small-btn ghost cp-link" href={`#/jobfair/invoice/${inv.id}`}>
          Lihat
        </a>
      </div>
      {inv.rate > 0 && inv.status !== "void" && (
        <form
          className="row inv-actions"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => recordTaxInvoice(inv.id, tax.trim(), pdf ?? undefined), `Faktur pajak ${inv.number} dicatat`);
          }}
        >
          <input
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            minLength={8}
            maxLength={40}
            placeholder="No. faktur pajak"
            aria-label={`Nomor faktur pajak ${inv.number}`}
            required
          />
          <label className="small-btn ghost inv-file">
            {pdf ? pdf.name : inv.taxFile ? "Ganti PDF" : "PDF faktur (opsional)"}
            <input
              type="file"
              accept="application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setPdf({ name: file.name, data: await readPdf(file) });
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </label>
          <button type="submit" className="small-btn ghost" disabled={busy}>
            Simpan faktur
          </button>
          {inv.taxFile && <a href={fileUrl(inv.id, "faktur")}>unduh</a>}
        </form>
      )}
      {error && <p className="bk-err">{error}</p>}
    </li>
  );
}

const FILTERS: [InvoiceStatus | "all", string][] = [
  ["issued", "Belum dibayar"],
  ["paid", "Lunas"],
  ["void", "Dibatalkan"],
  ["all", "Semua"],
];

/** Invoices and tax: the seller's details, and confirming bank transfers and termin payments. */
export function OrgInvoices({ onToast }: { onToast: (t: string) => void }) {
  const [filter, setFilter] = useState<InvoiceStatus | "all">("issued");
  const [list, setList] = useState<InvoiceView[] | null>(null);
  const [error, setError] = useState("");
  const load = () => void orgInvoices(filter === "all" ? undefined : filter).then((r) => (r.ok ? (setList(r.data.invoices), setError("")) : setError(r.error)));
  useEffect(load, [filter]);

  if (!LIVE)
    return (
      <div className="org">
        <p className="card cp-server-note">Invoice, transfer bank dan termin hanya ada di versi live.</p>
      </div>
    );
  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Data penjual di invoice</h2>
        <SellerSettings onToast={onToast} />
      </div>
      <div className="card">
        <h2 className="cp-h2">Invoice & pembayaran transfer</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Cek mutasi rekening, lalu konfirmasi transfer atau termin yang sudah masuk. Konfirmasi terakhir membuat invoice lunas dan koin langsung masuk ke akun pembeli, sekali
          saja.
        </p>
        <div className="row inv-actions">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? "small-btn" : "small-btn ghost"} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        {error && <p className="bk-err">{error}</p>}
        {!list && !error && <p className="muted small">Memuat…</p>}
        {list && list.length === 0 && <p className="muted small">Tidak ada invoice.</p>}
        {list && (
          <ul className="inv-list">
            {list.map((inv) => (
              <OrgInvoiceRow key={inv.id} inv={inv} onDone={(t) => (onToast(t), load())} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
