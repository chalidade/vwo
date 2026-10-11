import { Palette, Sparkles, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type BoothTheme,
  type CompanyBooth,
  EDUCATION_LIST,
  EMPLOYEE_BANDS,
  EXPERIENCE_LIST,
  INDUSTRY_LIST,
  type JobPosting,
  LOCATION_LIST,
  MAJOR_LIST,
  POSITION_LIST,
  QUALIFICATION_LIST,
  type VipStyle,
  WORK_MODES,
  type WorkMode,
  canOpenAnotherJob,
  employeeBand,
  FEATURED_PRODUCT_ID,
  fairFloorId,
  hasStand,
  isEmployeeBand,
  isFeatured,
  joinList,
  locationText,
  MINI_MAX_OPEN_JOBS,
  parseList,
  UMKM_CORNER,
  workModeOf,
} from "@vwo/shared";
import { ListPicker } from "../pickers";
import { BOOTH_THEMES, BoothLogo, VIP_STYLES, CafeScene, FLOOR_SLOTS, boothExtras, lookFor } from "@vwo/ui";
import { readImageFile } from "../imageFile";
import { staffLook } from "../fair/staff-look";
import { ACCESSORY_PRODUCTS, coinText } from "../fair/company";
import { fair } from "../useFair";
import { GateEditor, MediaEditor } from "./MediaEditor";
import { PromoterEditor } from "./PromoterEditor";
import { JobCandidates } from "./TalentPool";
import type { PortalTab } from "./Portal";

const COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#84cc16", "#eab308", "#f97316", "#dc2626", "#db2777", "#9333ea", "#4f46e5", "#334155"];

function Saved({ show }: { show: boolean }) {
  return show ? <span className="cp-saved">✓ Tersimpan, langsung tampil di job fair</span> : null;
}

function useSaved() {
  const [saved, setSaved] = useState(false);
  return [
    saved,
    () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  ] as const;
}

/** How the booth looks in the hall, live. */
export function BoothPreview({ booth }: { booth: CompanyBooth }) {
  const floorId = fairFloorId(fair.fair, booth.floor);
  const floor = fair.floor(floorId);
  const rec = fair.staff.find((s) => s.boothId === booth.id);
  return (
    <CafeScene
      className="cp-preview"
      floor={floor}
      occupiedSeatIds={new Set()}
      follow={{ x: booth.x + 3, y: booth.y + 1.2 }}
      hallTitle={fair.hallBanner(booth.floor).title}
      hallSubtitle={fair.hallBanner(booth.floor).subtitle}
      hallBanner
      npcs={rec ? [{ id: rec.id, name: rec.name, floorId, x: rec.x, y: rec.y, facing: rec.facing, look: staffLook(rec.name, booth.color) }] : []}
      avatars={[...fair.visitors.values()].filter((v) => v.floorId === floorId)}
      lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
      bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
      extras={fair.fair.booths.filter((b) => b.floor === booth.floor && hasStand(b)).flatMap((b) => boothExtras(b))}
    />
  );
}

