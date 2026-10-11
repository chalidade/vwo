import { describe, expect, it } from "vitest";
import {
  type CompanyBooth,
  EDUCATION_LIST,
  EMPLOYEE_BANDS,
  EXPERIENCE_LIST,
  INDUSTRY_LIST,
  LOCATION_LIST,
  MAJOR_LIST,
  NATIONWIDE,
  POSITION_LIST,
  QUALIFICATION_LIST,
  SKILL_LIST,
  cleanIndustry,
  cleanJobs,
  customEntries,
  employeeBand,
  joinList,
  locationText,
  parseList,
  parseSkills,
  provincesOf,
  scoreJob,
  workModeOf,
} from "../src";

describe("job lists", () => {
  it("has no repeats, and no separator inside an entry stored as text", () => {
    for (const list of [POSITION_LIST, EDUCATION_LIST, EXPERIENCE_LIST, MAJOR_LIST, INDUSTRY_LIST, LOCATION_LIST, QUALIFICATION_LIST]) {
      const all = list.groups.flatMap(([, l]) => l);
      expect(new Set(all.map((s) => s.toLowerCase())).size).toBe(all.length);
    }
    for (const list of [EDUCATION_LIST, EXPERIENCE_LIST, MAJOR_LIST, INDUSTRY_LIST, LOCATION_LIST])
      for (const [, l] of list.groups) for (const s of l) expect(s, s).not.toMatch(list.split);
    for (const [, l] of POSITION_LIST.groups) for (const s of l) expect(s).not.toMatch(/\s\/\s/);
  });

  it("parses stored text into list spellings without repeats, keeping old free text", () => {
    expect(parseList(MAJOR_LIST, "teknik informatika, DKV; Akuntansi, akuntansi")).toEqual(["Teknik Informatika", "Desain Komunikasi Visual", "Akuntansi"]);
    expect(parseList(EDUCATION_LIST, "sma, S1")).toEqual(["SMA/SMK", "S1"]);
    expect(parseList(EXPERIENCE_LIST, "Min. 1 tahun / fresh graduate")).toEqual(["Min. 1 tahun / fresh graduate"]);
    expect(customEntries(EXPERIENCE_LIST, ["Fresh graduate", "Min. 1 tahun"])).toEqual(["Min. 1 tahun"]);
    expect(parseList(MAJOR_LIST, undefined)).toEqual([]);
    expect(parseList(EXPERIENCE_LIST, "Fresh graduate, < 1 tahun, 1–3 tahun, 3–5 tahun")).toHaveLength(EXPERIENCE_LIST.max);
  });

  it("keeps the title's positions apart with a slash and spaces only", () => {
    expect(parseList(POSITION_LIST, "Kasir / pramuniaga")).toEqual(["Kasir", "Pramuniaga"]);
    expect(parseList(POSITION_LIST, "UI/UX Designer Intern")).toEqual(["UI/UX Designer Intern"]);
    expect(joinList(POSITION_LIST, ["Kasir", "Pramuniaga"])).toBe("Kasir / Pramuniaga");
  });

  it("takes qualifications entry by entry, commas and all", () => {
    expect(parseList(QUALIFICATION_LIST, ["S1 Statistika, Matematika, atau Ekonomi", "excel", "Komunikatif"])).toEqual([
      "S1 Statistika, Matematika, atau Ekonomi",
      "Microsoft Excel",
      "Komunikatif",
    ]);
  });

  it("matches the skill parser for the seeker's skills", () => {
    const text = "js, Excel, excel, Memasak rendang";
    expect(parseList(SKILL_LIST, text, 40)).toEqual(parseSkills(text));
  });

  it("searches by start of entry, then of a word, then the group", () => {
    expect(MAJOR_LIST.search("akun")[0]).toBe("Akuntansi");
    expect(MAJOR_LIST.search("akun")).toContain("SMK Akuntansi");
    expect(MAJOR_LIST.search("dkv")[0]).toBe("Desain Komunikasi Visual");
    expect(MAJOR_LIST.search("smk", ["SMK Teknik Mesin"])).not.toContain("SMK Teknik Mesin");
    expect(POSITION_LIST.search("developer")).toContain("Frontend Developer");
    expect(POSITION_LIST.search("kesehatan")).toContain("Perawat");
  });

  it("finds places, the nationwide entry and their provinces", () => {
    expect(LOCATION_LIST.search("bandung")[0]).toBe("Kota Bandung");
    expect(LOCATION_LIST.search("seluruh")).toEqual([NATIONWIDE]);
    expect(LOCATION_LIST.search("bandung", ["Kota Bandung"])).not.toContain("Kota Bandung");
    expect(LOCATION_LIST.note?.("Kota Bandung")).toBe("Jawa Barat");
    expect(provincesOf(["Kota Bandung", "Kab. Bandung", "Kota Surabaya", NATIONWIDE])).toEqual(["Jawa Barat", "Jawa Timur"]);
  });

  it("writes the job's location line from its places and work mode", () => {
    expect(locationText(["Kota Jakarta Selatan"], "Hybrid")).toBe("Jakarta Selatan (Hybrid)");
    expect(locationText(["Kota Bandung", "Kab. Bogor"], "Di kantor")).toBe("Bandung, Bogor");
    expect(locationText([], "Remote")).toBe("Remote");
    expect(locationText(["Kota Bandung", "Kota Bogor", "Kota Depok", "Kota Bekasi"], "Di kantor")).toBe("Bandung, Bogor, Depok +1 kota");
    expect(workModeOf("Jakarta (Hybrid)")).toBe("Hybrid");
    expect(workModeOf("Remote")).toBe("Remote");
    expect(workModeOf("Semua kota")).toBe("Di kantor");
  });

  it("puts an old headcount in its band", () => {
    expect(employeeBand("15.000+ karyawan")).toBe("10.000+ karyawan");
    expect(employeeBand("10.000+ karyawan")).toBe("10.000+ karyawan");
    expect(employeeBand("1.200+ karyawan")).toBe("1.001–5.000 karyawan");
    expect(employeeBand("200–500")).toBe("201–500 karyawan");
    expect(employeeBand("180+ karyawan")).toBe("51–200 karyawan");
    expect(employeeBand("5")).toBe("1–10 karyawan");
    expect(employeeBand("banyak")).toBeNull();
    for (const b of EMPLOYEE_BANDS) expect(employeeBand(b)).toBe(b);
  });
});

