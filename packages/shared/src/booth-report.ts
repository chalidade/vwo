// A booth's post-event report: reach, applicants, the hiring funnel, who applied, what the booth
// spent and what one applicant cost. Worked out from plain numbers so the server (live) and the
// browser (demo) build the same thing, and saved as is when the organiser closes an event.

/** Where an application is in the hiring pipeline, in order (the portal's own list). */
export const REPORT_PIPELINE = ["Terkirim", "Dilihat", "Shortlist", "Diundang interview", "Lolos interview", "Kunjungan kantor", "Diterima"] as const;
/** Turned down: they were seen, then stopped. */
const REJECTED = "Belum cocok";

/** The funnel's steps: how many applications got at least this far. */
const FUNNEL_LABELS = ["Lamaran masuk", "Sudah dilihat", "Shortlist", "Diundang interview", "Lolos interview", "Kunjungan kantor", "Diterima"] as const;

export interface ReportBucket {
  label: string;
  n: number;
}

/** One application as the report needs it: no names, emails or phone numbers. */
export interface ReportApplication {
  userId: string;
  jobKey: string;
  jobTitle?: string;
  status: string;
  city?: string;
  education?: string;
  campus?: string;
  headline?: string;
  skills?: string;
  verified?: boolean;
  psych?: number;
}

export interface ReportInput {
  boothKey: string;
  /** The period covered: since the booth's last saved report (null: from the start). */
  since: number | null;
  until: number;
  /** Booth visits counted in the hall, and how many different accounts made them. */
  visits: number;
  visitors: number;
  promoViews?: number;
  promoClicks?: number;
  merch?: number;
  rating?: { count: number; sum: number } | null;
  applications: ReportApplication[];
  /** Rupiah, worked out on the server from what was paid. */
  spend: { registration: number; invoices: number; stalls: number };
}

export interface BoothReport {
  v: 1;
  boothKey: string;
  since: number | null;
  until: number;
  reach: { visits: number; visitors: number; promoViews: number; promoClicks: number; merch: number };
  /** Different people who applied, and their applications (one person can apply to several jobs). */
  applicants: number;
  applications: number;
  hired: number;
  rejected: number;
  /** Applicants per different visitor, 0..1 (null without visitors). */
  conversion: number | null;
  funnel: ReportBucket[];
  byJob: ReportBucket[];
  demographics: { city: ReportBucket[]; education: ReportBucket[]; campus: ReportBucket[]; headline: ReportBucket[]; skills: ReportBucket[] };
  verified: number;
  psychAverage: number | null;
  rating: { count: number; average: number } | null;
  spend: { registration: number; invoices: number; stalls: number; total: number };
  /** Total spend divided by applicants, in rupiah (null without applicants). */
  costPerApplicant: number | null;
}

/** What the person wrote, the same however it was typed: "  jakarta selatan" and "Jakarta Selatan". */
const keyOf = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/**
 * Count values, merging spellings, largest first: the top `top`, the rest as "Lainnya", and blanks
 * as "Tidak diisi" at the end. Each person's answer is shown in the spelling most people used.
 */