export function BoothEditor({ booth, onTab }: { booth: CompanyBooth; onTab: (t: PortalTab) => void }) {
  const [ticker, setTicker] = useState(booth.ticker ?? "");
  const [callouts, setCallouts] = useState((booth.callouts ?? []).join("\n"));
  const [full, setFull] = useState(false);
  const [saved, flash] = useSaved();
  const on = new Set(booth.accessories ?? []);
  const floorUsed = ACCESSORY_PRODUCTS.filter((p) => p.slot === "floor" && on.has(p.id)).length;
  const toBuy = ACCESSORY_PRODUCTS.filter((p) => !fair.owns(booth.id, p.id));

  return (
    <div className="cp-grid">
      <div className="card cp-wide">
        <h2 className="cp-h2">Pratinjau stand {booth.tier === "premium" && <span className="cp-vip">VIP</span>}</h2>
        <BoothPreview booth={booth} />
        <p className="muted small">Semua perubahan langsung terlihat oleh pengunjung job fair.</p>
      </div>
      <div className="card">
        <h2 className="cp-h2">Tema</h2>
        <div className="cp-themes">
          {(Object.keys(BOOTH_THEMES) as BoothTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              className="cp-theme"
              data-active={(booth.theme ?? "classic") === t ? "" : undefined}
              onClick={() => fair.editBooth(booth.id, { theme: t })}
              style={{
                ["--wall" as string]: BOOTH_THEMES[t].wall,
                ["--base" as string]: BOOTH_THEMES[t].base,
                ["--post" as string]: BOOTH_THEMES[t].post,
                ["--c" as string]: booth.color,
              }}
            >
              <span className="cp-theme-swatch" />
              {BOOTH_THEMES[t].name}
            </button>
          ))}
        </div>
        <h2 className="cp-h2">Warna brand</h2>
        <div className="cp-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="cp-color"
              style={{ background: c }}
              data-active={booth.color === c ? "" : undefined}
              onClick={() => fair.editBooth(booth.id, { color: c })}
              aria-label={`Warna ${c}`}
            />
          ))}
          <label className="cp-color cp-color-pick" title="Warna lain">
            <Palette size={18} aria-hidden />
            <input type="color" value={booth.color} onChange={(e) => fair.editBooth(booth.id, { color: e.target.value })} aria-label="Pilih warna lain" />
          </label>
        </div>
      </div>
      <div className="card">
        <h2 className="cp-h2">Aksesoris</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Barang lantai {floorUsed}/{FLOOR_SLOTS}. Aksesoris berbayar dibeli sekali untuk seluruh acara.
        </p>
        <ul className="cp-acc">
          {ACCESSORY_PRODUCTS.map((p) => {
            const owned = fair.owns(booth.id, p.id);
            return (
              <li key={p.id} data-on={on.has(p.id) ? "" : undefined}>
                <span className="cp-acc-emoji">{p.emoji}</span>
                <span className="cp-acc-main">
                  <b>{p.name}</b>
                  <span className="muted small">{p.about}</span>
                </span>
                {p.id === "gapura" && booth.tier === "premium" ? (
                  <span className="cp-price">Termasuk VIP</span>
                ) : owned ? (
                  <button
                    type="button"
                    className="small-btn"
                    data-on={on.has(p.id) ? "" : undefined}
                    onClick={() => {
                      if (!fair.toggleAccessory(booth.id, p.id)) {
                        setFull(true);
                        setTimeout(() => setFull(false), 2500);
                      }
                    }}
                  >
                    {on.has(p.id) ? "✓ Dipasang" : "Pasang"}
                  </button>
                ) : (
                  <span className="cp-price">{coinText(p.price)}</span>
                )}
              </li>
            );
          })}
        </ul>
        {full && <p className="cp-warn">Lantai stand sudah penuh: lepas satu barang lantai dulu.</p>}
        {toBuy.length > 0 && (
          <button type="button" onClick={() => onTab("billing")}>
            Beli aksesoris
          </button>
        )}
      </div>
      <VipEditor booth={booth} onTab={onTab} />
      <GateEditor booth={booth} />
      <MediaEditor booth={booth} />
      <PromoterEditor booth={booth} onTab={onTab} />
      <div className="card">
        <h2 className="cp-h2">Teks LED & sapaan recruiter</h2>
        <form
          className="cp-form"
          onSubmit={(e) => {
            e.preventDefault();
            fair.editBooth(booth.id, {
              ticker: ticker.trim(),
              callouts: callouts
                .split("\n")
                .map((c) => c.trim())
                .filter(Boolean)
                .slice(0, 6),
            });
            flash();
          }}
        >
          <label className="cp-span">
            Teks LED berjalan {booth.tier !== "premium" && <span className="muted small">(tampil di stand VIP)</span>}
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} maxLength={120} placeholder={`${booth.company} · walk-in interview hari ini!`} />
          </label>
          <label className="cp-span">
            Sapaan recruiter ke pengunjung (satu per baris)
            <textarea rows={4} value={callouts} onChange={(e) => setCallouts(e.target.value)} placeholder={"Mampir yuk, ada doorprize!\nWalk-in interview jam 13.00"} />
          </label>
          <div className="row">
            <button type="submit">Simpan</button>
            <Saved show={saved} />
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProfileEditor({ booth }: { booth: CompanyBooth }) {
  const [f, setF] = useState({
    company: booth.company,
    logo: booth.logo,
    tagline: booth.tagline,
    recruiter: booth.recruiter,
    about: booth.about,
    website: booth.website ?? "",
    email: booth.email ?? "",
    phone: booth.phone ?? "",
    address: booth.address ?? "",
    founded: booth.founded ? String(booth.founded) : "",
    employees: booth.employees ?? "",
    benefits: (booth.benefits ?? []).join("\n"),
    socials: (booth.socials ?? []).map((s) => `${s.label} ${s.url}`).join("\n"),
  });
  /** Up to three industries from the list; an old free-typed one stays until it is removed. */
  const [industry, setIndustry] = useState(() => parseList(INDUSTRY_LIST, booth.industry, 40));
  const [saved, flash] = useSaved();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const oldEmployees = booth.employees && !isEmployeeBand(booth.employees) ? booth.employees : "";
  const suggestBand = employeeBand(oldEmployees);
  const field = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input value={f[k]} onChange={set(k)} {...props} />
    </label>
  );
  return (
    <form
      className="card cp-form cp-profile"
      onSubmit={(e) => {
        e.preventDefault();
        const lines = (s: string) =>
          s
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
        fair.editBooth(booth.id, {
          company: f.company.trim(),
          logo: f.logo,
          tagline: f.tagline.trim(),
          industry: joinList(INDUSTRY_LIST, industry),
          recruiter: f.recruiter.trim() || booth.recruiter,
          about: f.about.trim(),
          website: f.website.trim() || undefined,
          email: f.email.trim() || undefined,
          phone: f.phone.trim() || undefined,
          address: f.address.trim() || undefined,
          founded: Number(f.founded) || undefined,
          employees: f.employees.trim() || undefined,
          benefits: lines(f.benefits),
          socials: lines(f.socials)
            .map((l) => {
              const url = l.match(/https?:\/\/\S+/)?.[0] ?? "";
              return { label: l.replace(url, "").trim() || url, url };
            })
            .filter((s) => s.url),
        });
        flash();
      }}
    >
      <h2 className="cp-h2 cp-span">Informasi perusahaan</h2>
      <LogoUpload booth={booth} />
      {field("company", "Nama perusahaan", { required: true, maxLength: 40 })}
      {field("logo", "Logo teks (1–3 huruf/emoji, dipakai jika belum ada gambar)", { required: true, maxLength: 3 })}
      {field("tagline", "Tagline", { maxLength: 80 })}
      {field("recruiter", "Nama recruiter di stand", { maxLength: 30 })}
      <label>
        Jumlah karyawan
        <select value={f.employees} onChange={set("employees")}>
          <option value="">Pilih jumlah karyawan</option>
          {oldEmployees && <option value={oldEmployees}>{oldEmployees} (isian lama)</option>}
          {EMPLOYEE_BANDS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        {f.employees === oldEmployees && suggestBand && <small className="muted">Pilih rentang, mis. {suggestBand}</small>}
      </label>
      <div className="cp-span">
        <ListPicker list={INDUSTRY_LIST} value={industry} onChange={setIndustry} label="Industri" noun="industri" hint={`maks. ${INDUSTRY_LIST.max}`} />
      </div>
      {field("founded", "Tahun berdiri", { type: "number", min: 1900, max: 2100 })}
      {field("website", "Website", { type: "url", placeholder: "https://" })}
      {field("email", "Email HR", { type: "email" })}
      {field("phone", "No. HP / WhatsApp HR", { type: "tel", placeholder: "08xx" })}
      <label className="cp-span">
        Alamat kantor
        <input value={f.address} onChange={set("address")} />
      </label>
      <label className="cp-span">
        Tentang perusahaan
        <textarea rows={4} value={f.about} onChange={set("about")} maxLength={800} />
      </label>
      <label>
        Benefit (satu per baris)
        <textarea rows={5} value={f.benefits} onChange={set("benefits")} placeholder={"BPJS & asuransi\nWFH 2x seminggu"} />
      </label>
      <label>
        Sosial media (nama lalu link, satu per baris)
        <textarea rows={5} value={f.socials} onChange={set("socials")} placeholder="Instagram https://instagram.com/..." />
      </label>
      <div className="row cp-span">
        <button type="submit">Simpan profil</button>
        <Saved show={saved} />
      </div>
    </form>
  );
}

