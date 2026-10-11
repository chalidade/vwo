// The company's talent pool: everyone who ever applied to its booth(s), kept after the event so the
// company can reach them again, and "Kandidat cocok" for each vacancy. The live site reads both from
// the server (which also finds opted-in seekers who never applied); the demo works them out from the
// applications in this browser with the same functions.
import { MessageCircle, Send, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type Candidate,
  type CompanyBooth,
  EDUCATION_FILTERS,
  type JobPosting,
  type PoolApplication,
  type PoolFacets,
  type PoolFilter,
  type PoolMember,
  filterPool,
  offerMessage,
  openJobs,
  pageOf,
  poolFacets,
  poolMembers,
  rankCandidates,
  safeUrl,
} from "@vwo/shared";
import { LIVE } from "../mode";
import { boothPool, jobCandidates, offerErrorText, offerJob } from "../server-fair";
import { fair } from "../useFair";
import { PIPELINE } from "../fair/company";

const day = (at: number) => new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Demo: this booth's applications in the browser, as the pool reads them. */
function localPool(boothId: string): PoolMember[] {
  const apps: PoolApplication[] = fair.applications
    .filter((a) => a.boothId === boothId)
    .map((a) => ({
      id: a.id,
      seeker: a.visitorId,
      boothId: a.boothId,
      jobId: a.jobId,
      jobTitle: a.jobTitle,
      status: a.status,
      at: a.at,
      data: a as unknown as Record<string, unknown>,
    }));
  return poolMembers(apps);
}

/** Send "Tawarkan lowongan". Demo: as a chat message on their last application here. Returns an error text, or null when sent. */
async function sendOffer(booth: CompanyBooth, m: PoolMember, job: JobPosting, note: string): Promise<string | null> {
  if (LIVE) {
    const r = await offerJob(booth.id, m.seeker, job.id, note);
    return r.ok ? null : offerErrorText(r.error);
  }
  const last = m.applications.find((a) => a.boothId === booth.id);
  if (!last) return offerErrorText("not_found");
  fair.messageApplicant(last.id, offerMessage({ jobTitle: job.title, note: note.trim() || undefined }));
  return null;
}

/** Vacancies a member can still be offered: open, and not ones they applied to. */
const offerable = (booth: CompanyBooth, m: PoolMember) => openJobs(booth).filter((j) => !m.applications.some((a) => a.boothId === booth.id && a.jobId === j.id));

