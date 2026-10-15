import {
  BOOTH_H,
  type CompanyBooth,
  DEMO_JOB_FAIR,
  PARK,
  boothFrame,
  buildJobFairFloors,
  fairFloorId,
  fairRoomFloorId,
  hasStand,
  libraryFloorId,
  openJobs,
  parkFloorId,
} from "@vwo/shared";
import { describe, expect, it } from "vitest";
import { companiesOn, filterCompanies, floorPlan, mapCategories, planScrollFor } from "../src/fair/map";

const fair = DEMO_JOB_FAIR;
const floors = buildJobFairFloors(fair);
const floor = (id: string) => floors.find((f) => f.id === id)!;
const booth = (over: Partial<CompanyBooth>): CompanyBooth => ({ ...fair.booths[0]!, id: "x", company: "X", jobs: [], ...over });

describe("floor plan", () => {
  it("draws every stand of a hall with its footprint and open vacancies", () => {
    const plan = floorPlan(fair, floor(fairFloorId(fair, 0)));
    const stands = fair.booths.filter((b) => b.floor === 0 && hasStand(b));
    expect(plan.width).toBe(fair.width);
    expect(plan.booths.map((b) => b.id).sort()).toEqual(stands.map((b) => b.id).sort());
    for (const s of stands) {
      const p = plan.booths.find((b) => b.id === s.id)!;
      expect(p).toMatchObject({ x: boothFrame(s).x, y: s.y, w: boothFrame(s).width, h: BOOTH_H, jobs: openJobs(s).length, vip: s.tier === "premium" });
    }
  });

  it("labels the lift and the info desk, and leaves out walls hidden under the stands", () => {
    const plan = floorPlan(fair, floor(fairFloorId(fair, 1)));
    expect(plan.shapes.some((s) => s.kind === "lift" && s.label === "Lift")).toBe(true);
    expect(plan.shapes.some((s) => s.kind === "desk" && s.label === "Info")).toBe(true);
    expect(plan.shapes.some((s) => s.label === "Lounge")).toBe(true);
    for (const b of plan.booths)
      for (const s of plan.shapes.filter((x) => x.kind === "block")) expect(s.x < b.x + b.w && b.x < s.x + s.w && s.y < b.y + b.h && b.y < s.y + s.h).toBe(false);
  });

  it("shows the coin stand and the door to the park on the entrance hall", () => {
    const plan = floorPlan(fair, floor(fairFloorId(fair, 0)));
    expect(plan.shapes.some((s) => s.kind === "coins")).toBe(true);
    expect(plan.shapes.some((s) => s.kind === "door")).toBe(true);
  });

  it("labels each room floor's places and has no stands there", () => {
    const aula = floorPlan(fair, floor(fairRoomFloorId(fair, "aula")));
    expect(aula.booths).toEqual([]);
    expect(aula.shapes.some((s) => s.kind === "stage" && s.label === "Panggung")).toBe(true);
    const food = fair.rooms.find((r) => r.kind === "foodcourt")!;
    const court = floorPlan(fair, floor(fairRoomFloorId(fair, food.id)));
    expect(court.shapes.filter((s) => s.kind === "stall").map((s) => s.label)).toEqual(food.stalls!.map((st) => st.name));
  });

  it("draws the park with its buildings and the organiser's next events", () => {
    const plan = floorPlan(fair, floor(parkFloorId(fair)), [{ id: "expo", name: "Expo 2027", status: "soon" }]);
    expect(plan.width).toBe(PARK.width);
    expect(plan.shapes.find((s) => s.label === "Perpustakaan")?.kind).toBe("building");
    expect(plan.shapes.find((s) => s.kind === "soon")).toMatchObject({ label: "Expo 2027", x: PARK.plots[0]!.x });
    expect(floorPlan(fair, floor(parkFloorId(fair)), [{ id: "h", name: "Rahasia", status: "hidden" }]).shapes.some((s) => s.kind === "soon")).toBe(false);
  });

  it("draws the library's shelves and desk", () => {
    const plan = floorPlan(fair, floor(libraryFloorId(fair)));
    expect(plan.shapes.filter((s) => s.kind === "shelf").length).toBe(8);
    expect(plan.shapes.some((s) => s.label === "Pustakawan")).toBe(true);
  });
});

