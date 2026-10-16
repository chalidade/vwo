// A company's talent pool: everyone who ever applied to its booth(s), kept after the event ends so
// the company can reach them again for a newer vacancy, plus the seekers who said any company may
// contact them. Worked out from the applications and the seekers' saved profiles, with no table of
// its own. The same functions run on the server (live site) and in the browser (demo).
import type { CompanyBooth, JobPosting } from "./jobfair";
import type { PoolFilter } from "./talent-pool-schema";
import { educationLevel, scoreJob } from "./recommend";
import { canonicalSkill, parseSkills, provinceOf } from "./taxonomy";

/** One application as the pool reads it: who sent it where, and the form they filled in. */
export interface PoolApplication {
  id: string;
  seeker: string;
  boothId: string;
  jobId: string;
  jobTitle: string;
  status: string;
  at: number;
  data: Record<string, unknown>;
}

/** What the pool reads from a seeker's saved profile. Any shape is accepted: it comes from a JSON document. */
export type PoolProfile = Record<string, unknown> | null | undefined;

export interface PoolMember {
  /** The account id of an applicant; for an opted-in stranger, a handle that only works for offers from this booth. */
  seeker: string;
  name: string;
  headline: string;
  skills: string;
  city: string;
  education: string;
  /** Contact details, only for seekers who applied to this company. */
  email?: string;
  phone?: string;
  cvUrl?: string;
  /** Applied to one of the company's booths (the pool proper); otherwise an opted-in seeker found by matching. */
  applicant: boolean;
  /** Agreed to hear about other vacancies. Applicants count as agreeing unless they switched it off. */
  contactable: boolean;
  /** Their applications to the company, newest first. */
  applications: { id: string; boothId: string; jobId: string; jobTitle: string; status: string; at: number }[];
  /** When they last applied or updated their profile. */
  lastAt: number;
}

/** Profile fields are read as text; a list (a skills picker) is read as the comma separated text it stands for. */
export const textOf = (v: unknown, max = 300): string =>
  (typeof v === "string" ? v : Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : typeof v === "number" ? String(v) : "").trim().slice(0, max);

/** Whether a seeker's profile lets companies they never applied to reach them: only when they turned it on. */
export const optedIn = (p: PoolProfile) => p?.contactable === true;

/** "Sari Wulandari" as "Sari W.": an opted-in seeker stays anonymous until they apply. */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Pencari kerja";
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/**
 * Group the company's applications by seeker. The newest application gives the contact details the
 * seeker sent the company; the saved profile, when there is one, gives fresher skills and city.
 */
export function poolMembers(apps: PoolApplication[], profiles: Map<string, PoolProfile> = new Map()): PoolMember[] {
  const by = new Map<string, PoolMember>();
  for (const a of [...apps].sort((x, y) => y.at - x.at)) {
    const app = { id: a.id, boothId: a.boothId, jobId: a.jobId, jobTitle: a.jobTitle, status: a.status, at: a.at };
    const have = by.get(a.seeker);
    if (have) {
      have.applications.push(app);
      continue;
    }
    const p = profiles.get(a.seeker);
    const d = a.data;
    const pick = (k: string, max?: number) => textOf(p?.[k], max) || textOf(d[k], max);
    by.set(a.seeker, {
      seeker: a.seeker,
      name: textOf(d.name, 80) || textOf(p?.name, 80) || "Pelamar",
      headline: pick("headline", 200),
      skills: pick("skills"),
      city: pick("city", 80),
      education: pick("education", 200),
      email: textOf(d.email, 120) || undefined,
      phone: textOf(d.phone, 30) || undefined,
      cvUrl: textOf(d.cvUrl, 300) || undefined,
      applicant: true,
      contactable: p?.contactable !== false,
      applications: [app],
      lastAt: a.at,
    });
  }
  return [...by.values()];
}

/** An opted-in seeker who never applied to the company: what they do and where, without who they are or how to reach them. */
export function outsiderMember(seeker: string, p: PoolProfile, at: number): PoolMember {
  return {
    seeker,
    name: shortName(textOf(p?.name, 80)),
    headline: textOf(p?.headline, 200),
    skills: textOf(p?.skills),
    city: textOf(p?.city, 80),
    education: textOf(p?.education, 200),
    applicant: false,
    contactable: true,
    applications: [],
    lastAt: at,
  };
}

const has = (text: string, term?: string) => !term || text.toLowerCase().includes(term.toLowerCase());
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether someone listed this skill: a whole skill as the pick list spells it (old free text is read with parseSkills too), so "Java" is not "JavaScript". */
export const hasSkill = (text: string, skill: string) => {
  const want = canonicalSkill(skill) ?? skill;
  return parseSkills(text).some((s) => same(s, want));
};

