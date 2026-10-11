// Which vacancies and booths suit a job seeker, from what they wrote in their profile: skills and
// status matched against the job's title, requirements and description, the city against the job's
// location, and their education against what the job asks. Plain word matching, no server needed,
// so it also works offline and in the light mode.
import { type CompanyBooth, type JobPosting, openJobs } from "@vwo/shared";

export interface ProfileHints {
  headline?: string;
  skills?: string;
  education?: string;
  city?: string;
}

export interface JobMatch {
  booth: CompanyBooth;
  job: JobPosting;
  score: number;
  /** Short reasons to show next to the job, e.g. "React", "Jakarta", "cocok untuk mahasiswa". */
  why: string[];
}

export interface BoothMatch {
  booth: CompanyBooth;
  score: number;
  jobs: JobMatch[];
}

// Words that say nothing about the job.
const STOP = new Set(
  "dan atau di ke dari yang untuk dengan pada dalam the of and or in to a an at tahun thn pengalaman paham bisa punya minimal min lulusan lulus sedang baru fresh graduate s1 s2 d3 d4 sma smk jurusan teknik ilmu kerja kemampuan mampu baik bagus".split(
    " ",
  ),
);
// Well known short skill names that would fall under the length cut.
const SHORT = new Set(["go", "ui", "ux", "qa", "hr", "it", "ai", "ml", "pr", "c", "r", "3d", "k3"]);

export function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(" ")
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => (w.length >= 3 || SHORT.has(w)) && !STOP.has(w));
}

/** The skills the seeker listed, comma or line separated, each as words. */
function skillList(s: string) {
  return s
    .split(/[,;\n/]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((label) => ({ label, words: words(label) }))
    .filter((x) => x.words.length);
}

const STUDENT = /mahasiswa|kuliah|semester|tingkat akhir|magang|intern/i;
const LEVELS: [RegExp, number][] = [
  [/\bs3\b|doktor/i, 6],
  [/\bs2\b|magister|master/i, 5],
  [/\bs1\b|sarjana|bachelor|\bd4\b/i, 4],
  [/\bd3\b|diploma/i, 3],
  [/\bsmk\b|\bsma\b|\bslta\b|\bstm\b/i, 2],
];
const level = (s: string) => LEVELS.find(([re]) => re.test(s))?.[1] ?? 0;

const cityOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .trim();

/** How well one vacancy suits the profile; 0 when nothing matches. */
export function scoreJob(p: ProfileHints, booth: CompanyBooth, job: JobPosting): JobMatch {
  const why: string[] = [];
  let score = 0;
  const text = `${job.title} ${job.requirements.join(" ")} ${job.description ?? ""}`;
  const jobWords = new Set(words(text));
  const titleWords = new Set(words(job.title));
  const industryWords = new Set(words(booth.industry));

  for (const sk of skillList(p.skills ?? "")) {
    const hit = sk.words.filter((w) => jobWords.has(w));
    if (!hit.length) continue;
    // A skill in the job title counts most ("React" for "Frontend React Developer").
    score += sk.words.some((w) => titleWords.has(w)) ? 4 : 3;
    if (why.length < 3) why.push(sk.label);
  }
  // The status line ("Fresh graduate Akuntansi", "Desainer grafis") against the title and field.
  const head = words(p.headline ?? "").filter((w) => !STUDENT.test(w));
  const headHits = head.filter((w) => titleWords.has(w) || jobWords.has(w) || industryWords.has(w));
  if (headHits.length) {
    score += Math.min(4, headHits.length * 2);
    if (why.length < 3 && !why.some((x) => headHits.some((h) => x.toLowerCase().includes(h)))) why.push(headHits[0]!);
  }
  // Study field ("S1 Akuntansi") against the requirements.
  const study = words(p.education ?? "").filter((w) => !/^\d+$/.test(w));
  const studyHits = study.filter((w) => jobWords.has(w) || industryWords.has(w));
  if (studyHits.length) {
    score += 2;
    if (why.length < 3 && !why.some((x) => x.toLowerCase().includes(studyHits[0]!))) why.push(`jurusan ${studyHits[0]}`);
  }

  const relevant = score > 0;
  // Place and level only help a job that already fits; they never make an unrelated job look good.
  if (relevant) {
    const city = cityOf(p.city ?? "");
    const loc = job.location.toLowerCase();
    if (/remote/.test(loc)) {
      score += 1;
      why.push("remote");
    } else if (city && city.split(" ").some((c) => c.length >= 3 && loc.includes(c))) {
      score += 2;
      why.push(job.location.replace(/\s*\(.*\)/, ""));
    }
    const mine = level(p.education ?? "");
    const want = level(text);
    const student = STUDENT.test(`${p.headline ?? ""} ${p.education ?? ""}`);
    if (student && job.type === "Magang") {
      score += 2;
      why.push("cocok untuk mahasiswa");
    } else if (!student && job.type === "Magang") score -= 1;
    if (mine && want && mine < want) score -= 2;
  }
  return { booth, job, score: Math.max(0, score), why };
}

/** The vacancies that suit the profile best, best first; applied and closed ones left out. */
export function recommendJobs(p: ProfileHints, booths: CompanyBooth[], applied: Set<string> = new Set(), limit = 6): JobMatch[] {
  const out: JobMatch[] = [];
  for (const b of booths) for (const j of openJobs(b)) if (!applied.has(j.id)) out.push(scoreJob(p, b, j));
  return out
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || (b.booth.tier === "premium" ? 1 : 0) - (a.booth.tier === "premium" ? 1 : 0) || a.job.title.localeCompare(b.job.title))
    .slice(0, limit);
}

/** The booths worth visiting: their best matching vacancy, plus a little for each other match. */
export function recommendBooths(p: ProfileHints, booths: CompanyBooth[], applied: Set<string> = new Set(), limit = 4): BoothMatch[] {
  const all = recommendJobs(p, booths, applied, Number.POSITIVE_INFINITY);
  const by = new Map<string, BoothMatch>();
  for (const m of all) {
    const have = by.get(m.booth.id);
    if (have) {
      have.jobs.push(m);
      have.score += 1;
    } else by.set(m.booth.id, { booth: m.booth, score: m.score, jobs: [m] });
  }
  return [...by.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Enough in the profile to recommend anything. */
export const canRecommend = (p: ProfileHints) => !!(p.skills?.trim() || p.headline?.trim() || p.education?.trim());
