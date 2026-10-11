import { describe, expect, it } from "vitest";
import {
  type CompanyBooth,
  DEMO_JOB_FAIR,
  type JobPosting,
  PRICE_CATALOG,
  buildJobFairFloor,
  canOpenAnotherJob,
  featuredFirst,
  featuredJobs,
  hasStand,
  isFeatured,
  limitOpenJobs,
  openJobs,
  priceFrom,
  productAllowed,
} from "../src";

const job = (id: string, closed = false): JobPosting => ({ id, title: id, type: "Full-time", location: "Jakarta", requirements: [], ...(closed ? { closed } : {}) });

describe("booth packages", () => {
  it("prices the mini package and the featured vacancy, both editable by the organiser", () => {
    expect(PRICE_CATALOG.find((p) => p.key === "stand.mini")?.group).toBe("Sewa stand");
    expect(PRICE_CATALOG.find((p) => p.key === "product.featured")).toBeTruthy();
    expect(priceFrom(null, "stand.mini")).toBeLessThan(priceFrom(null, "stand.regular"));
    expect(priceFrom({ "stand.mini": 250_000 }, "stand.mini")).toBe(250_000);
  });

  it("keeps a mini booth to one open vacancy and leaves the others alone", () => {
    const jobs = [job("a"), job("b", true), job("c"), job("d")];
    expect(limitOpenJobs("mini", jobs).map((j) => !!j.closed)).toEqual([false, true, true, true]);
    expect(limitOpenJobs("regular", jobs)).toEqual(jobs);
    expect(limitOpenJobs(undefined, jobs).filter((j) => !j.closed)).toHaveLength(3);

    const mini = { tier: "mini", jobs: [job("a"), job("b", true)] };
    expect(canOpenAnotherJob(mini)).toBe(false);
    // Editing the open vacancy itself is fine; reopening the closed one is not.
    expect(canOpenAnotherJob(mini, "a")).toBe(true);
    expect(canOpenAnotherJob(mini, "b")).toBe(false);
    expect(canOpenAnotherJob({ tier: "mini", jobs: [job("a", true)] })).toBe(true);
    expect(canOpenAnotherJob({ tier: "regular", jobs: [job("a"), job("b")] })).toBe(true);
  });

  it("sells a mini booth only what it can use", () => {
    expect(productAllowed("mini", "featured")).toBe(true);
    expect(productAllowed("mini", "promoter")).toBe(true);
    expect(productAllowed("mini", "vip")).toBe(false);
    expect(productAllowed("mini", "photobooth")).toBe(false);
    expect(productAllowed("regular", "vip")).toBe(true);
    expect(productAllowed(undefined, "featured")).toBe(true);
  });

  it("puts the featured vacancy first, only while it is open", () => {
    const b = { featuredJob: "c", jobs: [job("a"), job("b"), job("c")] };
    expect(openJobs(b).map((j) => j.id)).toEqual(["c", "a", "b"]);
    expect(isFeatured(b, "c")).toBe(true);
    const closed = { featuredJob: "c", jobs: [job("a"), job("c", true)] };
    expect(openJobs(closed).map((j) => j.id)).toEqual(["a"]);
    expect(isFeatured(closed, "c")).toBe(false);
    expect(featuredJobs([b, closed, { jobs: [job("x")] }]).map((f) => f.job.id)).toEqual(["c"]);

    const plain = { jobs: [job("x"), job("y")] };
    const list = [
      { booth: plain, job: plain.jobs[0]! },
      { booth: b, job: b.jobs[0]! },
      { booth: b, job: b.jobs[2]! },
      { booth: plain, job: plain.jobs[1]! },
    ];
    expect(featuredFirst(list).map((x) => x.job.id)).toEqual(["c", "x", "a", "y"]);
    expect(featuredFirst([list[0]!, list[3]!])).toEqual([list[0], list[3]]);
  });

  it("builds a hall without a stand for a mini booth, so existing floors stay as they are", () => {
    const before = buildJobFairFloor(DEMO_JOB_FAIR, 0);
    const mini: CompanyBooth = { ...DEMO_JOB_FAIR.booths[0]!, id: "umkm-kopi", tier: "mini", x: 0, y: 0 };
    expect(hasStand(mini)).toBe(false);
    expect(hasStand(DEMO_JOB_FAIR.booths[0]!)).toBe(true);
    const after = buildJobFairFloor({ ...DEMO_JOB_FAIR, booths: [...DEMO_JOB_FAIR.booths, mini] }, 0);
    expect(after.objects).toEqual(before.objects);
    expect(after.seats).toEqual(before.seats);
  });
});