export function FaqEditor({ booth }: { booth: CompanyBooth }) {
  const [items, setItems] = useState(booth.faq.map((x) => ({ ...x })));
  const [saved, flash] = useSaved();
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, x!);
    setItems(next);
  };
  return (
    <form
      className="card cp-form"
      onSubmit={(e) => {
        e.preventDefault();
        fair.editBooth(booth.id, { faq: items.filter((x) => x.q.trim() && x.a.trim()).map((x) => ({ q: x.q.trim(), a: x.a.trim() })) });
        flash();
      }}
    >
      <h2 className="cp-h2 cp-span">FAQ stand</h2>
      <p className="muted small cp-span" style={{ margin: 0 }}>
        Pertanyaan ini muncul saat pengunjung ngobrol dengan {booth.recruiter}, dan recruiter menjawab dengan jawabanmu.
      </p>
      {items.map((x, i) => (
        <div key={i} className="cp-faq cp-span">
          <span className="cp-faq-no">{i + 1}</span>
          <div className="cp-faq-fields">
            <input
              value={x.q}
              onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))}
              placeholder="Pertanyaan"
              maxLength={120}
              aria-label={`Pertanyaan ${i + 1}`}
            />
            <textarea
              rows={2}
              value={x.a}
              onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))}
              placeholder="Jawaban"
              maxLength={400}
              aria-label={`Jawaban ${i + 1}`}
            />
          </div>
          <div className="cp-faq-tools">
            <button type="button" className="small-btn ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naik">
              ↑
            </button>
            <button type="button" className="small-btn ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Turun">
              ↓
            </button>
            <button type="button" className="small-btn ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Hapus">
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        </div>
      ))}
      <div className="row cp-span">
        <button type="button" className="ghost" onClick={() => setItems([...items, { q: "", a: "" }])} disabled={items.length >= 12}>
          + Tambah pertanyaan
        </button>
        <button type="submit">Simpan FAQ</button>
        <Saved show={saved} />
      </div>
    </form>
  );
}

