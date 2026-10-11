import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { type CompanyBooth, type JobPosting, openJobs, price } from "@vwo/shared";
import { AccountGate } from "../AccountGate";
import { type Account, ACCOUNT_EVENT, currentAccount } from "../account";
import { PLAYER_ID } from "../jobfair-engine";
import { LIVE } from "../mode";
import { claimPaidCoins, pay } from "../payments";
import { type SeekerProfile, loadProfile, saveProfile } from "../profile";
import { applyErrorText, myApplications, sendApplication } from "../server-fair";
import { fair, useFair } from "../useFair";
import { WalletPanel } from "../fair/Wallet";
import { type ReferralInfo, inviteLink, inviteText, loadReferral } from "../fair/viral";
import { type JobMatch, canRecommend, recommendBooths, recommendJobs } from "../fair/recommend";

const TYPES = ["Semua", "Full-time", "Kontrak", "Magang", "Part-time"] as const;

function useAccount() {
  const [account, setAccount] = useState<Account | null>(currentAccount);
  useEffect(() => {
    const on = () => setAccount(currentAccount());
    window.addEventListener(ACCOUNT_EVENT, on);
    return () => window.removeEventListener(ACCOUNT_EVENT, on);
  }, []);
  return [account, setAccount] as const;
}

const has = (text: string, q: string) => text.toLowerCase().includes(q);

/**
 * The job fair without the game: every company and vacancy as a plain, searchable list, with
 * recommendations from the seeker's profile and applying in a few taps. For cheap phones, slow
 * connections, screen readers and keyboard users. No canvas, no animation, big tap targets.
 */
