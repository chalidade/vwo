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
});
