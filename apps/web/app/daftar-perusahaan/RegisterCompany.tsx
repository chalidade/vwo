"use client";

import { useState } from "react";

export interface RegistrationView {
  id: string;
  company: string;
  tier: string;
  price: number;
  /** What the registration costs in coins at today's coin value. */
  coins: number;
  status: string;
  boothKey: string | null;
  pin: string | null;
  note: string | null;
  createdAt: number;
}

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0d9488", "#db2777", "#334155"];
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const koin = (n: number) => `${n.toLocaleString("id-ID")} koin`;
const STATUS: Record<string, string> = { unpaid: "Menunggu pembayaran", paid: "Menunggu verifikasi panitia", verified: "Terverifikasi", rejected: "Ditolak" };

const ERRORS: Record<string, string> = {
  invalid_input: "Periksa lagi isian: website harus diawali https://, email dan nomor HP harus benar.",
  too_many_open: "Masih ada pendaftaran yang belum selesai. Selesaikan atau tunggu verifikasi dulu.",
  too_many_requests: "Terlalu banyak pendaftaran dari akun ini. Coba lagi besok.",
  not_signed_in: "Sesi login habis. Muat ulang halaman lalu masuk lagi.",
  bad_origin: "Permintaan ditolak. Muat ulang halaman lalu coba lagi.",
  not_payable: "Pendaftaran ini sudah dibayar atau tidak bisa dibayar lagi. Muat ulang halaman.",
  gateway_error: "Halaman pembayaran belum bisa dibuat. Coba lagi sebentar lagi.",
  not_delivered: "Pembayaran gagal diproses. Koinmu sudah dikembalikan; coba lagi.",
};

type Pack = { id: string; coins: number; bonus: number; price: number };

async function post(path: string, body: unknown) {
  try {
    const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as {
      error?: string;
      registration?: RegistrationView & { createdAt: string };
      payment?: { status: string; checkoutUrl: string | null };
      code?: string;
      coins?: { balance: number };
      balance?: number;
      needed?: number;
    };
    if (d.error === "not_enough_coins") return { ok: false as const, error: `Koin belum cukup: perlu ${koin(d.needed ?? 0)}, saldo ${koin(d.balance ?? 0)}. Isi koin dulu di atas.`, balance: d.balance };
    const msg = ERRORS[d.error ?? ""] ?? "Gagal. Coba lagi sebentar lagi.";
    return r.ok ? { ok: true as const, data: d } : { ok: false as const, error: d.code ? `${msg} (kode: ${d.code})` : msg };
  } catch {
    return { ok: false as const, error: "Tidak tersambung ke server. Periksa internet lalu coba lagi." };
  }
}