export function LiteMode() {
  useFair();
  const [account, setAccount] = useAccount();
  const [profile, setProfile] = useState<SeekerProfile>(loadProfile);
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("Semua");
  const [industry, setIndustry] = useState("");
  const [applying, setApplying] = useState<{
    booth: CompanyBooth;
    job: JobPosting;
  } | null>(null);
  // Signing in first: the vacancy they tapped opens right after.
  const [gate, setGate] = useState<false | { booth: CompanyBooth; job: JobPosting } | true>(false);
  const [wallet, setWallet] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [notice, setNotice] = useState("");
  const [ref, setRef] = useState<ReferralInfo | null>(null);
  useEffect(() => {
    void loadReferral(account).then(setRef);
  }, [account?.id]);

  // Live site: this account's applications and the companies' answers.
  useEffect(() => {
    if (!LIVE || !account) return;
    void myApplications().then((r) => r.ok && fair.mergeServer(r.data.applications, true));
  }, [account?.id]);
  useEffect(() => setProfile(loadProfile()), [account?.id]);

  const booths = fair.fair.booths;
  const mine = fair.applications.filter((a) => a.visitorId === PLAYER_ID);
  const applied = new Set(mine.map((a) => a.jobId));
  const industries = useMemo(() => [...new Set(booths.map((b) => b.industry))].sort(), [booths]);
  const recs = canRecommend(profile) ? recommendJobs(profile, booths, applied, 5) : [];
  const recBooths = canRecommend(profile) ? recommendBooths(profile, booths, applied, 3) : [];
  const needle = q.trim().toLowerCase();
  const list = booths
    .filter((b) => !industry || b.industry === industry)
    .map((b) => ({
      booth: b,
      jobs: openJobs(b).filter(
        (j) => (type === "Semua" || j.type === type) && (!needle || has(`${j.title} ${j.location} ${j.requirements.join(" ")} ${b.company} ${b.industry}`, needle)),
      ),
    }))
    .filter((x) => x.jobs.length);
  const total = list.reduce((n, x) => n + x.jobs.length, 0);

  const startApply = (booth: CompanyBooth, job: JobPosting) => {
    setNotice("");
    if (!account) {
      setGate({ booth, job });
      return;
    }
    setApplying({ booth, job });
  };

  return (
    <div className="lite" lang="id">
      <a className="lite-skip" href="#lite-list">
        Langsung ke daftar lowongan
      </a>
      <header className="lite-top">
        <div>
          <b className="lite-brand">{fair.fair.name}</b>
          <span className="lite-mode">Mode ringan</span>
        </div>
        <nav className="lite-nav" aria-label="Akun">
          {account ? (
            <>
              <button type="button" className="lite-chip" onClick={() => setWallet(true)} aria-label={`Saldo ${fair.player.coins} koin, buka dompet`}>
                {fair.player.coins} koin
              </button>
              <button type="button" className="lite-chip" onClick={() => setEditProfile(true)}>
                Profil
              </button>
            </>
          ) : (
            <button type="button" className="lite-btn" onClick={() => setGate(true)}>
              Masuk
            </button>
          )}
        </nav>
      </header>

      <main className="lite-main">
        <p className="lite-intro">
          {booths.length} perusahaan, {booths.reduce((n, b) => n + openJobs(b).length, 0)} lowongan. Tanpa game, hemat kuota. <a href="#/jobfair">Buka job fair 3D</a>
        </p>
        {notice && (
          <p className="lite-notice" role="status">
            {notice}
          </p>
        )}

        <section className="lite-card" aria-labelledby="lite-rec">
          <h2 id="lite-rec">Cocok untukmu</h2>
          {!canRecommend(profile) ? (
            <>
              <p className="lite-muted">Isi keahlian dan pendidikanmu, nanti kami pilihkan lowongan dan perusahaan yang paling cocok.</p>
              <button type="button" className="lite-btn" onClick={() => setEditProfile(true)}>
                Isi profil singkat
              </button>
            </>
          ) : recs.length === 0 ? (
            <p className="lite-muted">
              Belum ada lowongan yang cocok dengan profilmu. Coba tambah keahlian di{" "}
              <button type="button" className="lite-link" onClick={() => setEditProfile(true)}>
                profil
              </button>
              .
            </p>
          ) : (
            <>
              <ul className="lite-list">
                {recs.map((m) => (
                  <JobRow key={m.job.id} booth={m.booth} job={m.job} match={m} applied={applied.has(m.job.id)} onApply={() => startApply(m.booth, m.job)} />
                ))}
              </ul>
              {recBooths.length > 0 && (
                <p className="lite-muted lite-booths">
                  Stand yang layak dikunjungi:{" "}
                  {recBooths.map((b, i) => (
                    <span key={b.booth.id}>
                      {i > 0 && ", "}
                      <a href={`#lite-${b.booth.id}`}>{b.booth.company}</a> ({b.jobs.length} lowongan cocok)
                    </span>
                  ))}
                </p>
              )}
            </>
          )}
        </section>

        <section className="lite-card" aria-labelledby="lite-search">
          <h2 id="lite-search">Cari lowongan</h2>
          <form className="lite-filters" role="search" onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>Kata kunci</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Posisi, kota, atau keahlian" />
            </label>
            <label>
              <span>Jenis</span>
              <select value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Bidang</span>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">Semua bidang</option>
                {industries.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
          </form>
          <p className="lite-muted" role="status" aria-live="polite">
            {total} lowongan dari {list.length} perusahaan
          </p>
        </section>

        <section id="lite-list" aria-label="Perusahaan dan lowongan" className="lite-companies">
          {list.map(({ booth: b, jobs }) => (
            <details key={b.id} id={`lite-${b.id}`} className="lite-card lite-co" open={!!needle || list.length <= 3}>
              <summary>
                <span className="lite-co-name">
                  <b>{b.company}</b>
                  {b.tier === "premium" && <span className="lite-tag">VIP</span>}
                </span>
                <span className="lite-muted">
                  {b.industry} · {fair.fair.floors[b.floor]?.name ?? ""} · {jobs.length} lowongan
                </span>
              </summary>
              {b.tagline && <p className="lite-muted">{b.tagline}</p>}
              <ul className="lite-list">
                {jobs.map((j) => (
                  <JobRow key={j.id} booth={b} job={j} applied={applied.has(j.id)} onApply={() => startApply(b, j)} />
                ))}
              </ul>
            </details>
          ))}
          {list.length === 0 && <p className="lite-card lite-muted">Tidak ada lowongan yang cocok dengan pencarian ini.</p>}
        </section>

        {account && mine.length > 0 && (
          <section className="lite-card" aria-labelledby="lite-mine">
            <h2 id="lite-mine">Lamaranku</h2>
            <ul className="lite-list">
              {mine.map((a) => (
                <li key={a.id} className="lite-job">
                  <span>
                    <b>{a.jobTitle}</b>
                    <span className="lite-muted">{a.company}</span>
                    {a.interview && (
                      <span className="lite-muted">
                        Interview{" "}
                        {new Date(a.interview.at).toLocaleString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {a.interview.mode}
                      </span>
                    )}
                  </span>
                  <span className="lite-status">{a.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {ref && (
          <section className="lite-card" aria-labelledby="lite-invite">
            <h2 id="lite-invite">Ajak teman</h2>
            <p className="lite-muted">
              Teman yang daftar lewat linkmu dapat {ref.reward} koin, kamu juga. Sudah {ref.friends} teman bergabung.
            </p>
            <p className="lite-invite">
              <a
                className="lite-btn"
                href={`https://wa.me/?text=${encodeURIComponent(inviteText(profile.name || account?.name || "", ref.code, ref.reward))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Kirim lewat WhatsApp
              </a>
              <span className="lite-muted">{inviteLink(ref.code)}</span>
            </p>
          </section>
        )}
      </main>

      {gate && !account && (
        <Sheet title="Masuk dulu untuk melamar" onClose={() => setGate(false)}>
          <AccountGate
            onIn={(a) => {
              setAccount(a);
              if (gate !== true) setApplying(gate);
              setGate(false);
              setProfile(loadProfile());
            }}
          />
        </Sheet>
      )}
      {editProfile && (
        <Sheet title="Profil singkat" onClose={() => setEditProfile(false)}>
          <ProfileForm
            profile={profile}
            onSave={(p) => {
              setProfile(p);
              saveProfile(p);
              setEditProfile(false);
            }}
          />
        </Sheet>
      )}
      {applying && account && (
        <Sheet title={`Lamar ${applying.job.title}`} onClose={() => setApplying(null)}>
          <ApplyLite
            booth={applying.booth}
            job={applying.job}
            profile={profile}
            account={account}
            onTopUp={() => setWallet(true)}
            onDone={(text, p) => {
              setProfile(p);
              saveProfile(p);
              setApplying(null);
              setNotice(text);
            }}
          />
        </Sheet>
      )}
      {wallet && account && (
        <WalletPanel
          player={fair.player}
          stand={fair.fair.coinStand}
          atStand
          canClaim={fair.canClaimDaily()}
          live={LIVE}
          onBuy={async (id, method) => {
            if (!LIVE) {
              const got = fair.buyCoins(id, method);
              return got ? { ok: true, text: `Pembayaran berhasil. +${got} koin.` } : { ok: false, text: "Paket tidak ditemukan." };
            }
            const r = await pay({
              kind: "coins",
              pack: id,
              back: "/play/#/ringan",
            });
            if (!r.ok) return { ok: false, text: r.error };
            if ("redirect" in r) return "redirect";
            await claimPaidCoins();
            return { ok: true, text: "Koin sudah masuk." };
          }}
          onClaim={() => {
            const n = fair.claimDaily();
            if (n) setNotice(`+${n} koin harian masuk.`);
          }}
          onGoToStand={() => setWallet(false)}
          onClose={() => setWallet(false)}
        />
      )}
    </div>
  );
}

function JobRow({ booth, job, match, applied, onApply }: { booth: CompanyBooth; job: JobPosting; match?: JobMatch; applied: boolean; onApply: () => void }) {
  return (
    <li className="lite-job">
      <span>
        <b>{job.title}</b>
        <span className="lite-muted">
          {match ? `${booth.company} · ` : ""}
          {job.type} · {job.location}
          {job.salary ? ` · Rp${job.salary}` : ""}
        </span>
        {match && match.why.length > 0 && <span className="lite-why">Cocok: {match.why.join(", ")}</span>}
        <details className="lite-more">
          <summary>Syarat</summary>
          <ul>
            {job.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {job.description && <p>{job.description}</p>}
          {job.deadline && (
            <p className="lite-muted">
              Batas melamar{" "}
              {new Date(job.deadline).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </details>
      </span>
      {applied ? (
        <span className="lite-status">Sudah melamar</span>
      ) : (
        <button type="button" className="lite-btn" onClick={onApply} aria-label={`Lamar ${job.title} di ${booth.company}`}>
          Lamar
        </button>
      )}
    </li>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => {
      window.removeEventListener("keydown", on);
      back?.focus();
    };
  }, []);
  return (
    <div className="lite-sheet-wrap" onClick={onClose}>
      <div ref={box} className="lite-sheet" role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}>
        <div className="lite-sheet-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="lite-chip" onClick={onClose}>
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProfileForm({ profile, onSave }: { profile: SeekerProfile; onSave: (p: SeekerProfile) => void }) {
  const [p, setP] = useState(profile);
  const field = (key: keyof SeekerProfile, label: string, placeholder: string, hint?: string) => (
    <label className="lite-field">
      <span>{label}</span>
      <input value={(p[key] as string) ?? ""} placeholder={placeholder} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
      {hint && <small className="lite-muted">{hint}</small>}
    </label>
  );
  return (
    <form
      className="lite-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(p);
      }}
    >
      {field("headline", "Status", "Fresh graduate Akuntansi")}
      {field("education", "Pendidikan", "S1 Akuntansi, 2025")}
      {field("skills", "Keahlian", "Excel, pajak, laporan keuangan", "Pisahkan dengan koma.")}
      {field("city", "Domisili", "Surabaya")}
      {field("campus", "Kampus / sekolah", "Universitas Airlangga")}
      <button type="submit" className="lite-btn">
        Simpan
      </button>
    </form>
  );
}

function ApplyLite({
  booth,
  job,
  profile,
  account,
  onTopUp,
  onDone,
}: {
  booth: CompanyBooth;
  job: JobPosting;
  profile: SeekerProfile;
  account: Account;
  onTopUp: () => void;
  onDone: (text: string, profile: SeekerProfile) => void;
}) {
  const [form, setForm] = useState({
    name: profile.name || account.name || "",
    email: profile.email || account.email || "",
    phone: profile.phone,
    cvUrl: profile.cvUrl,
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const voucher = fair.player.vouchers.some((v) => !v.used && v.kind === "free-apply");
  const cost = price("coin.apply");
  const short = !voucher && !fair.canAffordApply();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (short) return onTopUp();
    setBusy(true);
    setError("");
    let id: string | undefined;
    if (LIVE) {
      const res = await sendApplication({
        boothId: booth.id,
        jobId: job.id,
        company: booth.company,
        jobTitle: job.title,
        name: form.name.trim() || account.name || "Pelamar",
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        cvUrl: form.cvUrl.trim() || undefined,
        message: form.message.trim() || undefined,
        headline: profile.headline?.trim() || undefined,
        education: profile.education?.trim() || undefined,
        skills: profile.skills?.trim() || undefined,
        city: profile.city?.trim() || undefined,
        psych: fair.bestPsych() ?? undefined,
      });
      if (!res.ok) {
        setBusy(false);
        return setError(applyErrorText(res.error));
      }
      id = res.data.application.id;
    }
    const a = fair.applyFromList(form.name || account.name || "Pelamar", {
      id,
      boothId: booth.id,
      jobId: job.id,
      ...form,
      headline: profile.headline,
      education: profile.education,
      skills: profile.skills,
      city: profile.city,
      photo: profile.photo,
    });
    setBusy(false);
    const next = {
      ...profile,
      name: form.name || profile.name,
      email: form.email,
      phone: form.phone,
      cvUrl: form.cvUrl,
    };
    if (a) onDone(`Lamaran ${job.title} terkirim ke ${booth.company}.`, next);
    else setError("Lamaran belum terkirim. Coba lagi.");
  };

  return (
    <form className="lite-form" onSubmit={(e) => void submit(e)}>
      <p className="lite-muted">
        {booth.company} · {job.type} · {job.location}
      </p>
      <label className="lite-field">
        <span>Nama lengkap</span>
        <input required value={form.name} onChange={set("name")} autoComplete="name" />
      </label>
      <label className="lite-field">
        <span>Email</span>
        <input required type="email" value={form.email} onChange={set("email")} autoComplete="email" />
      </label>
      <label className="lite-field">
        <span>No. HP / WhatsApp</span>
        <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="08xx" />
      </label>
      <label className="lite-field">
        <span>Link CV</span>
        <input type="url" value={form.cvUrl} onChange={set("cvUrl")} placeholder="https://drive.google.com/…" />
      </label>
      <label className="lite-field">
        <span>Pesan untuk HR (opsional)</span>
        <textarea rows={3} value={form.message} onChange={set("message")} />
      </label>
      {error && (
        <p className="lite-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="lite-btn" disabled={busy}>
        {busy ? "Mengirim…" : short ? `Isi koin dulu (butuh ${cost} koin)` : voucher ? "Kirim lamaran (pakai voucher)" : `Kirim lamaran · ${cost} koin`}
      </button>
    </form>
  );
}
