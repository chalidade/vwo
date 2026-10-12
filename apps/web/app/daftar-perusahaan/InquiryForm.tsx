"use client";

import { useState } from "react";

/** A booth registration from the earlier paid flow, or one the organiser opened from the form. */
export interface RegistrationView {
  id: string;
  company: string;
  status: string;
  boothKey: string | null;
  pin: string | null;
  note: string | null;
  createdAt: number;
}

/** A booth request from the form, as its sender sees it (never the organiser's notes). */
export interface LeadView {
  id: string;
  name: string;
  status: string;
  at: number;
}

const REG_STATUS: Record<string, string> = { unpaid: "Belum selesai", paid: "Menunggu verifikasi panitia", verified: "Terverifikasi", rejected: "Ditolak" };
const LEAD_STATUS: Record<string, string> = { new: "Terkirim", contacted: "Sedang dihubungi panitia", done: "Selesai", rejected: "Tidak dilanjutkan" };

const ERRORS: Record<string, string> = {
  invalid_input: "Periksa lagi isian: email dan nomor HP/WhatsApp harus benar, website boleh dikosongkan.",
  too_many_open: "Masih ada formulir yang menunggu panitia. Tunggu dihubungi dulu, ya.",
  too_many_requests: "Terlalu banyak formulir dari akun ini hari ini. Coba lagi besok.",
  not_signed_in: "Sesi login habis. Muat ulang halaman lalu masuk lagi.",
  bad_origin: "Permintaan ditolak. Muat ulang halaman lalu coba lagi.",
};

