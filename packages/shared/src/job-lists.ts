// Fixed lists for the company's side: what a vacancy asks for (position, schooling, study field,
// experience, qualifications, where) and the company profile (industry, headcount). Picked from
// lists like the seeker's skills and city (taxonomy.ts), so every company spells them the same and
// the SIAPkerja report and the candidate matching can read them. Values are stored as before, as
// text joined with ", " (the title with " / ", the qualifications as the same string array), so
// vacancies and profiles saved as free text still load, show and export unchanged.
import { EDUCATION_LEVELS, type JobPosting } from "./jobfair";
import { ABROAD, MAX_CUSTOM_SKILLS, MAX_SKILLS, REGIONS, SKILL_GROUPS, canonicalSkill, provinceOf, searchRegions, searchSkills } from "./taxonomy";

export type ListGroups = readonly (readonly [string, readonly string[]])[];

/** One list a picker chooses from, and how many entries a field may hold. */
export interface PickList {
  groups: ListGroups;
  /** Most entries one field holds, and how many of them may be the company's own words. */
  max: number;
  maxCustom: number;
  /** Longest entry the company may type itself. */
  itemLen: number;
  /** How entries are stored in one text field. */
  joiner: string;
  split: RegExp;
  /** The list's spelling of an entry, or null when it is not on the list. */
  canonical(s: string): string | null;
  /** Entries matching what was typed, best first, leaving out the ones already chosen. */
  search(q: string, chosen?: readonly string[], limit?: number): string[];
  /** A short note under an entry in the suggestions (the province of a city). */
  note?(s: string): string | null;
}

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

interface ListOptions {
  max: number;
  maxCustom?: number;
  itemLen?: number;
  aliases?: Record<string, string>;
  joiner?: string;
  split?: RegExp;
  search?: PickList["search"];
  note?: PickList["note"];
  canonical?: (s: string) => string | null;
}

/** Build a list: entries matched without caring about case or spaces, plus other spellings people type. */
export function pickList(groups: ListGroups, o: ListOptions): PickList {
  const all = groups.flatMap(([, list]) => list);
  const byFold = new Map(all.map((s) => [fold(s), s]));
  const aliases = Object.fromEntries(Object.entries(o.aliases ?? {}).map(([k, v]) => [fold(k), v]));
  const canonical = (s: string) => byFold.get(fold(s)) ?? aliases[fold(s)] ?? o.canonical?.(s) ?? null;
  const search = (q: string, chosen: readonly string[] = [], limit = 8) => {
    const f = fold(q);
    if (!f) return [];
    const have = new Set(chosen.map(fold));
    // Whole entry starts with it, then a word in it does, then anywhere, then the group's name.
    const rank = (s: string, group: string) => {
      const x = fold(s);
      if (x.startsWith(f)) return 0;
      if (x.split(/[\s/(]+/).some((w) => w.startsWith(f))) return 1;
      if (x.includes(f)) return 2;
      return fold(group).includes(f) ? 3 : -1;
    };
    const hits: { s: string; r: number; i: number }[] = [];
    const alias = aliases[f];
    if (alias && !have.has(fold(alias))) hits.push({ s: alias, r: -1, i: -1 });
    let i = 0;
    for (const [group, list] of groups)
      for (const s of list) {
        const r = rank(s, group);
        if (r >= 0 && !have.has(fold(s)) && s !== alias) hits.push({ s, r, i });
        i++;
      }
    return hits
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .slice(0, limit)
      .map((h) => h.s);
  };
  return {
    groups,
    max: o.max,
    maxCustom: o.maxCustom ?? 0,
    itemLen: o.itemLen ?? 40,
    joiner: o.joiner ?? ", ",
    split: o.split ?? /[,;\n]+/,
    canonical,
    search: o.search ?? search,
    note: o.note,
  };
}

/** A field's entries as a clean list: the list's spellings, no repeats, at most `max`. Text is split
 *  the way the list stores it; an array (the qualifications) is taken entry by entry. Old free text
 *  stays as the company's own entries. */
export function parseList(list: PickList, value: string | readonly string[] | undefined, keepLen = 120): string[] {
  const parts = typeof value === "string" ? value.split(list.split) : Array.isArray(value) ? value : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of parts) {
    if (typeof raw !== "string") continue;
    const t = raw.replace(/\s+/g, " ").trim().slice(0, keepLen);
    if (!t) continue;
    const name = list.canonical(t) ?? t;
    if (seen.has(fold(name))) continue;
    seen.add(fold(name));
    out.push(name);
  }
  return out.slice(0, list.max);
}

