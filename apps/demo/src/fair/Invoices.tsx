import { ArrowLeft, Download, FileText, Landmark, Printer, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { BUSINESS_PACKAGES, type BuyerInfo, EMPTY_BUYER, instalmentPlan, npwpText, price, rp } from "@vwo/shared";
import { readImageFile } from "../imageFile";
import {
  cancelInvoice,
  dateText,
  fileUrl,
  type InvoiceView,
  METHOD_NAMES,
  myInvoices,
  oneInvoice,
  orderByTransfer,
  type PublicSeller,
  saveBuyer,
  sendProof,
  STATUS_NAMES,
} from "../invoices";
import { LIVE } from "../mode";

const n = (x: number) => x.toLocaleString("id-ID");

/** Who invoices are made out to. Entered once; every later invoice uses it. */
export function BuyerForm({ buyer, onSaved }: { buyer: BuyerInfo | null; onSaved: (b: BuyerInfo) => void }) {
  const [f, setF] = useState<BuyerInfo>(buyer ?? EMPTY_BUYER);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const field = (k: keyof BuyerInfo, label: string, props: Record<string, unknown> = {}) => (
    <label className={k === "address" ? "cp-span" : undefined}>
      {label}
      {k === "address" ? (
        <textarea rows={2} value={f[k]} maxLength={300} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      ) : (
        <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
      )}
    </label>
  );
  return (
    <form
      className="cp-form inv-buyer"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveBuyer(f);
        setBusy(false);
        if (!r.ok) return setMsg({ ok: false, text: r.error });
        setMsg({ ok: true, text: "Data penagihan tersimpan." });
        onSaved(r.data.buyer);
      }}
    >
      {field("name", "Nama perusahaan / instansi", { maxLength: 120, required: true })}
      {field("npwp", "NPWP (opsional)", { maxLength: 24, inputMode: "numeric", placeholder: "15 atau 16 digit" })}
      {field("email", "Email penagihan", { type: "email", maxLength: 160, required: true })}
      {field("contact", "Nama & no. HP PIC (opsional)", { maxLength: 120 })}
      {field("address", "Alamat penagihan")}
      <div className="cp-span row inv-actions">
        <button type="submit" className="small-btn" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan data penagihan"}
        </button>
        {msg && <span className={msg.ok ? "cp-saved" : "cp-warn"}>{msg.text}</span>}
      </div>
    </form>
  );
}

