import { DEMO_JOB_FAIR } from "@vwo/shared";
import { describe, expect, it } from "vitest";
import { canRecommend, recommendBooths, recommendJobs, words } from "../src/fair/recommend";

const booths = DEMO_JOB_FAIR.booths;

describe("recommendations", () => {
  it("splits text into meaningful words", () => {
    expect(words("2+ tahun React atau Vue, paham TypeScript")).toEqual(["react", "vue", "typescript"]);
    expect(words("Backend Engineer (Go)")).toContain("go");
  });

  it("puts a frontend developer's jobs first", () => {
    const top = recommendJobs(
      {
        skills: "React, TypeScript",
        city: "Jakarta",
        education: "S1 Informatika",
      },
      booths,
    );
    expect(top[0]!.job.title).toBe("Frontend Developer");
    expect(top[0]!.why).toContain("React");
    expect(top[0]!.why).toContain("Jakarta");
  });

  it("recommends nothing unrelated and skips applied or closed jobs", () => {
    expect(recommendJobs({ skills: "zzzz" }, booths)).toEqual([]);
    expect(recommendJobs({ city: "Jakarta" }, booths)).toEqual([]);
    const top = recommendJobs({ skills: "React" }, booths, new Set(["nt-fe"]));
    expect(top.some((m) => m.job.id === "nt-fe")).toBe(false);
  });

  it("prefers internships for students", () => {
    const top = recommendJobs({ headline: "Mahasiswa tingkat akhir", skills: "Figma" }, booths);
    expect(top[0]!.job.type).toBe("Magang");
    expect(top[0]!.why).toContain("cocok untuk mahasiswa");
  });

  it("groups matches by booth", () => {
    const b = recommendBooths({ skills: "React, Go, PostgreSQL" }, booths);
    expect(b[0]!.booth.id).toBe("nusantara-tech");
    expect(b[0]!.jobs.length).toBeGreaterThan(1);
  });

  it("needs something in the profile", () => {
    expect(canRecommend({ city: "Bandung" })).toBe(false);
    expect(canRecommend({ skills: "Excel" })).toBe(true);
  });

  it("lifts a matching featured vacancy to the top, but never an unrelated one", () => {
    const p = { skills: "React, TypeScript", city: "Jakarta", education: "S1 Informatika" };
    const plain = recommendJobs(p, booths, new Set(), 20);
    const second = plain[1]!;
    const withFeatured = booths.map((b) => (b.id === second.booth.id ? { ...b, featuredJob: second.job.id } : b));
    expect(recommendJobs(p, withFeatured, new Set(), 20)[0]!.job.id).toBe(second.job.id);
    // A featured vacancy that doesn't match the profile stays out.
    const other = booths.find((b) => !plain.some((m) => m.booth.id === b.id))!;
    const unrelated = booths.map((b) => (b.id === other.id ? { ...b, featuredJob: b.jobs[0]!.id } : b));
    expect(recommendJobs(p, unrelated, new Set(), 20).some((m) => m.booth.id === other.id)).toBe(false);
  });
});
