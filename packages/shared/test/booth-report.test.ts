import { describe, expect, it } from "vitest";
import { composeBoothReport, educationGroup, reportDeltas, topBuckets, type ReportApplication } from "../src";

const app = (userId: string, status: string, extra: Partial<ReportApplication> = {}): ReportApplication => ({ userId, jobKey: "be", jobTitle: "Backend", status, ...extra });
const base = {
  boothKey: "nusa",
  since: null,
  until: 1,
  visits: 40,
  visitors: 20,
  applications: [] as ReportApplication[],
  spend: { registration: 7_500_000, invoices: 500_000, stalls: 0 },
};

describe("topBuckets", () => {
  it("merges spellings, keeps the top, and adds the rest and blanks", () => {
    expect(topBuckets(["Jakarta", " jakarta ", "Jakarta", "Bandung", "Surabaya", "", undefined, "Medan"], 2)).toEqual([
      { label: "Jakarta", n: 3 },
      { label: "Bandung", n: 1 },
      { label: "Lainnya", n: 2 },
      { label: "Tidak diisi", n: 2 },
    ]);
  });
});

describe("educationGroup", () => {
  it("reads the level from free text", () => {
    expect(educationGroup("S1 Teknik Informatika, ITS")).toBe("S1");
    expect(educationGroup("Sarjana Terapan Akuntansi")).toBe("D4");
    expect(educationGroup("D3 Manajemen Informatika")).toBe("D3");
    expect(educationGroup("SMK Negeri 1 Surabaya")).toBe("SMA/SMK");
    expect(educationGroup("Magister Manajemen")).toBe("S2");
    expect(educationGroup("Kursus online")).toBe("Lainnya");
    expect(educationGroup("  ")).toBeUndefined();
  });
});

describe("composeBoothReport", () => {
  const report = composeBoothReport({
    ...base,
    applications: [
      app("a", "Terkirim", { city: "Jakarta", education: "S1 Informatika", skills: "React, SQL" }),
      app("a", "Diterima", { jobKey: "fe", jobTitle: "Frontend", city: "Jakarta", education: "S1 Informatika" }),
      app("b", "Belum cocok", { city: "Bandung", verified: true, psych: 80 }),
      app("c", "Diundang interview", { psych: 60 }),
    ],
  });

  it("counts people once and applications each", () => {
    expect(report.applicants).toBe(3);
    expect(report.applications).toBe(4);
    expect(report.hired).toBe(1);
    expect(report.rejected).toBe(1);
    expect(report.verified).toBe(1);
    expect(report.psychAverage).toBe(70);
    expect(report.conversion).toBeCloseTo(3 / 20);
  });

  it("builds a funnel that never grows, with turned-down applications counted as seen", () => {
    expect(report.funnel.map((f) => f.n)).toEqual([4, 3, 2, 2, 1, 1, 1]);
  });

  it("divides spend by applicants", () => {
    expect(report.spend.total).toBe(8_000_000);
    expect(report.costPerApplicant).toBe(Math.round(8_000_000 / 3));
    expect(composeBoothReport(base).costPerApplicant).toBeNull();
  });

  it("splits applications by job", () => {
    expect(report.byJob).toEqual([
      { label: "Backend", n: 3 },
      { label: "Frontend", n: 1 },
    ]);
  });
});

describe("reportDeltas", () => {
  it("compares with an earlier report", () => {
    const before = composeBoothReport({ ...base, visits: 20, applications: [app("x", "Terkirim"), app("y", "Terkirim")] });
    const now = composeBoothReport({ ...base, applications: [app("x", "Terkirim"), app("y", "Terkirim"), app("z", "Terkirim"), app("w", "Terkirim")] });
    const d = Object.fromEntries(reportDeltas(now, before).map((r) => [r.key, r]));
    expect(d.visits).toMatchObject({ now: 40, before: 20, change: 20, pct: 1 });
    expect(d.cpa).toMatchObject({ now: 2_000_000, before: 4_000_000, change: -2_000_000, pct: -0.5, better: "down" });
    expect(d.rating).toMatchObject({ now: null, change: null, pct: null });
  });
});