export function TalentPool({ booth, onChat }: { booth: CompanyBooth; onChat: (applicationId: string) => void }) {
  const [filter, setFilter] = useState<PoolFilter>({});
  const [page, setPage] = useState(0);
  const [live, setLive] = useState<{ members: PoolMember[]; total: number; pageSize: number; facets: PoolFacets } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const key = JSON.stringify(filter);

  useEffect(() => {
    if (!LIVE) return;
    let gone = false;
    const t = window.setTimeout(
      () =>
        void boothPool(booth.id, filter, page).then((r) => {
          if (gone) return;
          if (r.ok) setLive(r.data);
          setError(r.ok ? null : r.error === "not_allowed" ? "Akun ini belum terdaftar di stand ini." : "Talent pool belum bisa dimuat. Coba lagi sebentar lagi.");
        }),
      250,
    );
    return () => {
      gone = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booth.id, key, page]);

  const demoAll = useMemo(() => (LIVE ? [] : localPool(booth.id)), [booth.id, fair.applications.length]);
  const view = LIVE
    ? (live ?? { members: [], total: 0, pageSize: 30, facets: { skills: [], cities: [] } })
    : (() => {
        const p = pageOf(filterPool(demoAll, filter), page);
        return { members: p.items, total: p.total, pageSize: p.pageSize, facets: poolFacets(demoAll) };
      })();
  const pages = Math.max(1, Math.ceil(view.total / view.pageSize));
  const set = (k: keyof PoolFilter) => (e: { target: { value: string } }) => {
    setFilter((f) => ({ ...f, [k]: e.target.value || undefined }));
    setPage(0);
  };
  const open = openId ? view.members.find((m) => m.seeker === openId) : undefined;

  return (
    <div className="cp-apps" data-open={open ? "" : undefined}>
      <div className="card cp-apps-list">
        <p className="muted small" style={{ marginTop: 0 }}>
          Semua orang yang pernah melamar ke stand kamu, termasuk dari event sebelumnya. Tawarkan lowongan baru ke mereka tanpa menunggu event berikutnya.
        </p>
        <div className="cp-filters">
          <input type="search" placeholder="Cari nama, keahlian..." value={filter.q ?? ""} onChange={set("q")} aria-label="Cari di talent pool" maxLength={80} />
          <select value={filter.skill ?? ""} onChange={set("skill")} aria-label="Keahlian">
            <option value="">Semua keahlian</option>
            {view.facets.skills.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value} ({s.n})
              </option>
            ))}
          </select>
          <select value={filter.city ?? ""} onChange={set("city")} aria-label="Domisili">
            <option value="">Semua domisili</option>
            {view.facets.cities.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value} ({s.n})
              </option>
            ))}
          </select>
          <select value={filter.education ?? ""} onChange={set("education")} aria-label="Pendidikan">
            <option value="">Semua pendidikan</option>
            {EDUCATION_FILTERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={filter.status ?? ""} onChange={set("status")} aria-label="Status lamaran">
            <option value="">Semua status</option>
            {PIPELINE.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {error && <p className="bk-err">{error}</p>}
        {view.members.length === 0 ? (
          <p className="muted">
            {key === "{}"
              ? "Talent pool masih kosong. Setiap pelamar di stand kamu otomatis masuk ke sini dan tetap tersimpan setelah event selesai."
              : "Tidak ada yang cocok dengan filter."}
          </p>
        ) : (
          <ul className="cp-app-list">
            {view.members.map((m) => (
              <li key={m.seeker}>
                <button type="button" className="cp-app-row tp-row" data-active={m.seeker === openId ? "" : undefined} onClick={() => setOpenId(m.seeker)}>
                  <UserRound size={20} aria-hidden />
                  <span className="cp-app-main">
                    <b>{m.name}</b>
                    <span className="muted small">
                      {[m.headline, m.city].filter(Boolean).join(" · ") || "Pelamar"} · {m.applications.length} lamaran · terakhir {day(m.lastAt)}
                    </span>
                  </span>
                  {!m.contactable && <span className="status">Tidak mau dihubungi</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="row tp-pages">
            <button type="button" className="small-btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </button>
            <span className="muted small">
              Halaman {page + 1} dari {pages} · {view.total} orang
            </span>
            <button type="button" className="small-btn ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              Berikutnya
            </button>
          </div>
        )}
      </div>
      {open ? (
        <PoolDetail key={open.seeker} booth={booth} member={open} onChat={onChat} onBack={() => setOpenId(null)} />
      ) : (
        <div className="card cp-empty muted">Pilih orang untuk melihat detail.</div>
      )}
    </div>
  );
}

function PoolDetail({ booth, member: m, onChat, onBack }: { booth: CompanyBooth; member: PoolMember; onChat: (applicationId: string) => void; onBack: () => void }) {
  const jobs = offerable(booth, m);
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const here = m.applications.find((a) => a.boothId === booth.id);
  const elsewhere = m.applications.find((a) => a.boothId !== booth.id);
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  };
  return (
    <div className="card cp-detail">
      <button type="button" className="small-btn ghost cp-back" onClick={onBack}>
        ← Talent pool
      </button>
      <h2 className="cp-h2" style={{ margin: 0 }}>
        {m.name}
      </h2>
      <span className="muted small">{m.headline || "Pelamar"}</span>
      <div className="cp-call-row">
        {here ? (
          <button type="button" onClick={() => onChat(here.id)}>
            <MessageCircle size={16} aria-hidden /> Chat
          </button>
        ) : elsewhere ? (
          <a className="small-btn cp-link" href={`#/jobfair/company/${elsewhere.boothId}`}>
            <MessageCircle size={16} aria-hidden /> Chat di stand {elsewhere.boothId}
          </a>
        ) : null}
        {m.email && /^[^\s@?&#]+@[^\s@?&#]+$/.test(m.email) && (
          <a className="small-btn ghost cp-link" href={`mailto:${m.email}?subject=${encodeURIComponent(`Lowongan di ${booth.company}`)}`}>
            Email
          </a>
        )}
      </div>
      <dl className="cp-facts">
        <dt>Email</dt>
        <dd>{m.email || "-"}</dd>
        <dt>No. HP</dt>
        <dd>{m.phone || "-"}</dd>
        <dt>Domisili</dt>
        <dd>{m.city || "-"}</dd>
        <dt>Pendidikan</dt>
        <dd>{m.education || "-"}</dd>
        <dt>Keahlian</dt>
        <dd>{m.skills || "-"}</dd>
        <dt>CV</dt>
        <dd>
          {m.cvUrl ? (
            <a href={safeUrl(m.cvUrl)} target="_blank" rel="noopener noreferrer">
              Buka CV ↗
            </a>
          ) : (
            "Tidak dilampirkan"
          )}
        </dd>
      </dl>
      <h3 className="cp-h3">Riwayat lamaran</h3>
      <ul className="cp-ul">
        {m.applications.map((a) => (
          <li key={a.id}>
            <b>{a.jobTitle || a.jobId}</b> · {day(a.at)} ·{" "}
            <span className="status" data-status={a.status}>
              {a.status}
            </span>
            {a.boothId !== booth.id && <span className="muted small"> · stand {a.boothId}</span>}
          </li>
        ))}
      </ul>
      <h3 className="cp-h3">Tawarkan lowongan</h3>
      {!m.contactable ? (
        <p className="muted small">Orang ini memilih tidak dihubungi untuk lowongan lain.</p>
      ) : !jobs.length ? (
        <p className="muted small">Tidak ada lowongan terbuka yang belum dilamar orang ini. Buka lowongan baru di tab Lowongan.</p>
      ) : (
        <form
          className="cp-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const job = jobs.find((j) => j.id === jobId);
            if (!job || busy) return;
            setBusy(true);
            const err = await sendOffer(booth, m, job, note);
            setBusy(false);
            if (err) return flash(err);
            setNote("");
            flash(`Tawaran ${job.title} terkirim ke ${m.name}`);
          }}
        >
          <label>
            Lowongan
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
          <label className="cp-span">
            Pesan (opsional)
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Kami ingat interview kamu bulan lalu..." />
          </label>
          <button type="submit" disabled={busy}>
            <Send size={16} aria-hidden /> {busy ? "Mengirim…" : "Tawarkan lowongan"}
          </button>
        </form>
      )}
      {toast && <div className="cp-toast">{toast}</div>}
    </div>
  );
}

/** "Kandidat cocok" under one vacancy: the best matching people with why, and a one-click invitation. */
export function JobCandidates({ booth, job }: { booth: CompanyBooth; job: JobPosting }) {
  const [list, setList] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!LIVE) return setList(rankCandidates(localPool(booth.id), booth, job, 12));
    let gone = false;
    void jobCandidates(booth.id, job.id).then((r) => {
      if (gone) return;
      if (r.ok) setList(r.data.candidates);
      else setError(r.error === "not_found" ? "Simpan lowongan dulu, lalu buka lagi." : "Kandidat belum bisa dimuat. Coba lagi sebentar lagi.");
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booth.id, job.id]);
  if (error) return <p className="bk-err tp-cands">{error}</p>;
  if (!list) return <p className="muted small tp-cands">Mencari kandidat…</p>;
  if (!list.length)
    return (
      <p className="muted small tp-cands">
        Belum ada kandidat yang cocok. Kandidat diambil dari talent pool dan pencari kerja yang bersedia dihubungi, dicocokkan dengan judul dan syarat lowongan.
      </p>
    );
  return (
    <ul className="tp-cands">
      {list.map((c) => (
        <li key={c.member.seeker}>
          <span className="cp-app-main">
            <b>
              {c.member.name} <span className="tp-tag">{c.member.applicant ? "Pernah melamar" : "Terbuka untuk tawaran"}</span>
            </b>
            <span className="muted small">{[c.member.headline, c.member.education, c.member.city].filter(Boolean).join(" · ")}</span>
            <span className="tp-why">
              <Sparkles size={14} aria-hidden /> {c.why.join(", ")}
            </span>
          </span>
          {sent[c.member.seeker] ? (
            <span className="muted small">{sent[c.member.seeker]}</span>
          ) : c.member.contactable ? (
            <button
              type="button"
              className="small-btn"
              onClick={async () => {
                setSent((s) => ({ ...s, [c.member.seeker]: "Mengirim…" }));
                const err = await sendOffer(booth, c.member, job, "");
                setSent((s) => ({ ...s, [c.member.seeker]: err ?? "Tawaran terkirim" }));
              }}
            >
              <Send size={14} aria-hidden /> Undang melamar
            </button>
          ) : (
            <span className="muted small">Tidak mau dihubungi</span>
          )}
        </li>
      ))}
    </ul>
  );
}