const date = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** The company registration form: company and contact details only. No package prices, no payment; the organiser calls back. */
export function InquiryForm({ email, name, registrations, initial }: { email: string; name: string; registrations: RegistrationView[]; initial: LeadView[] }) {
  const [leads, setLeads] = useState(initial);
  const [showForm, setShowForm] = useState(!initial.some((l) => l.status === "new" || l.status === "contacted"));
  const [f, setF] = useState({ company: "", industry: "", city: "", website: "", contactName: name, contactRole: "HR", email, phone: "", note: "", website2: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => (setF({ ...f, [k]: e.target.value }), setError(""));

  return (
    <>
      {sent && (
        <div className="rg-card">
          <h2>Formulir terkirim</h2>
          <p className="rg-ok" style={{ margin: "6px 0 0" }}>
            Terima kasih. Panitia akan menghubungi kamu lewat telepon, WhatsApp, atau email untuk membicarakan paket dan tempat stand. Setelah sepakat, panitia membuat booth dan
            mengirim kode serta PIN portal perusahaan.
          </p>
        </div>
      )}
      {leads.map((l) => (
        <div key={l.id} className="rg-card">
          <h2>
            {l.name}{" "}
            <span className="rg-status" data-s={l.status}>
              {LEAD_STATUS[l.status] ?? l.status}
            </span>
          </h2>
          <p className="cs-sub" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Formulir dikirim {date(l.at)}.{" "}
            {l.status === "done"
              ? "Booth sudah dibuat: kode dan PIN dikirim ke email kontak, dan akun ini sudah bisa membuka portal perusahaan."
              : l.status === "rejected"
                ? ""
                : "Panitia akan menghubungi kamu."}
          </p>
          {l.status === "done" && (
            <a className="cs-btn primary" href="/masuk-perusahaan" style={{ marginTop: 12 }}>
              Masuk portal perusahaan →
            </a>
          )}
        </div>
      ))}
      {registrations.map((r) => (
        <div key={r.id} className="rg-card">
          <h2>
            {r.company}{" "}
            <span className="rg-status" data-s={r.status}>
              {REG_STATUS[r.status] ?? r.status}
            </span>
          </h2>
          <p className="cs-sub" style={{ margin: "4px 0 0", fontSize: 14 }}>
            Didaftarkan {date(r.createdAt)}
          </p>
          {r.status === "paid" && (
            <p className="rg-ok">
              Pembayaran diterima. Panitia sedang memverifikasi perusahaanmu; kode dan PIN dikirim ke email setelah terverifikasi dan juga tampil di halaman ini.
            </p>
          )}
          {r.status === "unpaid" && (
            <p className="cs-sub" style={{ margin: "8px 0 0", fontSize: 13 }}>
              Pendaftaran ini belum selesai. Kirim formulir di bawah, panitia akan menghubungi kamu.
            </p>
          )}
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

      {!showForm && (
        <p style={{ marginTop: 18 }}>
          <button type="button" className="cs-btn ghost" style={{ cursor: "pointer", color: "inherit" }} onClick={() => (setShowForm(true), setSent(false))}>
            + Daftarkan perusahaan lain
          </button>
        </p>
      )}

      {showForm && (
        <form
          className="rg-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/jobfair/leads", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind: "booth", data: f }),
              });
              const d = (await r.json().catch(() => ({}))) as { error?: string; lead?: LeadView };
              if (!r.ok || !d.lead) return setError(ERRORS[d.error ?? ""] ?? "Gagal mengirim. Coba lagi sebentar lagi.");
              setLeads([d.lead, ...leads]);
              setShowForm(false);
              setSent(true);
              setF({ ...f, company: "", industry: "", city: "", website: "", note: "" });
            } catch {
              setError("Tidak tersambung ke server. Periksa internet lalu coba lagi.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Data perusahaan</h2>
          <div className="rg-grid" style={{ marginTop: 12 }}>
            <label className="full">
              Nama perusahaan
              <input required minLength={2} maxLength={60} value={f.company} onChange={set("company")} placeholder="PT Contoh Maju" />
            </label>
            <label>
              Bidang usaha
              <input required minLength={2} maxLength={60} value={f.industry} onChange={set("industry")} placeholder="Teknologi, Retail, …" />
            </label>
            <label>
              Kota kantor
              <input required minLength={2} maxLength={60} value={f.city} onChange={set("city")} placeholder="Jakarta" />
            </label>
            <label className="full">
              Website perusahaan (boleh dikosongkan)
              <input inputMode="url" maxLength={120} value={f.website} onChange={set("website")} placeholder="perusahaan.co.id" />
            </label>
            <label>
              Nama PIC / HR
              <input required minLength={2} maxLength={60} value={f.contactName} onChange={set("contactName")} />
            </label>
            <label>
              Jabatan
              <input required minLength={2} maxLength={60} value={f.contactRole} onChange={set("contactRole")} placeholder="HR Manager" />
            </label>
            <label>
              Email kantor
              <input required type="email" maxLength={120} value={f.email} onChange={set("email")} />
            </label>
            <label>
              No. HP / WhatsApp
              <input required type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={set("phone")} placeholder="0812 3456 7890" />
            </label>
            <label className="full">
              Catatan (boleh dikosongkan)
              <textarea rows={3} maxLength={500} value={f.note} onChange={set("note")} placeholder="Misalnya: ingin stand VIP, lantai tertentu, atau waktu terbaik dihubungi" />
            </label>
            <label className="rg-hp" aria-hidden>
              Website kedua
              <input tabIndex={-1} autoComplete="off" value={f.website2} onChange={set("website2")} />
            </label>
          </div>
          <p className="cs-sub" style={{ fontSize: 13, margin: "16px 0" }}>
            Belum ada pembayaran di sini. Panitia akan menghubungi kamu untuk membicarakan paket dan tempat stand. Pakai data asli perusahaan: panitia mengecek website, email
            kantor, dan nomor HP.
          </p>
          {error && <p className="rg-err">{error}</p>}
          <button type="submit" className="cs-btn primary" style={{ border: 0, cursor: "pointer" }} disabled={busy}>
            {busy ? "Mengirim…" : "Kirim formulir"}
          </button>
        </form>
      )}
    </>
  );
}