export const joinList = (list: PickList, entries: readonly string[]) => entries.join(list.joiner);

/** The entries that are not on the list. */
export const customEntries = (list: PickList, entries: readonly string[]) => entries.filter((s) => !list.canonical(s));

/** The seeker's skills (taxonomy.ts) as a list for the same picker. */
export const SKILL_LIST: PickList = {
  groups: SKILL_GROUPS,
  max: MAX_SKILLS,
  maxCustom: MAX_CUSTOM_SKILLS,
  itemLen: 40,
  joiner: ", ",
  split: /[,;\n]+/,
  canonical: canonicalSkill,
  search: searchSkills,
};

// ---------------------------------------------------------------- vacancy

/** Job titles by job function, the way job boards group them. */
export const POSITION_GROUPS: ListGroups = [
  ["Administrasi & umum", ["Staff Admin", "Admin Gudang", "Admin Penjualan", "Data Entry", "Resepsionis", "Sekretaris", "Staff General Affair", "Office Boy/Girl"]],
  ["Akuntansi & keuangan", ["Staff Akuntansi", "Staff Keuangan", "Staff Pajak", "Staff Payroll", "Auditor", "Finance Analyst", "Risk Analyst", "Collector"]],
  [
    "Penjualan & pemasaran",
    [
      "Sales Executive",
      "Sales Lapangan",
      "SPG/SPB",
      "Telemarketing",
      "Account Manager",
      "Business Development",
      "Digital Marketing",
      "Marketing Communication",
      "Social Media Specialist",
      "Content Creator",
    ],
  ],
  ["Layanan pelanggan", ["Customer Service", "Customer Care", "Call Center Agent", "Relationship Officer", "Teller"]],
  [
    "Teknologi informasi",
    [
      "Frontend Developer",
      "Backend Developer",
      "Fullstack Developer",
      "Mobile Developer",
      "Game Developer",
      "QA Engineer",
      "DevOps Engineer",
      "IT Support",
      "Network Engineer",
      "System Analyst",
      "IT Security Analyst",
      "UI/UX Designer",
      "Product Manager",
    ],
  ],
  ["Data", ["Data Analyst", "Data Scientist", "Data Engineer", "Business Analyst", "ML Engineer"]],
  ["Desain & kreatif", ["Desainer Grafis", "Motion Designer", "Video Editor", "Fotografer", "Ilustrator", "Copywriter", "Fashion Designer"]],
  [
    "Produksi & manufaktur",
    ["Operator Produksi", "Operator Forklift", "Quality Control", "PPIC Staff", "Teknisi Mesin", "Teknisi Listrik", "Maintenance", "Welder", "Supervisor Produksi"],
  ],
  ["Logistik & gudang", ["Staff Gudang", "Warehouse Supervisor", "Supply Chain Staff", "Purchasing", "Driver", "Kurir", "Helper"]],
  ["Teknik & konstruksi", ["Site Engineer", "Drafter", "Electrical Engineer", "Mechanical Engineer", "Estimator", "Surveyor", "Petugas K3"]],
  ["Kesehatan", ["Perawat", "Bidan", "Apoteker", "Asisten Apoteker", "Dokter Umum", "Analis Laboratorium", "Ahli Gizi"]],
  ["Pendidikan & pelatihan", ["Guru", "Tutor", "Trainer", "Curriculum Developer"]],
  ["Ritel", ["Kasir", "Pramuniaga", "Store Manager", "Visual Merchandiser", "Fashion Advisor", "Buyer"]],
  ["Perhotelan & F&B", ["Barista", "Cook", "Cook Helper", "Waiter/Waitress", "Housekeeping", "Front Office Agent"]],
  ["SDM & legal", ["HR Staff", "Recruiter", "HR Generalist", "Legal Staff"]],
  ["Manajemen", ["Management Trainee", "Supervisor", "Manager", "Project Manager"]],
  ["Lapangan & lainnya", ["Security", "Cleaning Service", "Field Officer", "Teknisi Lapangan"]],
];