const emptyJob = (id: string): JobPosting => ({ id, title: "", type: "Full-time", location: "", salary: "", requirements: [], description: "" });

export function JobsEditor({ booth }: { booth: CompanyBooth }) {
  const [edit, setEdit] = useState<JobPosting | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** The vacancy whose "Kandidat cocok" is open. */
  const [cands, setCands] = useState<string | null>(null);
  const count = (id: string) => fair.applications.filter((a) => a.boothId === booth.id && a.jobId === id).length;
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  };
  /** The mini (UMKM) package keeps one open vacancy: another opens only after one is closed. */
  const full = !canOpenAnotherJob(booth);
  const canFeature = fair.owns(booth.id, FEATURED_PRODUCT_ID);
  if (edit) return <JobForm job={edit} booth={booth} onDone={(msg) => (setEdit(null), msg && flash(msg))} />;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="cp-h2" style={{ margin: 0 }}>
          Lowongan ({booth.jobs.filter((j) => !j.closed).length} aktif)
        </h2>
        <button type="button" disabled={full} title={full ? "Tutup lowongan aktif dulu" : undefined} onClick={() => setEdit(emptyJob(fair.newJobId(booth.id)))}>
          + Lowongan baru
        </button>
      </div>
      {!hasStand(booth) && (
        <p className="muted small">
          Paket mini UMKM: {MINI_MAX_OPEN_JOBS} lowongan aktif, tampil di {UMKM_CORNER}. Untuk membuka lowongan lain, tutup lowongan yang aktif dulu.
        </p>
      )}
      <p className="muted small">
        {canFeature
          ? "Lowongan unggulan aktif: tandai satu lowongan dengan bintang supaya tampil paling atas di daftar lowongan."
          : "Beli Lowongan unggulan di tab Koin & belanja supaya satu lowongan tampil paling atas di daftar lowongan."}
      </p>
      <ul className="cp-jobs">
        {booth.jobs.map((j) => (
          <li key={j.id} data-closed={j.closed ? "" : undefined}>
            <div className="cp-job-main">
              <b>{j.title}</b> {j.closed && <span className="status">Ditutup</span>} {isFeatured(booth, j.id) && <span className="status">Unggulan</span>}
              <span className="muted small">
                {j.type} · {j.location || "-"} {j.salary ? `· ${j.salary}` : ""} {j.deadline ? `· s.d. ${j.deadline}` : ""} · {count(j.id)} pelamar
              </span>
            </div>
            <div className="cp-job-tools">
              {!j.closed && (
                <button type="button" className="small-btn ghost" aria-expanded={cands === j.id} onClick={() => setCands(cands === j.id ? null : j.id)}>
                  <Sparkles size={16} aria-hidden /> Kandidat cocok
                </button>
              )}
              {canFeature && !j.closed && (
                <button
                  type="button"
                  className="small-btn ghost"
                  aria-pressed={isFeatured(booth, j.id)}
                  title={isFeatured(booth, j.id) ? "Lepas dari unggulan" : "Jadikan lowongan unggulan"}
                  onClick={() => fair.setFeaturedJob(booth.id, isFeatured(booth, j.id) ? null : j.id)}
                >
                  <Star size={16} aria-hidden fill={isFeatured(booth, j.id) ? "currentColor" : "none"} />
                </button>
              )}
              <button type="button" className="small-btn ghost" onClick={() => setEdit({ ...j, requirements: [...j.requirements] })}>
                Ubah
              </button>
              <button
                type="button"
                className="small-btn ghost"
                disabled={j.closed && full}
                title={j.closed && full ? `Paket mini UMKM: ${MINI_MAX_OPEN_JOBS} lowongan aktif` : undefined}
                onClick={() => fair.saveJob(booth.id, { ...j, closed: !j.closed })}
              >
                {j.closed ? "Buka lagi" : "Tutup"}
              </button>
              <button
                type="button"
                className="small-btn ghost"
                onClick={() => {
                  if (!confirm(`Hapus lowongan ${j.title}?`)) return;
                  flash(fair.deleteJob(booth.id, j.id) === "closed" ? "Sudah ada pelamar, jadi lowongan ditutup (riwayat pelamar tetap ada)" : "Lowongan dihapus");
                }}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
            {cands === j.id && !j.closed && <JobCandidates booth={booth} job={j} />}
          </li>
        ))}
      </ul>
      {toast && <div className="cp-toast">{toast}</div>}
    </div>
  );
}