export function topBuckets(values: (string | undefined)[], top = 6): ReportBucket[] {
  const groups = new Map<string, { n: number; spellings: Map<string, number> }>();
  let blank = 0;
  for (const raw of values) {
    const v = clean(raw);
    if (!v) {
      blank++;
      continue;
    }
    const g = groups.get(keyOf(v)) ?? { n: 0, spellings: new Map() };
    g.n++;
    g.spellings.set(v, (g.spellings.get(v) ?? 0) + 1);
    groups.set(keyOf(v), g);
  }
  const rows = [...groups.values()]
    .map((g) => ({ label: [...g.spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0], n: g.n }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  const out = rows.slice(0, top);
  const rest = rows.slice(top).reduce((n, r) => n + r.n, 0);
  if (rest) out.push({ label: "Lainnya", n: rest });
  if (blank) out.push({ label: "Tidak diisi", n: blank });
  return out;
}

/** The level of schooling in what the applicant wrote ("S1 Teknik Informatika ITS" → "S1"). */
export function educationGroup(s: string | undefined): string | undefined {
  const t = ` ${(s ?? "").toUpperCase()} `;
  if (!t.trim()) return undefined;
  if (/\bS3\b|DOKTOR|PH\.?D/.test(t)) return "S3";
  if (/\bS2\b|MAGISTER|MASTER/.test(t)) return "S2";
  if (/\bD4\b|\bD-IV\b|SARJANA TERAPAN/.test(t)) return "D4";
  if (/\bS1\b|SARJANA|BACHELOR/.test(t)) return "S1";
  if (/\bD3\b|\bD-III\b|DIPLOMA/.test(t)) return "D3";
  if (/\bD[12]\b/.test(t)) return "D1/D2";
  if (/\bSMA\b|\bSMK\b|\bSLTA\b|\bSTM\b|\bMA\b|\bMAK\b/.test(t)) return "SMA/SMK";
  return "Lainnya";
}

/** How far a status got in the funnel; turned down counts as seen. */
const rankOf = (status: string) => (status === REJECTED ? 1 : Math.max(0, (REPORT_PIPELINE as readonly string[]).indexOf(status)));

export function composeBoothReport(input: ReportInput): BoothReport {
  const apps = input.applications;
  const people = new Map<string, ReportApplication>();
  // One row per person for who-applied: what they filled in on any of their applications, newest first.
  for (const a of apps) {
    const p = people.get(a.userId);
    people.set(
      a.userId,
      p
        ? {
            ...a,
            city: a.city || p.city,
            education: a.education || p.education,
            campus: a.campus || p.campus,
            headline: a.headline || p.headline,
            skills: a.skills || p.skills,
            verified: a.verified || p.verified,
            psych: a.psych ?? p.psych,
          }
        : a,
    );
  }
  const persons = [...people.values()];
  const applicants = persons.length;
  const ranks = apps.map((a) => rankOf(a.status));
  const funnel = FUNNEL_LABELS.map((label, i) => ({ label, n: ranks.filter((r) => r >= i).length }));
  const jobTitles = new Map<string, string>();
  for (const a of apps) if (a.jobTitle && !jobTitles.has(a.jobKey)) jobTitles.set(a.jobKey, a.jobTitle);
  const byJob = topBuckets(
    apps.map((a) => jobTitles.get(a.jobKey) ?? a.jobKey),
    8,
  );
  const psych = persons.map((p) => p.psych).filter((n): n is number => typeof n === "number" && n >= 0 && n <= 100);
  const skills = persons.flatMap((p) =>
    (p.skills ?? "")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20),
  );
  const money = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  const spend = { registration: money(input.spend.registration), invoices: money(input.spend.invoices), stalls: money(input.spend.stalls), total: 0 };
  spend.total = spend.registration + spend.invoices + spend.stalls;
  const visitors = Math.max(0, input.visitors);
  return {
    v: 1,
    boothKey: input.boothKey,
    since: input.since,
    until: input.until,
    reach: { visits: Math.max(0, input.visits), visitors, promoViews: input.promoViews ?? 0, promoClicks: input.promoClicks ?? 0, merch: input.merch ?? 0 },
    applicants,
    applications: apps.length,
    hired: apps.filter((a) => a.status === "Diterima").length,
    rejected: apps.filter((a) => a.status === REJECTED).length,
    conversion: visitors ? Math.min(1, applicants / visitors) : null,
    funnel,
    byJob,
    demographics: {
      city: topBuckets(persons.map((p) => p.city)),
      education: topBuckets(
        persons.map((p) => educationGroup(p.education)),
        7,
      ),
      campus: topBuckets(persons.map((p) => p.campus)),
      headline: topBuckets(persons.map((p) => p.headline)),
      skills: topBuckets(skills, 8).filter((b) => b.label !== "Tidak diisi"),
    },
    verified: persons.filter((p) => p.verified).length,
    psychAverage: psych.length ? Math.round(psych.reduce((n, x) => n + x, 0) / psych.length) : null,
    rating: input.rating?.count ? { count: input.rating.count, average: Math.round((input.rating.sum / input.rating.count) * 10) / 10 } : null,
    spend,
    costPerApplicant: applicants ? Math.round(spend.total / applicants) : null,
  };
}

/** A number compared with the booth's previous event. `better` says which way is good news. */
export interface ReportDelta {
  key: string;
  label: string;
  now: number | null;
  before: number | null;
  /** now − before, when both are known. */
  change: number | null;
  /** The change as a share of before (0.25 = +25%), when before isn't zero. */
  pct: number | null;
  better: "up" | "down";
  unit: "n" | "rp" | "pct" | "stars";
}

/** The headline numbers next to the same numbers from an earlier report. */
export function reportDeltas(now: BoothReport, before: BoothReport): ReportDelta[] {
  const rows: [string, string, (r: BoothReport) => number | null, "up" | "down", ReportDelta["unit"]][] = [
    ["visits", "Kunjungan stand", (r) => r.reach.visits, "up", "n"],
    ["visitors", "Pengunjung unik", (r) => r.reach.visitors, "up", "n"],
    ["applicants", "Pelamar", (r) => r.applicants, "up", "n"],
    ["applications", "Lamaran", (r) => r.applications, "up", "n"],
    ["conversion", "Konversi pengunjung → pelamar", (r) => r.conversion, "up", "pct"],
    ["hired", "Diterima", (r) => r.hired, "up", "n"],
    ["spend", "Total biaya", (r) => r.spend.total, "down", "rp"],
    ["cpa", "Biaya per pelamar", (r) => r.costPerApplicant, "down", "rp"],
    ["rating", "Rating stand", (r) => r.rating?.average ?? null, "up", "stars"],
  ];
  return rows.map(([key, label, get, better, unit]) => {
    const a = get(now);
    const b = get(before);
    const change = a !== null && b !== null ? a - b : null;
    return { key, label, now: a, before: b, change, pct: change !== null && b ? change / b : null, better, unit };
  });
}
