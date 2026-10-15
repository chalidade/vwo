"use client";

import { EDUCATION_LEVELS, PREREG_AGES, PREREG_FIELDS, PREREG_JOB_TYPES, PREREG_MAX_FIELDS, PREREG_STATUSES, type PreregData, type PublicPreregEvent, isGmail } from "@vwo/shared";
import { useEffect, useRef, useState } from "react";
import { useFormGuard } from "../useFormGuard";
import { PreregCard, type OwnRegistration } from "./PreregCard";

const ERRORS: Record<string, string> = {
  invalid_input: "Periksa lagi isian: email, nomor WhatsApp (08… atau +62…), dan link (http/https) harus benar.",
  not_human: "Verifikasi keamanan belum selesai. Tunggu tanda centang lalu kirim lagi.",
  verify_failed: "Pendaftaran gagal diverifikasi, coba lagi.",
  email_rejected: "Email ini tidak bisa dipakai. Gunakan email akun Google (Gmail) kamu.",
  too_many_requests: "Terlalu banyak percobaan dari jaringan ini. Coba lagi beberapa saat lagi.",
  too_large: "Isian terlalu panjang. Persingkat ringkasan pengalaman.",
  closed: "Pendaftaran event ini sedang ditutup panitia.",
  deadline: "Batas waktu pendaftaran sudah lewat.",
  full: "Kuota pendaftaran sudah penuh.",
  wrong_code: "Kode tidak cocok dengan email ini. Periksa lagi kodemu.",
  not_found: "Email atau kode tidak cocok. Periksa lagi keduanya.",
  bad_origin: "Permintaan ditolak. Muat ulang halaman lalu coba lagi.",
};

type Form = {
  fullName: string;
  email: string;
  whatsapp: string;
  city: string;
  age: string;
  education: string;
  major: string;
  institution: string;
  status: string;
  fields: string[];
  jobTypes: string[];
  skills: string;
  experience: string;
  link: string;
  consent: boolean;
};

const EMPTY: Form = {
  fullName: "",
  email: "",
  whatsapp: "",
  city: "",
  age: "",
  education: "",
  major: "",
  institution: "",
  status: "",
  fields: [],
  jobTypes: [],
  skills: "",
  experience: "",
  link: "",
  consent: false,
};