export function RegisterCompany({
  email,
  name,
  prices,
  coins,
  balance: startBalance,
  packs,
  initial,
  gateway,
  back,
}: {
  email: string;
  name: string;
  prices: { regular: number; premium: number };
  coins: { regular: number; premium: number };
  balance: number;
  packs: Pack[];
  initial: RegistrationView[];
  /** xendit: pay on Xendit's checkout page. demo: no gateway set up, nothing is charged. */
  gateway: "xendit" | "demo";
  /** Back from the checkout page: "ok" or "gagal". */
  back: string | null;
}) {
  const [list, setList] = useState(initial);
  const open = list.find((r) => r.status === "unpaid" || r.status === "paid");
  const [showForm, setShowForm] = useState(!list.length);
  const [f, setF] = useState({ company: "", industry: "", website: "", city: "", contactName: name, contactRole: "HR", email, phone: "", website2: "" });
  const [tier, setTier] = useState<"regular" | "premium">("regular");
  const [color, setColor] = useState(COLORS[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(startBalance);
  const [buying, setBuying] = useState<string | null>(null);
  const need = open?.status === "unpaid" ? open.coins : showForm && !open ? coins[tier] : 0;
  const short = Math.max(0, need - balance);
  const best = short > 0 ? (packs.find((p) => p.coins >= short) ?? packs[packs.length - 1]) : undefined;
  const buy = async (id: string) => {
    setBuying(id);
    setError("");
    const res = await post("/api/payments", { kind: "coins", pack: id, back: "/daftar-perusahaan" });
    if (!res.ok) return setBuying(null), setError(res.error);
    const p = res.data.payment;
    if (p?.checkoutUrl && p.status === "pending") return void (window.location.href = p.checkoutUrl);
    // No gateway set up: the coins are booked at once.
    window.location.reload();
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => (setF({ ...f, [k]: e.target.value }), setError(""));

  return (
    <>
      <div className="rg-card rg-wallet">
        <div className="rg-wallet-head">
          <div>
            <h2>Saldo koin</h2>
            <p className="cs-sub" style={{ margin: "4px 0 0", fontSize: 14 }}>
              Sewa stand dan semua pembelian di job fair dibayar dengan koin. Isi koin sekali, sisanya bisa dipakai untuk upgrade VIP, promotor, dan aksesoris stand.
            </p>
          </div>
          <strong className="rg-balance" data-short={short ? "" : undefined}>
            🪙 {balance.toLocaleString("id-ID")}
            {short > 0 && <small>kurang {koin(short)}</small>}
          </strong>
        </div>
        {back === "ok" && <p className="cs-sub" style={{ margin: "10px 0 0", fontSize: 13 }}>Pembayaran isi koin sedang dikonfirmasi. Muat ulang halaman ini sebentar lagi kalau saldo belum bertambah.</p>}
        {back === "gagal" && <p className="rg-err">Isi koin belum selesai. Kamu bisa coba lagi.</p>}
        <div className="rg-packs">
          {packs.map((p) => (
            <button key={p.id} type="button" className="rg-pack" data-best={best?.id === p.id ? "" : undefined} disabled={!!buying} onClick={() => void buy(p.id)}>
              {best?.id === p.id && <span className="rg-pack-tag">Pas untuk paketmu</span>}
              <b>🪙 {p.coins.toLocaleString("id-ID")}</b>
              <small>{p.bonus ? `termasuk bonus ${p.bonus.toLocaleString("id-ID")}` : "tanpa bonus"}</small>
              <span>{buying === p.id ? "Memproses…" : rupiah(p.price)}</span>
            </button>
          ))}
        </div>
        <p className="cs-sub" style={{ margin: "10px 0 0", fontSize: 13 }}>
          {gateway === "xendit" ? "Isi koin lewat Xendit: QRIS, virtual account, e-wallet atau kartu kredit." : "Pembayaran isi koin saat ini masih simulasi: tidak ada uang yang ditarik."}
        </p>
      </div>
      {list.map((r) => (
        <div key={r.id} className="rg-card">
          <h2>
            {r.company} <span className="rg-status" data-s={r.status}>{STATUS[r.status] ?? r.status}</span>
          </h2>
          <p className="cs-sub" style={{ margin: "4px 0 0", fontSize: 14 }}>
            {r.tier === "premium" ? "Stand VIP" : "Stand reguler"} · {koin(r.coins)} (≈ {rupiah(r.price)}) · didaftarkan {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          {r.status === "unpaid" && (
            <div style={{ marginTop: 14 }}>
              <p className="cs-sub" style={{ margin: "0 0 10px", fontSize: 13 }}>
                Bayar {koin(r.coins)} dari saldo koin. {r.coins > balance ? "Isi koin dulu di atas." : ""}
              </p>
              <button
                type="button"
                className="cs-btn primary"
                style={{ border: 0, cursor: "pointer" }}
                disabled={busy || r.coins > balance}
                onClick={async () => {
                  setBusy(true);
                  const res = await post("/api/payments", { kind: "registration", id: r.id });
                  setBusy(false);
                  if (!res.ok) {
                    if (typeof res.balance === "number") setBalance(res.balance);
                    return setError(res.error);
                  }
                  if (res.data.coins) setBalance(res.data.coins.balance);
                  if (res.data.payment?.status === "paid") return setList(list.map((x) => (x.id === r.id ? { ...x, status: "paid" } : x)));
                  setError("Pembayaran belum berhasil. Coba lagi sebentar lagi.");
                }}
              >
                {busy ? "Memproses…" : r.coins > balance ? `Koin kurang ${koin(r.coins - balance)}` : `Bayar ${koin(r.coins)}`}
              </button>
            </div>
          )}
          {r.status === "paid" && <p className="rg-ok">Pembayaran diterima. Panitia sedang memverifikasi perusahaanmu; kode dan PIN dikirim ke email setelah terverifikasi dan juga tampil di halaman ini.</p>}
          {r.status === "verified" && r.boothKey && r.pin && (
            <>
              <dl className="rg-cred">
                <dt>Kode perusahaan</dt>
                <dd>{r.boothKey}</dd>
                <dt>PIN</dt>
                <dd>{r.pin}</dd>
              </dl>
              <a className="cs-btn primary" href="/masuk-perusahaan">
                Masuk portal perusahaan →
              </a>
            </>
          )}
          {r.status === "rejected" && <p className="rg-err">Alasan: {r.note}</p>}
        </div>
      ))}
      {error && !showForm && <p className="rg-err">{error}</p>}

      {!open && !showForm && (
        <p style={{ marginTop: 18 }}>
          <button type="button" className="cs-btn ghost" style={{ cursor: "pointer", color: "inherit" }} onClick={() => setShowForm(true)}>
            + Daftarkan perusahaan lain
          </button>
        </p>
      )}

      {!open && showForm && (
        <form
          className="rg-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await post("/api/company/registrations", { ...f, tier, color });
            setBusy(false);
            if (!res.ok) return setError(res.error);
            const r = res.data.registration!;
            setList([{ ...r, coins: coins[r.tier === "premium" ? "premium" : "regular"], createdAt: new Date(r.createdAt).getTime() }, ...list]);
            setShowForm(false);
          }}
        >
          <h2>Pilih paket</h2>
          <div className="rg-tiers" style={{ margin: "12px 0 20px" }}>
            {(["regular", "premium"] as const).map((t) => (
              <button key={t} type="button" className="rg-tier" data-on={tier === t ? "" : undefined} onClick={() => setTier(t)}>
                <b>{t === "premium" ? "👑 Stand VIP" : "Stand reguler"}</b>
                <strong>{koin(coins[t])}</strong>
                <small style={{ display: "block", marginBottom: 6 }}>≈ {rupiah(prices[t])}</small>
                <small>{t === "premium" ? "Stand lebih lebar, layar video, lampu sorot, LED berjalan, posisi teratas" : "Panel, meja recruiter, roll-up banner, lowongan tanpa batas"}</small>
              </button>
            ))}
          </div>
          <h2>Data perusahaan</h2>
          <div className="rg-grid" style={{ marginTop: 12 }}>
            <label className="full">
              Nama perusahaan
              <input required maxLength={60} value={f.company} onChange={set("company")} placeholder="PT Contoh Maju" />
            </label>
            <label>
              Bidang usaha
              <input required maxLength={60} value={f.industry} onChange={set("industry")} placeholder="Teknologi, Retail, …" />
            </label>
            <label>
              Kota kantor
              <input required maxLength={60} value={f.city} onChange={set("city")} placeholder="Jakarta" />
            </label>
            <label className="full">
              Website perusahaan
              <input type="url" maxLength={120} value={f.website} onChange={set("website")} placeholder="https://perusahaan.example" />
            </label>
            <label>
              Nama PIC / HR
              <input required maxLength={60} value={f.contactName} onChange={set("contactName")} />
            </label>
            <label>
              Jabatan
              <input required maxLength={60} value={f.contactRole} onChange={set("contactRole")} placeholder="HR Manager" />
            </label>
            <label>
              Email kantor
              <input required type="email" maxLength={120} value={f.email} onChange={set("email")} />
            </label>
            <label>
              No. HP / WhatsApp
              <input required inputMode="tel" maxLength={20} value={f.phone} onChange={set("phone")} placeholder="0812 3456 7890" />
            </label>
            <div className="full">
              <span style={{ fontSize: 13, fontWeight: 700 }}>Warna brand</span>
              <div className="rg-colors" role="radiogroup" aria-label="Warna brand" style={{ marginTop: 6 }}>
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <label className="rg-hp" aria-hidden>
              Website kedua
              <input tabIndex={-1} autoComplete="off" value={f.website2} onChange={set("website2")} />
            </label>
          </div>
          <p className="cs-sub" style={{ fontSize: 13, margin: "16px 0" }}>
            Panitia akan mengecek data ini (website, email kantor, nomor HP) sebelum booth dibuka. Pakai data asli perusahaan.
          </p>
          {error && <p className="rg-err">{error}</p>}
          <button type="submit" className="cs-btn primary" style={{ border: 0, cursor: "pointer" }} disabled={busy}>
            {busy ? "Mengirim…" : `Lanjut ke pembayaran · ${koin(coins[tier])}`}
          </button>
        </form>
      )}
    </>
  );
}
