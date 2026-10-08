import { useState } from "react";
import { type BoothTheme, type CompanyBooth, type JobPosting, fairFloorId } from "@vwo/shared";
import { BOOTH_THEMES, CafeScene, FLOOR_SLOTS, boothExtras, lookFor } from "@vwo/ui";
import { staffLook } from "../JobFair";
import { ACCESSORY_PRODUCTS, rupiah } from "../fair/company";
import { fair } from "../useFair";
import { GateEditor, MediaEditor } from "./MediaEditor";
import { PromoterEditor } from "./PromoterEditor";
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
      hallTitle={fair.fair.name}
      hallBanner
      npcs={rec ? [{ id: rec.id, name: rec.name, floorId, x: rec.x, y: rec.y, facing: rec.facing, look: staffLook(rec.name, booth.color) }] : []}
      avatars={[...fair.visitors.values()].filter((v) => v.floorId === floorId)}
      lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
      bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
      extras={fair.fair.booths.filter((b) => b.floor === booth.floor).flatMap((b) => boothExtras(b))}
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
        <h2 className="cp-h2">Pratinjau stand {booth.tier === "premium" && "👑"}</h2>
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
              style={{ ["--wall" as string]: BOOTH_THEMES[t].wall, ["--base" as string]: BOOTH_THEMES[t].base, ["--post" as string]: BOOTH_THEMES[t].post, ["--c" as string]: booth.color }}
            >
              <span className="cp-theme-swatch" />
              {BOOTH_THEMES[t].name}
            </button>
          ))}
        </div>
        <h2 className="cp-h2">Warna brand</h2>
        <div className="cp-colors">
          {COLORS.map((c) => (
            <button key={c} type="button" className="cp-color" style={{ background: c }} data-active={booth.color === c ? "" : undefined} onClick={() => fair.editBooth(booth.id, { color: c })} aria-label={`Warna ${c}`} />
          ))}
          <label className="cp-color cp-color-pick" title="Warna lain">
            🎨
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
                  <span className="cp-price">👑 Termasuk VIP</span>
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
                  <span className="cp-price">{rupiah(p.price)}</span>
                )}
              </li>
            );
          })}
        </ul>
        {full && <p className="cp-warn">Lantai stand sudah penuh: lepas satu barang lantai dulu.</p>}
        {toBuy.length > 0 && (
          <button type="button" onClick={() => onTab("billing")}>
            🛒 Beli aksesoris
          </button>
        )}
      </div>
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
    industry: booth.industry,
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
  const [saved, flash] = useSaved();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
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
          industry: f.industry.trim(),
          recruiter: f.recruiter.trim() || booth.recruiter,
          about: f.about.trim(),
          website: f.website.trim() || undefined,
          email: f.email.trim() || undefined,
          phone: f.phone.trim() || undefined,
          address: f.address.trim() || undefined,
          founded: Number(f.founded) || undefined,
          employees: f.employees.trim() || undefined,
          benefits: lines(f.benefits),
          socials: lines(f.socials).map((l) => {
            const url = l.match(/https?:\/\/\S+/)?.[0] ?? "";
            return { label: l.replace(url, "").trim() || url, url };
          }).filter((s) => s.url),
        });
        flash();
      }}
    >
      <h2 className="cp-h2 cp-span">Informasi perusahaan</h2>
      {field("company", "Nama perusahaan", { required: true, maxLength: 40 })}
      {field("logo", "Logo (1–3 huruf/emoji)", { required: true, maxLength: 3 })}
      {field("tagline", "Tagline", { maxLength: 80 })}
      {field("industry", "Industri", { maxLength: 40 })}
      {field("recruiter", "Nama recruiter di stand", { maxLength: 30 })}
      {field("employees", "Jumlah karyawan", { placeholder: "200–500" })}
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
            <input value={x.q} onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)))} placeholder="Pertanyaan" maxLength={120} aria-label={`Pertanyaan ${i + 1}`} />
            <textarea rows={2} value={x.a} onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} placeholder="Jawaban" maxLength={400} aria-label={`Jawaban ${i + 1}`} />
          </div>
          <div className="cp-faq-tools">
            <button type="button" className="small-btn ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naik">
              ↑
            </button>
            <button type="button" className="small-btn ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Turun">
              ↓
            </button>
            <button type="button" className="small-btn ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Hapus">
              🗑
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
  const count = (id: string) => fair.applications.filter((a) => a.boothId === booth.id && a.jobId === id).length;
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  };
  if (edit) return <JobForm job={edit} booth={booth} onDone={(msg) => (setEdit(null), msg && flash(msg))} />;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="cp-h2" style={{ margin: 0 }}>
          Lowongan ({booth.jobs.filter((j) => !j.closed).length} aktif)
        </h2>
        <button type="button" onClick={() => setEdit(emptyJob(fair.newJobId(booth.id)))}>
          + Lowongan baru
        </button>
      </div>
      <ul className="cp-jobs">
        {booth.jobs.map((j) => (
          <li key={j.id} data-closed={j.closed ? "" : undefined}>
            <div className="cp-job-main">
              <b>{j.title}</b> {j.closed && <span className="status">Ditutup</span>}
              <span className="muted small">
                {j.type} · {j.location || "-"} {j.salary ? `· ${j.salary}` : ""} {j.deadline ? `· s.d. ${j.deadline}` : ""} · {count(j.id)} pelamar
              </span>
            </div>
            <div className="cp-job-tools">
              <button type="button" className="small-btn ghost" onClick={() => setEdit({ ...j, requirements: [...j.requirements] })}>
                Ubah
              </button>
              <button type="button" className="small-btn ghost" onClick={() => fair.saveJob(booth.id, { ...j, closed: !j.closed })}>
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
                🗑
              </button>
            </div>
          </li>
        ))}
      </ul>
      {toast && <div className="cp-toast">{toast}</div>}
    </div>
  );
}