const fromData = (d: PreregData): Form => ({ ...EMPTY, ...d, consent: false });

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T; status: number; form?: string } | { ok: false; error: string; resent?: boolean; form?: string }> {
  try {
    const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as T & { error?: string; resent?: boolean; form?: string };
    return r.ok ? { ok: true, data: d, status: r.status, form: d.form } : { ok: false, error: d.error ?? `http_${r.status}`, resent: d.resent, form: d.form };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** The pre-registration form, the "sudah daftar?" lookup by email and code, and the card to keep. */
export function PreregForm({ event, siteKey, cities, formToken }: { event: PublicPreregEvent; siteKey: string; cities: string[]; formToken: string }) {
  const open = event.state === "open";
  const [mode, setMode] = useState<"form" | "lookup" | "done">(open ? "form" : "lookup");
  const [f, setF] = useState<Form>(EMPTY);
  /** Set while changing an earlier sign-up: its code goes with the form. */
  const [code, setCode] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState<{ reg: OwnRegistration; mailed: boolean; updated: boolean } | null>(null);
  const [look, setLook] = useState({ email: "", code: "" });
  const captcha = useTurnstile(mode === "form" && open ? siteKey : "");
  const guard = useFormGuard(formToken);
  const set =
    <K extends keyof Form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (
      setF({ ...f, [k]: (e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value) as Form[K] }),
      setError("")
    );
  const toggle = (k: "fields" | "jobTypes", v: string, max: number) => {
    const list = f[k];
    setF({ ...f, [k]: list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v] });
    setError("");
  };
  const top = () => document.querySelector(".pr-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.fields.length) return setError("Pilih minimal satu bidang kerja yang kamu minati.");
    if (!f.jobTypes.length) return setError("Pilih minimal satu jenis pekerjaan.");
    if (siteKey && !captcha.token) return setError(ERRORS.not_human!);
    setBusy(true);
    setError("");
    const r = await post<{ status: string; mailed: boolean; registration: OwnRegistration }>(`/api/prereg/${event.slug}`, {
      data: f,
      ...(code ? { code } : {}),
      ...(captcha.token ? { captcha: captcha.token } : {}),
      ...(await guard.fields()),
      website2: hp,
    });
    setBusy(false);
    captcha.reset();
    guard.renew(r.form);
    if (r.ok) {
      setDone({ reg: r.data.registration, mailed: r.data.mailed, updated: r.data.status === "updated" });
      setMode("done");
      return setTimeout(top, 50);
    }
    if (r.error === "already_registered") {
      setLook({ email: f.email.trim().toLowerCase(), code: "" });
      setMode("lookup");
      setInfo(
        `Email ini sudah terdaftar di ${event.name}. ${r.resent ? "Kodenya sudah kami kirim ulang ke email itu. " : ""}Masukkan kodemu untuk melihat kartu atau mengubah data.`,
      );
      return setTimeout(top, 50);
    }
    setError(ERRORS[r.error] ?? "Gagal mengirim. Periksa internet lalu coba lagi.");
  };

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post<{ registration: OwnRegistration }>(`/api/prereg/${event.slug}/lookup`, look);
    setBusy(false);
    if (!r.ok) return setError(ERRORS[r.error] ?? "Gagal memuat. Coba lagi.");
    setInfo("");
    setDone({ reg: r.data.registration, mailed: false, updated: false });
    setMode("done");
  };

  if (mode === "done" && done)
    return (
      <div className="pr-anchor">
        {done.updated && (
          <p className="rg-ok" style={{ marginTop: 18 }}>
            Data kamu sudah diperbarui. Kodenya tetap sama.
          </p>
        )}
        <PreregCard reg={done.reg} />
        {done.mailed && <p className="cs-sub pr-small">Salinan kode juga kami kirim ke {done.reg.data.email}.</p>}
        <p className="pr-actions">
          {open && (
            <button
              type="button"
              className="cs-btn ghost pr-btn"
              onClick={() => {
                setF(fromData(done.reg.data));
                setCode(done.reg.code);
                setMode("form");
                setTimeout(top, 50);
              }}
            >
              Ubah data
            </button>
          )}
          <a className="cs-btn ghost" href="/">
            Kembali ke beranda
          </a>
        </p>
      </div>
    );

  if (mode === "lookup")
    return (
      <form className="rg-card pr-anchor" onSubmit={lookup}>
        <h2>Sudah mendaftar?</h2>
        <p className="cs-sub pr-small" style={{ marginTop: 0 }}>
          Masukkan email dan kode pendaftaranmu untuk melihat kartu atau mengubah data. Kode ada di layar setelah mendaftar (atau di emailmu).
        </p>
        {info && <p className="cs-note">{info}</p>}
        <div className="rg-grid">
          <label>
            Email Google
            <input type="email" required maxLength={120} autoComplete="email" value={look.email} onChange={(e) => (setLook({ ...look, email: e.target.value }), setError(""))} />
          </label>
          <label>
            Kode pendaftaran
            <input
              required
              maxLength={20}
              autoCapitalize="characters"
              placeholder="JF-XXXX-XXXX"
              className="pr-code-in"
              value={look.code}
              onChange={(e) => (setLook({ ...look, code: e.target.value.toUpperCase() }), setError(""))}
            />
          </label>
        </div>
        {error && <p className="rg-err">{error}</p>}
        <p className="pr-actions">
          <button type="submit" className="cs-btn primary pr-btn" disabled={busy}>
            {busy ? "Memeriksa…" : "Lihat pendaftaran"}
          </button>
          {open && (
            <button type="button" className="cs-btn ghost pr-btn" onClick={() => (setMode("form"), setInfo(""), setError(""))}>
              Daftar baru
            </button>
          )}
        </p>
      </form>
    );

  const gmailHint = f.email.includes("@") && !isGmail(f.email);
  return (
    <form className="rg-card pr-anchor" onSubmit={submit} noValidate={false}>
      <div className="pr-head">
        <h2>{code ? "Ubah data pendaftaran" : "Formulir pra-registrasi"}</h2>
        {!code && (
          <button type="button" className="pr-link" onClick={() => (setMode("lookup"), setError(""))}>
            Sudah daftar? Lihat kode
          </button>
        )}
      </div>
      {code && <p className="cs-note">Mengubah pendaftaran {code}. Email tidak bisa diganti di sini; minta panitia kalau salah email.</p>}

      <h3 className="pr-h3">Data diri</h3>
      <div className="rg-grid">
        <label className="full">
          Nama lengkap
          <input required minLength={2} maxLength={80} autoComplete="name" value={f.fullName} onChange={set("fullName")} placeholder="Sesuai KTP" />
        </label>
        <label className="full">
          Email akun Google
          <input
            required
            type="email"
            maxLength={120}
            autoComplete="email"
            value={f.email}
            onChange={set("email")}
            placeholder="nama@gmail.com"
            readOnly={!!code}
            aria-describedby="pr-email-note"
          />
          <small id="pr-email-note" className="pr-note" data-warn={gmailHint ? "" : undefined}>
            {gmailHint
              ? "Ini bukan alamat Gmail. Pastikan email ini memang akun Google kamu, karena saat acara dibuka kamu masuk dengan tombol “Masuk dengan Google”."
              : "Pakai email akun Google (Gmail) yang nanti kamu pakai untuk masuk. Saat acara dibuka, data kamu otomatis terpasang di akun ini."}
          </small>
        </label>
        <label>
          No. WhatsApp
          <input required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={f.whatsapp} onChange={set("whatsapp")} placeholder="0812 3456 7890" />
        </label>
        <label>
          Domisili (kota/kabupaten)
          <input required minLength={2} maxLength={60} list="pr-cities" value={f.city} onChange={set("city")} placeholder="Kota Bandung" />
          <datalist id="pr-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Usia
          <select required value={f.age} onChange={set("age")}>
            <option value="" disabled>
              Pilih rentang usia
            </option>
            {PREREG_AGES.map((a) => (
              <option key={a} value={a}>
                {a} tahun
              </option>
            ))}
          </select>
        </label>
        <label>
          Status saat ini
          <select required value={f.status} onChange={set("status")}>
            <option value="" disabled>
              Pilih status
            </option>
            {PREREG_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="pr-h3">Pendidikan terakhir</h3>
      <div className="rg-grid">
        <label>
          Jenjang
          <select required value={f.education} onChange={set("education")}>
            <option value="" disabled>
              Pilih jenjang
            </option>
            {EDUCATION_LEVELS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Jurusan (boleh dikosongkan)
          <input maxLength={80} value={f.major} onChange={set("major")} placeholder="Teknik Informatika" />
        </label>
        <label className="full">
          Kampus / sekolah
          <input required minLength={2} maxLength={100} value={f.institution} onChange={set("institution")} placeholder="Universitas Indonesia" />
        </label>
      </div>

      <h3 className="pr-h3">Minat kerja</h3>
      <fieldset className="pr-chips">
        <legend>
          Bidang yang diminati <small>(pilih 1–{PREREG_MAX_FIELDS})</small>
        </legend>
        {PREREG_FIELDS.map((x) => (
          <button key={x} type="button" aria-pressed={f.fields.includes(x)} onClick={() => toggle("fields", x, PREREG_MAX_FIELDS)}>
            {x}
          </button>
        ))}
      </fieldset>
      <fieldset className="pr-chips">
        <legend>Jenis pekerjaan</legend>
        {PREREG_JOB_TYPES.map((x) => (
          <button key={x} type="button" aria-pressed={f.jobTypes.includes(x)} onClick={() => toggle("jobTypes", x, PREREG_JOB_TYPES.length)}>
            {x}
          </button>
        ))}
      </fieldset>
      <div className="rg-grid" style={{ marginTop: 14 }}>
        <label className="full">
          Keahlian (boleh dikosongkan)
          <input maxLength={400} value={f.skills} onChange={set("skills")} placeholder="Pisahkan dengan koma: Excel, Komunikasi, React" />
        </label>
        <label className="full">
          Ringkasan pengalaman (boleh dikosongkan)
          <textarea rows={3} maxLength={1000} value={f.experience} onChange={set("experience")} placeholder="Magang, organisasi, proyek, atau pekerjaan sebelumnya" />
        </label>
        <label className="full">
          LinkedIn / portofolio (boleh dikosongkan)
          <input inputMode="url" maxLength={200} value={f.link} onChange={set("link")} placeholder="https://linkedin.com/in/namakamu" />
        </label>
        <label className="rg-hp" aria-hidden>
          Website kedua
          <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>

      <div className="pr-privacy">
        <b>Data yang kami simpan dan untuknya</b>
        <p>
          Nama, email, WhatsApp, domisili, usia, pendidikan, minat, dan pengalaman di atas dipakai untuk: menyiapkan akunmu saat acara dibuka (profil terisi otomatis),
          menghubungimu soal acara ini, dan dibagikan ke perusahaan peserta {event.name} yang mencari kandidat. Hanya panitia yang bisa melihat daftar pendaftar. Kamu bisa minta
          data dihapus lewat panitia.
        </p>
        <label className="pr-consent">
          <input type="checkbox" required checked={f.consent} onChange={set("consent")} />
          <span>Saya setuju data ini diproses panitia dan dibagikan ke perusahaan peserta acara untuk keperluan rekrutmen.</span>
        </label>
      </div>

      {siteKey && <div ref={captcha.ref} className="pr-captcha" />}
      {error && (
        <p className="rg-err" role="alert">
          {error}
        </p>
      )}
      <p className="pr-actions">
        <button type="submit" className="cs-btn primary pr-btn" disabled={busy || !f.consent}>
          {busy ? "Mengirim…" : code ? "Simpan perubahan" : "Daftar & dapatkan kode"}
        </button>
        {code && (
          <button type="button" className="cs-btn ghost pr-btn" onClick={() => (setMode("done"), setCode(""))}>
            Batal
          </button>
        )}
      </p>
    </form>
  );
}

type Turnstile = { render(el: HTMLElement, opts: Record<string, unknown>): string; reset(id: string): void; remove(id: string): void };

/** Cloudflare Turnstile, when the server has both keys. Usually passes without a puzzle. */
function useTurnstile(siteKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!siteKey) return;
    let gone = false;
    const w = window as { turnstile?: Turnstile };
    const mount = () => {
      if (gone || !w.turnstile || !ref.current) return;
      widget.current = w.turnstile.render(ref.current, {
        sitekey: siteKey,
        action: "prereg",
        language: "id",
        theme: "dark",
        callback: setToken,
        "expired-callback": () => setToken(null),
      });
    };
    if (w.turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      gone = true;
      if (w.turnstile && widget.current) w.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);
  return {
    ref,
    token,
    reset() {
      const w = window as { turnstile?: Turnstile };
      if (w.turnstile && widget.current) w.turnstile.reset(widget.current);
      setToken(null);
    },
  };
}