/** A company or agency pays a coin package by bank transfer or in 2–3 instalments, instead of Xendit. */
function TransferOrder({ booth, seller, buyer, onIssued }: { booth?: string; seller: PublicSeller; buyer: BuyerInfo | null; onIssued: (inv: InvoiceView) => void }) {
  const [pack, setPack] = useState<string>(BUSINESS_PACKAGES[1]!.id);
  const [plan, setPlan] = useState<"transfer" | 2 | 3>("transfer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pkg = BUSINESS_PACKAGES.find((p) => p.id === pack)!;
  const amount = price(`pack.${pkg.id}`);
  const preview = instalmentPlan(amount, plan === "transfer" ? 1 : plan, new Date());
  if (!seller.takesTransfer) return <p className="muted small">Pembayaran transfer bank dan termin belum dibuka panitia. Untuk sekarang isi koin lewat Xendit.</p>;
  return (
    <div className="inv-order">
      <div className="cp-form">
        <label>
          Paket koin
          <select value={pack} onChange={(e) => setPack(e.target.value)}>
            {BUSINESS_PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {n(p.coins + p.bonus)} koin · {rp(price(`pack.${p.id}`))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cara bayar
          <select value={String(plan)} onChange={(e) => setPlan(e.target.value === "transfer" ? "transfer" : (Number(e.target.value) as 2 | 3))}>
            <option value="transfer">Transfer bank (sekali bayar)</option>
            <option value="2">Termin 2 kali</option>
            <option value="3">Termin 3 kali</option>
          </select>
        </label>
      </div>
      <ul className="inv-plan">
        {preview.map((p, i) => (
          <li key={i}>
            <span>{plan === "transfer" ? "Transfer" : `Termin ${i + 1}`}</span>
            <span className="muted">jatuh tempo {dateText(p.dueAt)}</span>
            <b>{rp(p.amount)}</b>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Invoice dikirim dengan rekening {seller.bank.name} a.n. {seller.bank.holder}. Koin masuk setelah panitia mengonfirmasi{" "}
        {plan === "transfer" ? "transfer" : "termin terakhir"} diterima.
      </p>
      {!buyer && <p className="cp-warn">Isi data penagihan di atas dulu.</p>}
      <div className="row inv-actions">
        <button
          type="button"
          className="small-btn"
          disabled={busy || !buyer}
          onClick={async () => {
            setBusy(true);
            setError("");
            const r = await orderByTransfer({
              pack,
              method: plan === "transfer" ? "transfer" : "termin",
              ...(plan === "transfer" ? {} : { count: plan }),
              ...(booth ? { booth } : {}),
            });
            setBusy(false);
            if (!r.ok) return setError(r.error);
            onIssued(r.data.invoice);
          }}
        >
          <Landmark size={14} aria-hidden /> {busy ? "Membuat…" : "Buat invoice"}
        </button>
        {error && <span className="cp-warn">{error}</span>}
      </div>
    </div>
  );
}

/** The bank reference of a transfer, and optionally a photo of the receipt. */
function ProofForm({ inv, onSent }: { inv: InvoiceView; onSent: () => void }) {
  const [ref, setRef] = useState("");
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="inv-proof no-print"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await sendProof(inv.id, { ref: ref.trim(), note: "", ...(image ? { image } : {}) });
        setBusy(false);
        if (!r.ok) return setMsg({ ok: false, text: r.error });
        setRef("");
        setImage(null);
        setMsg({ ok: true, text: "Bukti terkirim. Panitia akan mengecek mutasi rekening." });
        onSent();
      }}
    >
      <b className="small">Sudah transfer? Kirim bukti</b>
      <div className="row inv-actions">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          minLength={3}
          maxLength={80}
          required
          placeholder="No. referensi / berita transfer"
          aria-label="Nomor referensi transfer"
        />
        <label className="small-btn ghost inv-file">
          {image ? "Foto dipilih" : "Foto bukti (opsional)"}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setImage({ name: file.name, data: await readImageFile(file, 1000, { square: false }) });
              } catch (err) {
                setMsg({ ok: false, text: (err as Error).message });
              }
            }}
          />
        </label>
        <button type="submit" className="small-btn" disabled={busy}>
          {busy ? "Mengirim…" : "Kirim"}
        </button>
      </div>
      {msg && <p className={msg.ok ? "cp-saved" : "cp-warn"}>{msg.text}</p>}
    </form>
  );
}

/** A line of the invoice list: number, what, how much, and where it stands. */
function InvoiceRow({ inv, onChange }: { inv: InvoiceView; onChange: () => void }) {
  const open = inv.status === "issued" && inv.method !== "gateway";
  return (
    <li className="inv-row" data-status={inv.status}>
      <div className="inv-row-head">
        <b>{inv.number}</b>
        <span className="inv-badge" data-status={inv.status}>
          {STATUS_NAMES[inv.status]}
        </span>
      </div>
      <div className="muted small">
        {dateText(inv.createdAt)} · {METHOD_NAMES[inv.method]} · {inv.items.map((i) => i.name).join(", ")}
      </div>
      {open && inv.dueAt && <div className="small">Jatuh tempo {dateText(inv.dueAt)}</div>}
      <div className="inv-row-foot">
        <b>{rp(inv.total)}</b>
        <span className="row inv-actions">
          {inv.taxFile && (
            <a className="small-btn ghost cp-link" href={fileUrl(inv.id, "faktur")}>
              <Download size={14} aria-hidden /> Faktur pajak
            </a>
          )}
          {open && inv.instalments.every((p) => !p.paidAt) && (
            <button
              type="button"
              className="small-btn ghost"
              onClick={async () => {
                if (!confirm(`Batalkan ${inv.number}?`)) return;
                const r = await cancelInvoice(inv.id);
                if (!r.ok) alert(r.error);
                onChange();
              }}
            >
              Batalkan
            </button>
          )}
          <a className="small-btn cp-link" href={`#/jobfair/invoice/${inv.id}`}>
            <FileText size={14} aria-hidden /> Lihat & cetak
          </a>
        </span>
      </div>
    </li>
  );
}

/**
 * Invoices of an account (and of a booth it runs): buyer details, ordering by transfer or termin,
 * and every invoice with a printable page. Live site only: invoices are numbered on the server.
 */