/** The vacancy title: one to three positions, " / " between them ("Kasir / Pramuniaga"). */
export const POSITION_LIST = pickList(POSITION_GROUPS, {
  max: 3,
  maxCustom: 3,
  itemLen: 36,
  joiner: " / ",
  split: /\s+\/\s+/,
  aliases: {
    admin: "Staff Admin",
    cs: "Customer Service",
    "office boy": "Office Boy/Girl",
    ob: "Office Boy/Girl",
    satpam: "Security",
    spg: "SPG/SPB",
    spb: "SPG/SPB",
    "ui/ux": "UI/UX Designer",
    qc: "Quality Control",
  },
});

/** Schooling a vacancy accepts. */
export const EDUCATION_LIST = pickList([["Pendidikan", EDUCATION_LEVELS]], {
  max: EDUCATION_LEVELS.length,
  aliases: { sma: "SMA/SMK", smk: "SMA/SMK", slta: "SMA/SMK", sltp: "SMP", sarjana: "S1", magister: "S2", doktor: "S3" },
});

/** Experience a vacancy asks for. */
export const EXPERIENCE_LEVELS = ["Tidak perlu pengalaman", "Fresh graduate", "< 1 tahun", "1–3 tahun", "3–5 tahun", "5–10 tahun", "> 10 tahun"] as const;
export const EXPERIENCE_LIST = pickList([["Pengalaman", EXPERIENCE_LEVELS]], {
  max: 3,
  aliases: {
    "fresh graduated": "Fresh graduate",
    freshgraduate: "Fresh graduate",
    "tanpa pengalaman": "Tidak perlu pengalaman",
    "1-3 tahun": "1–3 tahun",
    "3-5 tahun": "3–5 tahun",
    "5-10 tahun": "5–10 tahun",
  },
});

/** Study fields (program studi and SMK jurusan) by field. */
export const MAJOR_GROUPS: ListGroups = [
  ["Umum", ["Semua jurusan"]],
  ["SMA", ["SMA IPA", "SMA IPS", "SMA Bahasa"]],
  [
    "SMK",
    [
      "SMK Teknik Mesin",
      "SMK Teknik Otomotif",
      "SMK Teknik Sepeda Motor",
      "SMK Teknik Pengelasan",
      "SMK Teknik Elektronika",
      "SMK Teknik Instalasi Tenaga Listrik",
      "SMK Teknik Kimia",
      "SMK Teknik Bangunan",
      "SMK Teknik Komputer dan Jaringan",
      "SMK Rekayasa Perangkat Lunak",
      "SMK Multimedia",
      "SMK Desain Komunikasi Visual",
      "SMK Akuntansi",
      "SMK Perkantoran",
      "SMK Pemasaran",
      "SMK Logistik",
      "SMK Perhotelan",
      "SMK Tata Boga",
      "SMK Tata Busana",
      "SMK Tata Kecantikan",
      "SMK Farmasi",
      "SMK Keperawatan",
      "SMK Agribisnis",
      "SMK Pelayaran",
    ],
  ],
  ["Komputer & TI", ["Teknik Informatika", "Ilmu Komputer", "Sistem Informasi", "Teknologi Informasi", "Teknik Komputer", "Manajemen Informatika", "Sains Data"]],
  [
    "Teknik",
    [
      "Teknik Sipil",
      "Arsitektur",
      "Teknik Mesin",
      "Teknik Elektro",
      "Teknik Industri",
      "Teknik Kimia",
      "Teknik Lingkungan",
      "Teknik Pertambangan",
      "Teknik Perminyakan",
      "Teknik Geologi",
      "Teknik Geodesi",
      "Teknik Fisika",
      "Teknik Metalurgi",
      "Teknik Perkapalan",
      "Teknik Mekatronika",
      "Perencanaan Wilayah dan Kota",
    ],
  ],
  [
    "Ekonomi & bisnis",
    [
      "Akuntansi",
      "Manajemen",
      "Ekonomi Pembangunan",
      "Ekonomi Syariah",
      "Administrasi Bisnis",
      "Bisnis Digital",
      "Perbankan dan Keuangan",
      "Perpajakan",
      "Logistik",
      "Manajemen Pemasaran",
      "Manajemen SDM",
    ],
  ],
  [
    "Sosial & humaniora",
    [
      "Ilmu Komunikasi",
      "Ilmu Hukum",
      "Psikologi",
      "Hubungan Internasional",
      "Administrasi Publik",
      "Sosiologi",
      "Ilmu Politik",
      "Sastra Inggris",
      "Sastra Jepang",
      "Sastra Mandarin",
      "Sastra Indonesia",
      "Pariwisata",
      "Perhotelan",
    ],
  ],
  ["MIPA", ["Matematika", "Statistika", "Aktuaria", "Fisika", "Kimia", "Biologi", "Geografi"]],
  [
    "Kesehatan",
    [
      "Kedokteran",
      "Kedokteran Gigi",
      "Keperawatan",
      "Kebidanan",
      "Farmasi",
      "Gizi",
      "Kesehatan Masyarakat",
      "Keselamatan dan Kesehatan Kerja",
      "Teknologi Laboratorium Medis",
      "Fisioterapi",
      "Rekam Medis",
    ],
  ],
  ["Pertanian & pangan", ["Agribisnis", "Agroteknologi", "Peternakan", "Perikanan", "Kehutanan", "Teknologi Pangan", "Teknik Pertanian", "Kedokteran Hewan"]],
  ["Pendidikan", ["PGSD", "PG PAUD", "Pendidikan Matematika", "Pendidikan Bahasa Inggris", "Pendidikan Agama Islam", "Bimbingan dan Konseling", "Pendidikan Jasmani"]],
  ["Seni & desain", ["Desain Komunikasi Visual", "Desain Interior", "Desain Produk", "Desain Mode", "Seni Rupa", "Film dan Televisi", "Animasi", "Musik"]],
];

