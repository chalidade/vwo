import { describe, expect, it } from "vitest";
import {
  type CompanyBooth,
  type JobPosting,
  type PoolApplication,
  educationOf,
  filterPool,
  outsiderMember,
  pageOf,
  poolFacets,
  poolMembers,
  rankCandidates,
  shortName,
  hasSkill,
  inPlace,
  textOf,
} from "../src";

const app = (over: Partial<PoolApplication> & { data?: Record<string, unknown> }): PoolApplication => ({
  id: "a1",
  seeker: "u1",
  boothId: "nusa",
  jobId: "fe",
  jobTitle: "Frontend Developer",
  status: "Terkirim",
  at: 1000,
  data: {},
  ...over,
});

const job: JobPosting = { id: "be", title: "Backend Developer Node.js", type: "Full-time", location: "Jakarta", requirements: ["Node.js", "PostgreSQL"] };
const booth = { id: "nusa", company: "Nusa", industry: "Teknologi", jobs: [job] } as unknown as CompanyBooth;

describe("talent pool", () => {
  it("keeps one row per seeker, contact from their newest application and skills from their profile", () => {
    const apps = [
      app({ id: "old", at: 1, data: { name: "Sari", email: "lama@mail.example", skills: "Excel" } }),
      app({
        id: "new",
        jobId: "be",
        jobTitle: "Backend",
        at: 5,
        status: "Shortlist",
        data: { name: "Sari Wulandari", email: "sari@mail.example", phone: "0812", skills: "Node.js" },
      }),
      app({ id: "b", seeker: "u2", at: 3, data: { name: "Budi" } }),
    ];
    const profiles = new Map([["u1", { skills: ["Node.js", "PostgreSQL"], city: "Kota Surabaya" }]]);
    const pool = poolMembers(apps, profiles);
    expect(pool.map((m) => m.seeker)).toEqual(["u1", "u2"]);
    const sari = pool[0]!;
    expect(sari).toMatchObject({
      name: "Sari Wulandari",
      email: "sari@mail.example",
      phone: "0812",
      skills: "Node.js, PostgreSQL",
      city: "Kota Surabaya",
      applicant: true,
      contactable: true,
      lastAt: 5,
    });
    expect(sari.applications.map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("respects a seeker who switched contact off", () => {
    const [m] = poolMembers([app({ data: { name: "Sari" } })], new Map([["u1", { contactable: false }]]));
    expect(m!.contactable).toBe(false);
  });

  it("shows an opted-in stranger without name, photo or contact details", () => {
    const m = outsiderMember("h_x", { name: "Sari Wulandari", email: "sari@mail.example", phone: "0812", photo: "data:image/png;base64,AA", skills: "React" }, 9);
    expect(m.name).toBe("Sari W.");
    expect(m.email).toBeUndefined();
    expect(m.phone).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain("0812");
    expect(JSON.stringify(m)).not.toContain("data:image");
    expect(shortName("")).toBe("Pencari kerja");
  });

  it("filters by skill, province, domisili, education level and status, newest first", () => {
    const pool = poolMembers([
      // Old free text: read with the pick list's spellings.
      app({ seeker: "a", at: 1, data: { name: "A", skills: "reactjs, excel", city: "Kota Jakarta Selatan", education: "S1 Informatika" } }),
      app({ seeker: "b", at: 2, status: "Shortlist", data: { name: "B", skills: "JavaScript", city: "Kota Bandung", education: "SMK TKJ" } }),
    ]);
    expect(filterPool(pool, { skill: "React" }).map((m) => m.seeker)).toEqual(["a"]);
    expect(filterPool(pool, { skill: "Microsoft Excel" }).map((m) => m.seeker)).toEqual(["a"]);
    // A dropdown value matches a whole skill, not part of one.
    expect(filterPool(pool, { skill: "Java" })).toEqual([]);
    expect(filterPool(pool, { city: "Kota Bandung" }).map((m) => m.seeker)).toEqual(["b"]);
    expect(filterPool(pool, { province: "DKI Jakarta" }).map((m) => m.seeker)).toEqual(["a"]);
    expect(filterPool(pool, { province: "DKI Jakarta", city: "Kota Bandung" })).toEqual([]);
    expect(filterPool(pool, { education: "S1/D4" }).map((m) => m.seeker)).toEqual(["a"]);
    expect(filterPool(pool, { status: "Shortlist" }).map((m) => m.seeker)).toEqual(["b"]);
    expect(filterPool(pool, {}).map((m) => m.seeker)).toEqual(["b", "a"]);
    const facets = poolFacets(pool);
    expect(facets.skills.map((s) => s.value)).toEqual(["JavaScript", "Microsoft Excel", "React"]);
    expect(facets.provinces.map((s) => s.value).sort()).toEqual(["DKI Jakarta", "Jawa Barat"]);
    expect(facets.cities.find((c) => c.value === "Kota Bandung")?.province).toBe("Jawa Barat");
    expect(educationOf("D3 Akuntansi")).toBe("D3");
  });

  it("pages a list", () => {
    const list = Array.from({ length: 65 }, (_, i) => i);
    expect(pageOf(list, 2)).toMatchObject({ items: [60, 61, 62, 63, 64], total: 65, page: 2, pageSize: 30 });
    expect(pageOf(list, -3).page).toBe(0);
  });

  it("ranks candidates for a vacancy with the seeker matcher, leaving out who already applied to it", () => {
    const pool = poolMembers([
      app({ seeker: "fit", data: { name: "Fit", skills: "Node.js, PostgreSQL", city: "Jakarta" } }),
      app({ seeker: "done", jobId: "be", data: { name: "Done", skills: "Node.js" } }),
      app({ seeker: "nope", data: { name: "Nope", skills: "Menjahit" } }),
    ]);
    const stranger = outsiderMember("h_1", { name: "Lain", skills: "Node.js" }, 0);
    const ranked = rankCandidates([...pool, stranger], booth, job);
    expect(ranked.map((c) => c.member.seeker)).toEqual(["fit", "h_1"]);
    expect(ranked[0]!.why).toContain("Node.js");
    expect(ranked[0]!.why).toContain("Jakarta");
  });

  it("reads list or text fields as text", () => {
    expect(textOf(["React", 3, "Go"])).toBe("React, Go");
    expect(textOf({ x: 1 })).toBe("");
    expect(hasSkill("React; react, Go\nSQL", "go")).toBe(true);
    expect(inPlace("Kota Surabaya", { province: "Jawa Timur" })).toBe(true);
    expect(inPlace("Surabaya", { province: "Jawa Timur" })).toBe(false);
  });
});