describe("companies per floor", () => {
  it("lists every company on a hall, with the booth board's vacancies, stands first", () => {
    const list = companiesOn(fair.booths, 0);
    expect(list.length).toBe(fair.booths.filter((b) => b.floor === 0).length);
    for (const c of list) expect(c.jobs).toEqual(openJobs(c.booth));
  });

  it("keeps companies with nothing open, and puts mini booths after the stands", () => {
    const booths = [booth({ id: "m", company: "Warung", tier: "mini", floor: 0 }), booth({ id: "a", company: "Alpha", floor: 0, x: 3, y: 0.4 }), booth({ id: "z", floor: 1 })];
    const list = companiesOn(booths, 0);
    expect(list.map((c) => c.booth.id)).toEqual(["a", "m"]);
    expect(list[0]!.jobs).toEqual([]);
    expect(list[1]!.stand).toBe(false);
  });

  it("drops closed vacancies and puts the featured one first", () => {
    const b = booth({
      floor: 0,
      featuredJob: "j2",
      jobs: [
        { id: "j1", title: "Kasir", type: "Full-time", location: "Jakarta", requirements: [] },
        { id: "j2", title: "Barista", type: "Part-time", location: "Bandung", requirements: [] },
        { id: "j3", title: "Gudang", type: "Kontrak", location: "Bekasi", requirements: [], closed: true },
      ],
    });
    expect(companiesOn([b], 0)[0]!.jobs.map((j) => j.id)).toEqual(["j2", "j1"]);
  });
});

describe("search and category filter", () => {
  const jobs = [
    { id: "j1", title: "Frontend Developer", type: "Full-time" as const, location: "Jakarta", requirements: [] },
    { id: "j2", title: "Akuntan", type: "Magang" as const, location: "Surabaya", requirements: [] },
  ];
  const list = companiesOn(
    [booth({ id: "a", company: "Nusa Tekno", industry: "Teknologi", floor: 0, jobs }), booth({ id: "b", company: "Kopi Kita", industry: "Kuliner", floor: 0, jobs: [] })],
    0,
  );

  it("keeps everyone without a query", () => {
    expect(filterCompanies(list, "  ").map((c) => c.booth.id)).toEqual(["a", "b"]);
  });

  it("keeps all vacancies when the company matches", () => {
    expect(filterCompanies(list, "nusa")[0]!.jobs.length).toBe(2);
    expect(filterCompanies(list, "kopi").map((c) => c.booth.id)).toEqual(["b"]);
  });

  it("keeps only the matching vacancies otherwise, any case and word order", () => {
    const out = filterCompanies(list, "developer FRONTEND");
    expect(out.map((c) => c.booth.id)).toEqual(["a"]);
    expect(out[0]!.jobs.map((j) => j.id)).toEqual(["j1"]);
    expect(filterCompanies(list, "magang")[0]!.jobs.map((j) => j.id)).toEqual(["j2"]);
    expect(filterCompanies(list, "pilot")).toEqual([]);
  });

  it("filters by category", () => {
    expect(filterCompanies(list, "", "Kuliner").map((c) => c.booth.id)).toEqual(["b"]);
    expect(filterCompanies(list, "akuntan", "Kuliner")).toEqual([]);
  });

  it("lists the categories once each, A to Z", () => {
    const cats = mapCategories(fair.booths);
    expect(cats).toEqual([...new Set(fair.booths.map((b) => b.industry))].sort((a, b) => a.localeCompare(b)));
  });
});

describe("plan scrolling", () => {
  it("centres a point and stays inside the plan", () => {
    expect(planScrollFor({ width: 100 }, 50, 1000, 400)).toBe(300);
    expect(planScrollFor({ width: 100 }, 2, 1000, 400)).toBe(0);
    expect(planScrollFor({ width: 100 }, 99, 1000, 400)).toBe(600);
  });
});