export const MAJOR_LIST = pickList(MAJOR_GROUPS, {
  max: 8,
  maxCustom: 2,
  itemLen: 50,
  aliases: {
    informatika: "Teknik Informatika",
    ti: "Teknik Informatika",
    si: "Sistem Informasi",
    dkv: "Desain Komunikasi Visual",
    tkj: "SMK Teknik Komputer dan Jaringan",
    rpl: "SMK Rekayasa Perangkat Lunak",
    hukum: "Ilmu Hukum",
    k3: "Keselamatan dan Kesehatan Kerja",
    "semua jurusan": "Semua jurusan",
  },
});

/** Things a vacancy commonly asks besides skills; skills come from the seeker's list, so they match. */
export const GENERAL_QUALIFICATIONS = [
  "Komunikatif",
  "Teliti",
  "Jujur dan bertanggung jawab",
  "Mampu bekerja dalam tim",
  "Mampu bekerja di bawah tekanan",
  "Target oriented",
  "Bersedia kerja shift",
  "Bersedia ditempatkan di luar kota",
  "Bersedia dinas ke luar kota",
  "Berpenampilan rapi",
  "Sehat jasmani dan rohani",
  "Tidak buta warna",
  "Memiliki SIM A",
  "Memiliki SIM C",
  "Memiliki kendaraan sendiri",
  "Memiliki laptop sendiri",
  "Memiliki portofolio",
  "Memiliki STR aktif",
  "Memiliki sertifikat kompetensi",
  "IPK minimal 3,00",
  "Fresh graduate dipersilakan",
  "Mahasiswa tingkat akhir",
] as const;

/** The vacancy's qualifications: what the candidate matching reads. Kept as the same string array. */
export const QUALIFICATION_LIST = pickList([["Umum", GENERAL_QUALIFICATIONS], ...SKILL_GROUPS], { max: 12, maxCustom: 6, itemLen: 80, canonical: canonicalSkill });

/** Not one place: the job may be anywhere, or abroad. */
export const NATIONWIDE = "Seluruh Indonesia";

/** Where the job is: kabupaten and kota from the regions list. */
export const LOCATION_LIST = pickList([["Umum", [NATIONWIDE, ABROAD]], ...REGIONS], {
  max: 10,
  search: (q, chosen = [], limit = 8) => {
    const have = new Set(chosen.map(fold));
    const extra = fold(NATIONWIDE).includes(fold(q)) && fold(q) ? [NATIONWIDE] : [];
    return [...extra, ...searchRegions(q, limit + chosen.length).map((h) => h.region)].filter((r) => !have.has(fold(r))).slice(0, limit);
  },
  note: (s) => provinceOf(s),
});