/** Whether a domisili ("Kota Surabaya") is in this province and/or is this kab/kota. */
export const inPlace = (city: string, f: { province?: string; city?: string }) => (!f.city || same(city, f.city)) && (!f.province || same(provinceOf(city) ?? "", f.province));

const LEVEL_NAMES: Record<number, string> = { 2: "SMA/SMK", 3: "D3", 4: "S1/D4", 5: "S2", 6: "S3" };
/** The schooling level for the education filter ("S1/D4"), or "" when the text names none. */
export const educationOf = (text: string) => LEVEL_NAMES[educationLevel(text)] ?? "";
export const EDUCATION_FILTERS = Object.values(LEVEL_NAMES);

/** The members matching every filter given, newest first. Status matches any of their applications. */
export function filterPool(members: PoolMember[], f: PoolFilter): PoolMember[] {
  return members
    .filter(
      (m) =>
        (!f.skill || hasSkill(m.skills, f.skill)) &&
        inPlace(m.city, f) &&
        (!f.education || educationOf(m.education) === f.education) &&
        (!f.status || m.applications.some((a) => a.status === f.status)) &&
        (!f.q || [m.name, m.headline, m.skills, m.email ?? ""].some((s) => has(s, f.q))),
    )
    .sort((a, b) => b.lastAt - a.lastAt);
}

export interface Facet {
  value: string;
  n: number;
}
export interface PoolFacets {
  skills: Facet[];
  provinces: Facet[];
  /** Each kab/kota with its province, so the domisili list can follow the chosen province. */
  cities: (Facet & { province: string })[];
}

/**
 * The skills, provinces and kab/kota among these people, most common first, for the filter
 * dropdowns. Works for pool members and for a booth's applicants alike.
 */
export function placeSkillFacets(people: { skills?: string; city?: string }[], max = 80): PoolFacets {
  const count = (values: string[][]) => {
    const by = new Map<string, Facet>();
    for (const vs of values)
      for (const v of vs) {
        const k = v.toLowerCase();
        const have = by.get(k);
        if (have) have.n++;
        else by.set(k, { value: v, n: 1 });
      }
    return [...by.values()].sort((a, b) => b.n - a.n || a.value.localeCompare(b.value)).slice(0, max);
  };
  const cities = (p: { city?: string }) => (p.city?.trim() ? [p.city.trim()] : []);
  return {
    skills: count(people.map((p) => parseSkills(p.skills ?? ""))),
    provinces: count(people.map((p) => cities(p).flatMap((c) => provinceOf(c) ?? []))),
    cities: count(people.map(cities)).map((c) => ({ ...c, province: provinceOf(c.value) ?? "" })),
  };
}

export const poolFacets = (members: PoolMember[]) => placeSkillFacets(members);

export const POOL_PAGE = 30;

/** One page of a list, and how many there are in all. */
export function pageOf<T>(list: T[], page: number, size = POOL_PAGE) {
  const p = Math.max(0, Math.floor(page) || 0);
  return { items: list.slice(p * size, (p + 1) * size), total: list.length, page: p, pageSize: size };
}

export interface Candidate {
  member: PoolMember;
  score: number;
  /** Short reasons, e.g. "React", "Jakarta", "cocok untuk mahasiswa". */
  why: string[];
}

/**
 * The people who suit one vacancy best: the seeker matcher (scoreJob) run the other way round, for
 * each member against this job. People who already applied to it are left out: they are in the
 * applicants list. Past applicants come before opted-in strangers on an equal score.
 */
export function rankCandidates(members: PoolMember[], booth: CompanyBooth, job: JobPosting, limit = 10): Candidate[] {
  return members
    .filter((m) => !m.applications.some((a) => a.jobId === job.id && a.boothId === booth.id))
    .map((m) => {
      const r = scoreJob(m, booth, job);
      return { member: m, score: r.score, why: r.why };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.member.applicant) - Number(a.member.applicant) || b.member.lastAt - a.member.lastAt)
    .slice(0, limit);
}

/** A company's invitation to apply to one of its vacancies, kept with the seeker until they apply or dismiss it. */
export interface TalentOffer {
  id: string;
  boothId: string;
  jobId: string;
  company: string;
  jobTitle: string;
  note?: string;
  at: number;
}

/** How many offers a seeker keeps; the oldest drop off. */
export const OFFER_LIMIT = 30;

/** The chat message a past applicant gets with an offer, in the conversation they already had with the company. */
export const offerMessage = (o: { jobTitle: string; note?: string }) =>
  `Kami membuka lowongan ${o.jobTitle} dan menurut kami cocok untukmu. ${o.note ? `${o.note} ` : ""}Lamar lewat Tas > Cocok > Tawaran perusahaan.`.slice(0, 600);