export function InvoicesPanel({ booth }: { booth?: string }) {
  const [data, setData] = useState<{ invoices: InvoiceView[]; buyer: BuyerInfo | null; seller: PublicSeller } | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const load = () => void myInvoices(booth).then((r) => (r.ok ? (setData(r.data), setError("")) : setError(r.error)));
  useEffect(load, [booth]);

  if (!LIVE) return <p className="muted small">Invoice resmi bernomor, transfer bank dan termin hanya ada di versi live (jobfair.co.id).</p>;
  if (error) return <p className="cp-warn">{error}</p>;
  if (!data) return <p className="muted small">Memuat…</p>;
  const b = data.buyer;
  return (
    <div className="inv-panel">
      <section className="inv-sec">
        <h3 className="cp-h3">Data penagihan</h3>
        {b && !editing ? (
          <div className="inv-buyer-view">
            <span>
              <b>{b.name}</b>
              {b.npwp && <span className="muted small"> · NPWP {npwpText(b.npwp)}</span>}
              <br />
              <span className="muted small">
                {b.address} · {b.email}
              </span>
            </span>
            <button type="button" className="small-btn ghost" onClick={() => setEditing(true)}>
              Ubah
            </button>
          </div>
        ) : (
          <BuyerForm
            buyer={b}
            onSaved={(buyer) => {
              setData({ ...data, buyer });
              setEditing(false);
            }}
          />
        )}
        <p className="muted small">Dipakai untuk semua invoice berikutnya, termasuk pembelian koin lewat Xendit.</p>
      </section>
      <section className="inv-sec">
        <h3 className="cp-h3">Transfer bank atau termin</h3>
        <p className="muted small">Untuk perusahaan dan instansi yang perlu invoice resmi lebih dulu sebelum membayar.</p>
        <TransferOrder booth={booth} seller={data.seller} buyer={b} onIssued={(inv) => (location.hash = `#/jobfair/invoice/${inv.id}`)} />
      </section>
      <section className="inv-sec">
        <h3 className="cp-h3">Invoice</h3>
        {data.invoices.length === 0 ? (
          <p className="muted small">Belum ada invoice. Setiap pembelian koin yang dibayar mendapat invoice bernomor.</p>
        ) : (
          <ul className="inv-list">
            {data.invoices.map((inv) => (
              <InvoiceRow key={inv.id} inv={inv} onChange={load} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The invoice itself, laid out to print on A4 (or save as PDF from the print dialog). */
export function InvoiceDoc({ inv }: { inv: InvoiceView }) {
  const s = inv.seller;
  const b = inv.buyer;
  const due = inv.instalments.find((p) => !p.paidAt);
  return (
    <article className="inv-doc">
      <header className="inv-doc-head">
        <div>
          <h1>{s?.name || "Panitia Job Fair"}</h1>
          {s?.address && <p>{s.address}</p>}
          {s?.npwp && <p>NPWP {npwpText(s.npwp)}</p>}
          {(s?.email || s?.phone) && <p>{[s.email, s.phone].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="inv-doc-title">
          <h2>INVOICE</h2>
          <p className="inv-doc-no">{inv.number}</p>
          <p>Tanggal {dateText(inv.createdAt)}</p>
          {inv.status === "issued" && due && <p>Jatuh tempo {dateText(due.dueAt)}</p>}
          <p className="inv-badge" data-status={inv.status}>
            {STATUS_NAMES[inv.status]}
            {inv.paidAt ? ` · ${dateText(inv.paidAt)}` : ""}
          </p>
        </div>
      </header>

      <section className="inv-doc-to">
        <span className="inv-doc-label">Ditagihkan kepada</span>
        <b>{b.name}</b>
        {b.npwp && <span>NPWP {npwpText(b.npwp)}</span>}
        {b.address && <span>{b.address}</span>}
        <span>{[b.email, b.contact].filter(Boolean).join(" · ")}</span>
      </section>

      <table className="inv-doc-table">
        <thead>
          <tr>
            <th>Uraian</th>
            <th className="num">Qty</th>
            <th className="num">Harga</th>
            <th className="num">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((i, k) => (
            <tr key={k}>
              <td>{i.name}</td>
              <td className="num">{i.qty}</td>
              <td className="num">{rp(i.unit)}</td>
              <td className="num">{rp(i.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {inv.rate > 0 && (
            <>
              <tr>
                <td colSpan={3}>Dasar Pengenaan Pajak (DPP)</td>
                <td className="num">{rp(inv.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3}>PPN {String(inv.rate).replace(".", ",")}%</td>
                <td className="num">{rp(inv.tax)}</td>
              </tr>
            </>
          )}
          <tr className="inv-doc-total">
            <td colSpan={3}>Total{inv.rate > 0 ? " (termasuk PPN)" : ""}</td>
            <td className="num">{rp(inv.total)}</td>
          </tr>
        </tfoot>
      </table>

      {inv.taxInvoiceNo && (
        <p className="inv-doc-tax">
          No. Faktur Pajak: <b>{inv.taxInvoiceNo}</b>
        </p>
      )}

      {inv.method === "gateway" ? (
        <p className="inv-doc-pay">Dibayar lunas lewat Xendit{inv.paidAt ? ` pada ${dateText(inv.paidAt)}` : ""}.</p>
      ) : (
        <section className="inv-doc-pay">
          <span className="inv-doc-label">{inv.method === "termin" ? "Pembayaran termin" : "Pembayaran transfer bank"}</span>
          {s?.bank.account && (
            <p>
              Transfer ke <b>{s.bank.name}</b> no. rekening <b>{s.bank.account}</b> a.n. <b>{s.bank.holder}</b>. Cantumkan nomor invoice di berita transfer.
            </p>
          )}
          <table className="inv-doc-table">
            <tbody>
              {inv.instalments.map((p, i) => (
                <tr key={i}>
                  <td>{inv.method === "termin" ? `Termin ${i + 1}` : "Transfer"}</td>
                  <td>jatuh tempo {dateText(p.dueAt)}</td>
                  <td>{p.paidAt ? `Diterima ${dateText(p.paidAt)}` : inv.status === "void" ? "-" : "Belum dibayar"}</td>
                  <td className="num">{rp(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {inv.coins > 0 && (
        <p className="small">
          {n(inv.coins)} koin{" "}
          {inv.delivered ? "sudah masuk ke akun pembeli." : inv.status === "void" ? "tidak diberikan (invoice dibatalkan)." : "masuk ke akun pembeli setelah lunas."}
        </p>
      )}
      {inv.voidNote && <p className="small">Dibatalkan: {inv.voidNote}</p>}
      <footer className="inv-doc-foot">Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan.</footer>
    </article>
  );
}

/** The printable page of one invoice, with what the buyer can still do on it. */
export function InvoicePage({ id }: { id: string }) {
  const [inv, setInv] = useState<InvoiceView | null>(null);
  const [error, setError] = useState("");
  const load = () => void oneInvoice(id).then((r) => (r.ok ? setInv(r.data.invoice) : setError(r.error)));
  useEffect(load, [id]);
  return (
    <main className="cp inv-page">
      <div className="inv-bar no-print">
        <button type="button" className="small-btn ghost" onClick={() => history.back()}>
          <ArrowLeft size={14} aria-hidden /> Kembali
        </button>
        {inv && (
          <>
            <button type="button" className="small-btn" onClick={() => window.print()}>
              <Printer size={14} aria-hidden /> Cetak / simpan PDF
            </button>
            {inv.taxFile && (
              <a className="small-btn ghost cp-link" href={fileUrl(inv.id, "faktur")}>
                <Download size={14} aria-hidden /> Unduh faktur pajak
              </a>
            )}
          </>
        )}
      </div>
      {!LIVE ? (
        <p className="card cp-server-note">Invoice resmi hanya ada di versi live.</p>
      ) : error ? (
        <p className="card cp-warn">{error}</p>
      ) : !inv ? (
        <p className="muted small">Memuat…</p>
      ) : (
        <>
          <InvoiceDoc inv={inv} />
          {inv.status === "issued" && inv.method !== "gateway" && (
            <div className="card no-print inv-after">
              <ProofForm inv={inv} onSent={load} />
              {inv.proofs.length > 0 && (
                <ul className="inv-proofs small">
                  {inv.proofs.map((p, i) => (
                    <li key={i}>
                      <Receipt size={14} aria-hidden /> {p.ref} · {dateText(p.at)}
                      {p.file && (
                        <>
                          {" · "}
                          <a href={fileUrl(inv.id, p.file)}>foto</a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

/** The account's invoices on their own page, opened from the coin wallet. */
export function InvoicesPage() {
  return (
    <main className="cp inv-page">
      <div className="inv-bar no-print">
        <a className="small-btn ghost cp-link" href="#/jobfair">
          <ArrowLeft size={14} aria-hidden /> Ke job fair
        </a>
      </div>
      <div className="card">
        <h2 className="cp-h2">Invoice & tagihan</h2>
        <InvoicesPanel />
      </div>
    </main>
  );
}