/** How the work is done; shown after the places, as the job's location used to say "(Hybrid)". */
export const WORK_MODES = ["Di kantor", "Hybrid", "Remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const workModeOf = (location: string | undefined): WorkMode => (/remote|wfh/i.test(location ?? "") ? "Remote" : /hybrid/i.test(location ?? "") ? "Hybrid" : "Di kantor");

/** "Kota Jakarta Selatan" → "Jakarta Selatan", and a short line for the job's location from its places. */
export function locationText(places: readonly string[], mode: WorkMode): string {
  const names = places.map((p) => p.replace(/^(Kota|Kab\.)\s+/, ""));
  const shown = names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} kota` : names.join(", ");
  if (mode === "Remote") return shown ? `Remote (${shown})` : "Remote";
  return mode === "Hybrid" && shown ? `${shown} (Hybrid)` : shown;
}

/** The provinces of a job's places, for the report's province column. */
export const provincesOf = (places: readonly string[]) => [...new Set(places.map((p) => provinceOf(p)).filter((p): p is string => !!p))];

// ---------------------------------------------------------------- company profile

export const INDUSTRIES = [
  "Teknologi",
  "E-commerce",
  "Fintech",
  "Data & AI",
  "Telekomunikasi",
  "Perbankan",
  "Asuransi",
  "Jasa Keuangan",
  "Ritel",
  "Ritel Fashion",
  "F&B",
  "FMCG",
  "Manufaktur",
  "Otomotif",
  "Tekstil & Garmen",
  "Kimia",
  "Logistik",
  "Transportasi",
  "Energi",
  "Pertambangan",
  "Minyak & Gas",
  "Konstruksi",
  "Properti",
  "Kesehatan",
  "Farmasi",
  "Kecantikan",
  "Pendidikan",
  "Media & Kreatif",
  "Gim & Hiburan",
  "Perhotelan",
  "Pariwisata",
  "Agribisnis",
  "Perikanan",
  "Konsultan",
  "Jasa Profesional",
  "Pemerintahan",
  "Organisasi Nirlaba",
  "UMKM",
  "Umum",
] as const;

/** The company's industry: up to three, the first one shown first. */
export const INDUSTRY_LIST = pickList([["Industri", INDUSTRIES]], {
  max: 3,
  aliases: { tech: "Teknologi", it: "Teknologi", bank: "Perbankan", retail: "Ritel", fnb: "F&B", "food & beverage": "F&B", migas: "Minyak & Gas" },
});

/** Headcount bands, as job boards and LinkedIn list them. */
export const EMPLOYEE_BANDS = [
  "1–10 karyawan",
  "11–50 karyawan",
  "51–200 karyawan",
  "201–500 karyawan",
  "501–1.000 karyawan",
  "1.001–5.000 karyawan",
  "5.001–10.000 karyawan",
  "10.000+ karyawan",
] as const;
const BAND_TOP = [10, 50, 200, 500, 1000, 5000, 10000, Number.POSITIVE_INFINITY];

export const isEmployeeBand = (s: string | undefined) => !!s && (EMPLOYEE_BANDS as readonly string[]).includes(s);

/** The band an old free-typed headcount falls in ("15.000+ karyawan", "200–500"): its largest number decides. */
export function employeeBand(text: string | undefined): (typeof EMPLOYEE_BANDS)[number] | null {
  if (!text) return null;
  if (isEmployeeBand(text)) return text as (typeof EMPLOYEE_BANDS)[number];
  const nums = [...text.matchAll(/\d+(?:\.\d{3})*/g)].map((m) => Number(m[0].replace(/\./g, ""))).filter((n) => n > 0);
  if (!nums.length) return null;
  const n = Math.max(...nums);
  // "10.000+" means more than ten thousand.
  const top = /\+/.test(text) ? n + 1 : n;
  return EMPLOYEE_BANDS[BAND_TOP.findIndex((t) => top <= t)]!;
}

// ---------------------------------------------------------------- saving

/** Most vacancies one booth keeps, open and closed. */
export const MAX_JOBS = 60;

/** The profile's industry and headcount, bounded; old free text passes as it is. */
export const cleanIndustry = (v: unknown) => (typeof v === "string" ? joinList(INDUSTRY_LIST, parseList(INDUSTRY_LIST, v, 40)).slice(0, 140) : undefined);
export const cleanEmployees = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) || undefined : undefined);
