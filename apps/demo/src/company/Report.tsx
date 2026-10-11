import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { type BoothReport, type CompanyBooth, composeBoothReport, type ReportBucket, type ReportDelta, reportDeltas, rp } from "@vwo/shared";
import { LIVE } from "../mode";
import { boothReport, boothSavedReport, type SavedReport } from "../server-fair";
import { fair, useFair } from "../useFair";

type History = { id: string; eventName: string; at: number }[];

const n = (x: number) => x.toLocaleString("id-ID");
const pct = (x: number) => `${(x * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const date = (at: number) => new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const value = (v: number | null, unit: ReportDelta["unit"]) =>
  v === null ? "–" : unit === "rp" ? rp(v) : unit === "pct" ? pct(v) : unit === "stars" ? `${v.toLocaleString("id-ID")} / 5` : n(v);

/** Demo: the same report, worked out from what this browser holds. */
function demoReport(booth: CompanyBooth): BoothReport {
  const apps = fair.applications.filter((a) => a.boothId === booth.id);
  const visits = fair.visits.get(booth.id) ?? 0;
  const paid = (fair.company.get(booth.id)?.invoices ?? []).filter((i) => i.status === "Lunas").reduce((t, i) => t + i.total, 0);
  const rating = fair.companyRating(booth.id);
  return composeBoothReport({
    boothKey: booth.id,
    since: null,
    until: Date.now(),
    visits,
    visitors: visits,
    rating: rating.count ? { count: rating.count, sum: rating.average * rating.count } : null,
    applications: apps.map((a) => ({
      userId: a.visitorId,
      jobKey: a.jobId,
      jobTitle: a.jobTitle,
      status: a.status,
      city: a.city,
      education: a.education,
      headline: a.headline,
      skills: a.skills,
      verified: a.verified,
      psych: a.psych,
    })),
    spend: { registration: 0, invoices: paid, stalls: 0 },
  });
}

/** The booth's post-event report: reach, applicants, funnel, who applied, spend, and the change since the last event. Prints as a clean PDF. */
export function Report({ booth }: { booth: CompanyBooth }) {
  useFair();
  const [live, setLive] = useState<{ report: BoothReport; history: History; previous: SavedReport | null } | null>(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState("now");
  const [saved, setSaved] = useState<{ shown: SavedReport; before: SavedReport | null } | null>(null);

  useEffect(() => {
    if (!LIVE) return;
    let gone = false;
    void boothReport(booth.id).then((r) => {
      if (gone) return;
      if (r.ok) setLive(r.data);
      else
        setError(
          r.error === "not_allowed"
            ? "Laporan hanya bisa dibuka oleh akun yang terdaftar di stand ini."
            : r.error === "not_signed_in"
              ? "Masuk dulu untuk melihat laporan."
              : "Laporan gagal dimuat. Coba lagi sebentar lagi.",
        );
    });
    return () => {
      gone = true;
    };
  }, [booth.id]);

  // A past event: its saved report, compared with the event saved before it.
  useEffect(() => {
    if (!LIVE || pick === "now" || !live) return setSaved(null);
    let gone = false;
    const i = live.history.findIndex((h) => h.id === pick);
    const older = live.history[i + 1];
    void Promise.all([boothSavedReport(booth.id, pick), older ? boothSavedReport(booth.id, older.id) : null]).then(([a, b]) => {
      if (gone) return;
      if (!a.ok) return setError("Laporan event itu gagal dimuat.");
      setError("");
      setSaved({ shown: a.data.saved, before: b && b.ok ? b.data.saved : null });
    });
    return () => {
      gone = true;
    };
  }, [pick, live, booth.id]);

  const demo = LIVE ? null : demoReport(booth);
  const report = LIVE ? (pick === "now" ? live?.report : saved?.shown.report) : demo;
  const before = LIVE ? (pick === "now" ? live?.previous : saved?.before) : null;
  const title = pick === "now" ? "Event berjalan" : (saved?.shown.eventName ?? "");

  if (error && !report) return <p className="card cp-server-note">{error}</p>;
  if (!report) return <p className="muted small">Memuat laporan…</p>;
  const deltas = before ? Object.fromEntries(reportDeltas(report, before.report).map((d) => [d.key, d])) : {};

  const tiles: [string, string, string | undefined][] = [
    ["Kunjungan stand", n(report.reach.visits), "visits"],
    ["Pengunjung unik", n(report.reach.visitors), "visitors"],
    ["Pelamar", n(report.applicants), "applicants"],
    ["Lamaran", n(report.applications), "applications"],
    ["Konversi", report.conversion === null ? "–" : pct(report.conversion), "conversion"],
    ["Diterima", n(report.hired), "hired"],
    ["Total biaya", rp(report.spend.total), "spend"],
    ["Biaya per pelamar", report.costPerApplicant === null ? "–" : rp(report.costPerApplicant), "cpa"],
  ];

  return (
    <div className="rp">
      <div className="card rp-bar rp-noprint">
        {LIVE && live && live.history.length > 0 ? (
          <label className="rp-pick">
            <span className="muted small">Laporan</span>
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="now">Event berjalan</option>
              {live.history.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.eventName} · {date(h.at)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="muted small">
            {LIVE ? "Belum ada laporan event sebelumnya. Laporan disimpan saat panitia menutup event." : "Demo: dihitung dari data di browser ini."}
          </span>
        )}
        <button type="button" className="small-btn" onClick={() => window.print()}>
          <Download size={15} aria-hidden /> Unduh PDF
        </button>
      </div>
      {error && <p className="card cp-server-note rp-noprint">{error}</p>}

      <header className="rp-head">
        <h2 className="rp-title">Laporan pasca-event · {booth.company}</h2>
        <p className="muted small">
          {title} · {report.since ? `${date(report.since)} – ${date(report.until)}` : `s.d. ${date(report.until)}`}
          {before && ` · dibandingkan dengan ${before.eventName}`}
        </p>
      </header>

      <div className="cp-kpis rp-kpis">
        {tiles.map(([label, shown, key]) => (
          <div key={label} className="card cp-kpi">
            <span className="muted small">{label}</span>
            <span className="stat">{shown}</span>
            {key && deltas[key] && <Delta d={deltas[key]} />}
          </div>
        ))}
      </div>

      <div className="rp-grid">
        <section className="card rp-card">
          <h3 className="cp-h2">Corong rekrutmen</h3>
          <Bars rows={report.funnel} total={report.applications} empty="Belum ada lamaran." />
          {report.rejected > 0 && <p className="muted small">{n(report.rejected)} lamaran ditandai belum cocok.</p>}
        </section>
        <section className="card rp-card">
          <h3 className="cp-h2">Biaya</h3>
          <table className="list cp-table rp-table">
            <tbody>
              <tr>
                <td>Pendaftaran stand</td>
                <td>{rp(report.spend.registration)}</td>
              </tr>
              <tr>
                <td>Tagihan stand (upgrade, printilan)</td>
                <td>{rp(report.spend.invoices)}</td>
              </tr>
              <tr>
                <td>Sewa stan food court</td>
                <td>{rp(report.spend.stalls)}</td>
              </tr>
              <tr>
                <td>
                  <b>Total</b>
                </td>
                <td>
                  <b>{rp(report.spend.total)}</b>
                </td>
              </tr>
              <tr>
                <td>Biaya per pelamar</td>
                <td>{report.costPerApplicant === null ? "–" : rp(report.costPerApplicant)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted small">Pembayaran dengan koin dihitung dengan harga rupiahnya.</p>
          <h3 className="cp-h2">Jangkauan lain</h3>
          <ul className="rp-facts">
            <li>
              Promotor dilihat <b>{n(report.reach.promoViews)}</b> kali, diklik <b>{n(report.reach.promoClicks)}</b> kali
            </li>
            <li>
              Merchandise dibagikan <b>{n(report.reach.merch)}</b>
            </li>
            <li>
              Rating stand <b>{report.rating ? `${report.rating.average.toLocaleString("id-ID")} / 5 (${n(report.rating.count)} ulasan)` : "belum ada"}</b>
            </li>
            <li>
              Pelamar centang biru <b>{n(report.verified)}</b>
              {report.psychAverage !== null && (
                <>
                  {" "}
                  · rata-rata psikotes <b>{report.psychAverage}</b>
                </>
              )}
            </li>
          </ul>
        </section>
      </div>

      <section className="card rp-card">
        <h3 className="cp-h2">Demografi pelamar</h3>
        {report.applicants === 0 ? (
          <p className="muted small">Belum ada pelamar.</p>
        ) : (
          <div className="rp-demo">
            {(
              [
                ["Kota", report.demographics.city],
                ["Pendidikan", report.demographics.education],
                ["Kampus / sekolah", report.demographics.campus],
                ["Headline / profesi", report.demographics.headline],
                ["Keahlian teratas", report.demographics.skills],
                ["Lowongan", report.byJob],
              ] as [string, ReportBucket[]][]
            ).map(([label, rows]) => (
              <div key={label}>
                <h4 className="cp-h3">{label}</h4>
                <Bars
                  rows={rows}
                  total={label === "Lowongan" ? report.applications : label === "Keahlian teratas" ? Math.max(1, ...rows.map((r) => r.n)) : report.applicants}
                  empty="Belum ada data."
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {before && (
        <section className="card rp-card">
          <h3 className="cp-h2">Dibandingkan dengan {before.eventName}</h3>
          <table className="list cp-table rp-table">
            <thead>
              <tr>
                <th>Ukuran</th>
                <th>Sekarang</th>
                <th>{before.eventName}</th>
                <th>Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(deltas).map((d) => (
                <tr key={d.key}>
                  <td>{d.label}</td>
                  <td>{value(d.now, d.unit)}</td>
                  <td>{value(d.before, d.unit)}</td>
                  <td>
                    <Delta d={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="muted small rp-foot">
        Dibuat {new Date().toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {fair.fair.name}. Kunjungan dihitung
        per akun per hari dengan batas, jadi satu akun tidak bisa menaikkan angka.
      </p>
    </div>
  );
}

/** Monochrome horizontal bars; each bar is its share of `total`. */
function Bars({ rows, total, empty }: { rows: ReportBucket[]; total: number; empty: string }) {
  if (!rows.length || rows.every((r) => r.n === 0)) return <p className="muted small">{empty}</p>;
  return (
    <div className="rp-bars">
      {rows.map((r) => (
        <div key={r.label} className="rp-row" data-dim={r.label === "Tidak diisi" || r.label === "Lainnya" || undefined}>
          <span className="rp-label" title={r.label}>
            {r.label}
          </span>
          <span className="rp-track">
            <span style={{ width: `${total ? Math.min(100, (r.n / total) * 100) : 0}%` }} />
          </span>
          <b>{n(r.n)}</b>
        </div>
      ))}
    </div>
  );
}

/** The change since the event compared with: an arrow, the difference, and whether it is good news in words. */
function Delta({ d }: { d: ReportDelta }) {
  if (d.change === null) return <span className="rp-delta muted">–</span>;
  const Icon = d.change > 0 ? ArrowUpRight : d.change < 0 ? ArrowDownRight : Minus;
  const good = d.change === 0 ? null : d.change > 0 === (d.better === "up");
  const sign = d.change > 0 ? "+" : d.change < 0 ? "−" : "";
  const abs = Math.abs(d.change);
  const diff =
    d.unit === "pct"
      ? `${sign}${(abs * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })} poin`
      : d.pct !== null
        ? `${sign}${pct(Math.abs(d.pct))}`
        : `${sign}${d.unit === "rp" ? rp(abs) : n(abs)}`;
  return (
    <span className="rp-delta" data-good={good === null ? undefined : String(good)} title={good === null ? "Sama" : good ? "Lebih baik" : "Lebih buruk"}>
      <Icon size={13} aria-hidden /> {diff}
    </span>
  );
}