function JobForm({ job, booth, onDone }: { job: JobPosting; booth: CompanyBooth; onDone: (msg?: string) => void }) {
  const isNew = !booth.jobs.some((j) => j.id === job.id);
  const [f, setF] = useState({
    type: job.type,
    salary: job.salary ?? "",
    description: job.description ?? "",
    deadline: job.deadline ?? "",
    quota: job.quota ? String(job.quota) : "",
    mode: workModeOf(job.location) as WorkMode,
  });
  // The list fields, as chips. Text saved before the lists stays as the company's own entries.
  const [lists, setLists] = useState(() => ({
    title: parseList(POSITION_LIST, job.title, 60),
    places: parseList(LOCATION_LIST, job.city),
    education: parseList(EDUCATION_LIST, job.education),
    major: parseList(MAJOR_LIST, job.major),
    experience: parseList(EXPERIENCE_LIST, job.experience),
    requirements: parseList(QUALIFICATION_LIST, job.requirements),
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const pick = (k: keyof typeof lists) => (v: string[]) => setLists((was) => ({ ...was, [k]: v }));
  /** A location typed before the regions list, kept until places are picked. */
  const oldLocation = !job.city && job.location ? job.location : "";
  const location = lists.places.length || f.mode === "Remote" ? locationText(lists.places, f.mode) : oldLocation;
  return (
    <form
      className="card cp-form cp-job-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!lists.title.length) return setError("Pilih posisi dulu.");
        if (!location) return setError("Pilih kabupaten/kota tempat kerja, atau sistem kerja Remote.");
        const ok = fair.saveJob(booth.id, {
          id: job.id,
          title: joinList(POSITION_LIST, lists.title),
          type: f.type,
          location,
          salary: f.salary.trim() || undefined,
          description: f.description.trim() || undefined,
          deadline: f.deadline || undefined,
          quota: Number(f.quota) || undefined,
          education: joinList(EDUCATION_LIST, lists.education) || undefined,
          major: joinList(MAJOR_LIST, lists.major) || undefined,
          experience: joinList(EXPERIENCE_LIST, lists.experience) || undefined,
          city: joinList(LOCATION_LIST, lists.places) || undefined,
          closed: job.closed,
          requirements: lists.requirements,
        });
        if (!ok) return onDone(`Paket mini UMKM hanya ${MINI_MAX_OPEN_JOBS} lowongan aktif. Tutup lowongan yang aktif dulu.`);
        onDone(isNew ? (hasStand(booth) ? "Lowongan baru tayang di stand" : `Lowongan baru tayang di ${UMKM_CORNER}`) : "Lowongan diperbarui");
      }}
    >
      <h2 className="cp-h2 cp-span">{isNew ? "Lowongan baru" : `Ubah ${job.title}`}</h2>
      <div className="cp-span">
        <ListPicker
          list={POSITION_LIST}
          value={lists.title}
          onChange={pick("title")}
          label="Posisi"
          noun="posisi"
          placeholder="Ketik, mis. Admin, Kasir, Developer"
          hint={`maks. ${POSITION_LIST.max}`}
        />
      </div>
      <label>
        Tipe
        <select value={f.type} onChange={set("type")}>
          {(["Full-time", "Kontrak", "Magang", "Part-time"] as const).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Sistem kerja
        <select value={f.mode} onChange={set("mode")}>
          {WORK_MODES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <div className="cp-span">
        <ListPicker
          list={LOCATION_LIST}
          value={lists.places}
          onChange={pick("places")}
          label="Lokasi (kabupaten/kota)"
          noun="kabupaten/kota"
          placeholder="Ketik kota atau kabupaten"
          hint={`maks. ${LOCATION_LIST.max}`}
        />
        {oldLocation && !lists.places.length && <small className="pk-hint">Lokasi lama: {oldLocation}. Pilih dari daftar supaya mudah dicari dan dilaporkan.</small>}
      </div>
      <label>
        Gaji per bulan
        <input value={f.salary} onChange={set("salary")} placeholder="8–12 jt" />
      </label>
      <label>
        Batas melamar
        <input type="date" value={f.deadline} onChange={set("deadline")} />
      </label>
      <label>
        Kebutuhan (orang)
        <input type="number" min={1} max={999} value={f.quota} onChange={set("quota")} />
      </label>
      <p className="cp-span muted small" style={{ margin: "4px 0 0" }}>
        Untuk lapor lowongan ke SIAPkerja/Karirhub (opsional, tidak tampil di stand):
      </p>
      <div className="cp-span">
        <ListPicker list={EDUCATION_LIST} value={lists.education} onChange={pick("education")} label="Pendidikan" noun="pendidikan" hint="boleh lebih dari satu" />
      </div>
      <div className="cp-span">
        <ListPicker list={EXPERIENCE_LIST} value={lists.experience} onChange={pick("experience")} label="Pengalaman" noun="pengalaman" hint={`maks. ${EXPERIENCE_LIST.max}`} />
      </div>
      <div className="cp-span">
        <ListPicker
          list={MAJOR_LIST}
          value={lists.major}
          onChange={pick("major")}
          label="Jurusan"
          noun="jurusan"
          placeholder="Ketik, mis. Akuntansi, SMK, Informatika"
          hint={`maks. ${MAJOR_LIST.max}`}
        />
      </div>
      <label className="cp-span">
        Deskripsi pekerjaan
        <textarea rows={4} value={f.description} onChange={set("description")} maxLength={1200} placeholder="Apa yang akan dikerjakan sehari-hari" />
      </label>
      <div className="cp-span">
        <ListPicker
          list={QUALIFICATION_LIST}
          value={lists.requirements}
          onChange={pick("requirements")}
          label="Kualifikasi"
          noun="kualifikasi"
          placeholder="Ketik, mis. Excel, komunikatif, SIM C"
          hint="dipakai untuk menghitung kecocokan pelamar"
        />
      </div>
      {error && <p className="cp-warn cp-span">{error}</p>}
      <div className="row cp-span">
        <button type="submit">{isNew ? "Tayangkan" : "Simpan"}</button>
        <button type="button" className="ghost" onClick={() => onDone()}>
          Batal
        </button>
      </div>
    </form>
  );
}

/** The company's logo picture: shown on the booth sign, the roll-up banner, invites and the portal. */
function LogoUpload({ booth }: { booth: CompanyBooth }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, flash] = useSaved();
  return (
    <div className="cp-span cp-logo-up">
      <BoothLogo booth={booth} className="cp-logo cp-logo-big" />
      <div className="cp-logo-up-main">
        <b>Logo perusahaan</b>
        <span className="muted small">PNG, JPG, atau WebP. Gambar dipotong persegi dan tampil bulat di papan nama stand.</span>
        <div className="row">
          <label className="small-btn cp-file">
            {booth.logoImg ? "Ganti logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setError(null);
                readImageFile(file, 160)
                  .then((logoImg) => {
                    fair.editBooth(booth.id, { logoImg });
                    flash();
                  })
                  .catch((err: Error) => setError(err.message));
              }}
            />
          </label>
          {booth.logoImg && (
            <button type="button" className="small-btn ghost" onClick={() => fair.editBooth(booth.id, { logoImg: undefined })}>
              Hapus gambar
            </button>
          )}
          <Saved show={saved} />
        </div>
        {error && <span className="cp-warn">{error}</span>}
      </div>
    </div>
  );
}

/** The VIP look: five styles and the words on the big backdrop. Other stands see what they would get. */
function VipEditor({ booth, onTab }: { booth: CompanyBooth; onTab: (t: PortalTab) => void }) {
  const vip = booth.tier === "premium";
  const current: VipStyle = booth.vipStyle ?? "emas";
  const [l1, setL1] = useState(booth.vipHeadline?.[0] ?? "");
  const [l2, setL2] = useState(booth.vipHeadline?.[1] ?? "");
  const [saved, flash] = useSaved();
  return (
    <div className="card cp-vip-card" data-locked={vip ? undefined : ""}>
      <h2 className="cp-h2">Tampilan VIP {!vip && <span className="cp-lock">Khusus VIP</span>}</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {vip
          ? "Pilih gaya stand supaya beda dari stand VIP lain. Langsung tampil di job fair."
          : "Stand VIP bisa memilih salah satu gaya ini, lengkap dengan layar video, lounge, dan gapura."}
      </p>
      <div className="cp-vip-styles">
        {(Object.keys(VIP_STYLES) as VipStyle[]).map((k) => {
          const v = VIP_STYLES[k];
          return (
            <button
              key={k}
              type="button"
              className="cp-vip-style"
              data-active={vip && current === k ? "" : undefined}
              disabled={!vip}
              onClick={() => fair.editBooth(booth.id, { vipStyle: k })}
              style={{ ["--trim" as string]: v.trim, ["--truss" as string]: v.truss, ["--wing" as string]: v.wing ?? booth.color, ["--runner" as string]: v.runner }}
            >
              <span className="cp-vip-sw" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <b>{v.name}</b>
              <span>{v.about}</span>
            </button>
          );
        })}
      </div>
      {vip ? (
        <form
          className="cp-form"
          onSubmit={(e) => {
            e.preventDefault();
            fair.editBooth(booth.id, { vipHeadline: [l1.trim(), l2.trim()] });
            flash();
          }}
        >
          <label>
            Tulisan backdrop, baris 1
            <input value={l1} onChange={(e) => setL1(e.target.value)} maxLength={9} placeholder="WE’RE" />
          </label>
          <label>
            Baris 2
            <input value={l2} onChange={(e) => setL2(e.target.value)} maxLength={9} placeholder="HIRING" />
          </label>
          <div className="row cp-span">
            <button type="submit">Simpan</button>
            <Saved show={saved} />
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => onTab("billing")}>
          Upgrade ke VIP
        </button>
      )}
    </div>
  );
}