function JobForm({ job, booth, onDone }: { job: JobPosting; booth: CompanyBooth; onDone: (msg?: string) => void }) {
  const isNew = !booth.jobs.some((j) => j.id === job.id);
  const [f, setF] = useState({ ...job, salary: job.salary ?? "", description: job.description ?? "", deadline: job.deadline ?? "", quota: job.quota ? String(job.quota) : "", req: job.requirements.join("\n") });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="card cp-form"
      onSubmit={(e) => {
        e.preventDefault();
        fair.saveJob(booth.id, {
          id: job.id,
          title: f.title.trim(),
          type: f.type,
          location: f.location.trim(),
          salary: f.salary.trim() || undefined,
          description: f.description.trim() || undefined,
          deadline: f.deadline || undefined,
          quota: Number(f.quota) || undefined,
          closed: job.closed,
          requirements: f.req
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean),
        });
        onDone(isNew ? "Lowongan baru tayang di stand" : "Lowongan diperbarui");
      }}
    >
      <h2 className="cp-h2 cp-span">{isNew ? "Lowongan baru" : `Ubah ${job.title}`}</h2>
      <label>
        Posisi
        <input required value={f.title} onChange={set("title")} maxLength={60} placeholder="Frontend Developer" />
      </label>
      <label>
        Tipe
        <select value={f.type} onChange={set("type")}>
          {(["Full-time", "Kontrak", "Magang", "Part-time"] as const).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Lokasi
        <input required value={f.location} onChange={set("location")} placeholder="Jakarta / Hybrid" />
      </label>
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
      <label className="cp-span">
        Deskripsi pekerjaan
        <textarea rows={4} value={f.description} onChange={set("description")} maxLength={1200} placeholder="Apa yang akan dikerjakan sehari-hari" />
      </label>
      <label className="cp-span">
        Kualifikasi (satu per baris, dipakai untuk menghitung kecocokan pelamar)
        <textarea rows={5} value={f.req} onChange={set("req")} placeholder={"S1 Informatika\nReact, TypeScript\nPengalaman 1 tahun"} />
      </label>
      <div className="row cp-span">
        <button type="submit">{isNew ? "Tayangkan" : "Simpan"}</button>
        <button type="button" className="ghost" onClick={() => onDone()}>
          Batal
        </button>
      </div>
    </form>
  );
}