describe("cleanJobs", () => {
  it("keeps known fields, cleans the lists and bounds every text", () => {
    const [job, ...rest] = cleanJobs([
      {
        id: "b-job-1",
        title: "kasir / Pramuniaga",
        type: "Full-time",
        location: "Bandung",
        requirements: ["excel", "", "x".repeat(500), ...Array.from({ length: 20 }, (_, i) => `Syarat ${i}`)],
        description: "d".repeat(5000),
        education: "sma, s1, S1",
        major: "informatika",
        experience: "Fresh graduate",
        city: "kota bandung, Kota Bandung",
        quota: 5000,
        deadline: "besok",
        hacked: "<script>",
      },
      { id: "bad id!", title: "X", type: "Full-time", location: "", requirements: [] },
      { id: "no-title", title: "  ", type: "Full-time", location: "", requirements: [] },
      "junk",
      { id: "odd-type", title: "Driver", type: "Freelance", location: "Jakarta", requirements: "not a list" },
    ]);
    expect(job).toMatchObject({
      id: "b-job-1",
      title: "Kasir / Pramuniaga",
      education: "SMA/SMK, S1",
      major: "Teknik Informatika",
      city: "Kota Bandung",
    });
    expect(job!.requirements[0]).toBe("Microsoft Excel");
    expect(job!.requirements).toHaveLength(QUALIFICATION_LIST.max);
    expect(job!.requirements[1]!.length).toBeLessThanOrEqual(120);
    expect(job!.description!.length).toBe(1200);
    expect(job).not.toHaveProperty("quota");
    expect(job).not.toHaveProperty("deadline");
    expect(job).not.toHaveProperty("hacked");
    expect(rest).toEqual([{ id: "odd-type", title: "Driver", type: "Full-time", location: "Jakarta", requirements: [] }]);
  });

  it("caps how many vacancies a booth keeps", () => {
    expect(cleanJobs(Array.from({ length: 100 }, (_, i) => ({ id: `j${i}`, title: "Kasir", type: "Kontrak", location: "", requirements: [] })))).toHaveLength(60);
    expect(cleanJobs("nope")).toEqual([]);
  });

  it("bounds the industry and keeps up to three", () => {
    expect(cleanIndustry("teknologi, Ritel, F&B, Energi")).toBe("Teknologi, Ritel, F&B");
    expect(cleanIndustry("Jasa pembersihan gedung")).toBe("Jasa pembersihan gedung");
    expect(cleanIndustry(42)).toBeUndefined();
  });
});

describe("matching with picked fields", () => {
  const booth = { id: "b", company: "PT A", industry: "Ritel", jobs: [] } as unknown as CompanyBooth;
  const job = (over: object) => ({ id: "j", title: "Staff Akuntansi", type: "Full-time" as const, location: "Bandung, Surabaya", requirements: ["Teliti"], ...over });

  it("reads the picked study field and places", () => {
    const m = scoreJob(
      { education: "S1 Akuntansi", city: "Kota Surabaya" },
      booth,
      job({ title: "Staff Keuangan", major: "Akuntansi, Manajemen", city: "Kota Bandung, Kota Surabaya" }),
    );
    expect(m.score).toBeGreaterThan(0);
    expect(m.why).toContain("Surabaya");
  });

  it("takes the lowest picked schooling as what the job asks", () => {
    const p = { education: "SMK Akuntansi" };
    const open = scoreJob(p, booth, job({ education: "SMA/SMK, S1" }));
    const strict = scoreJob(p, booth, job({ education: "S1" }));
    expect(open.score).toBeGreaterThan(strict.score);
  });
});
