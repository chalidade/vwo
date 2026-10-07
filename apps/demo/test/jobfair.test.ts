import { describe, expect, it } from "vitest";
import { DEMO_JOB_FAIR, SPONSOR_H, SPONSOR_W, boothSpot, findPath, isBlocked, portalAt } from "@vwo/shared";
import { DemoJobFair, type FairSaved, PLAYER_ID } from "../src/jobfair-engine";

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("DemoJobFair", () => {
  it("can walk from the entrance to every booth, sponsor and staircase on all three floors", () => {
    const fair = new DemoJobFair(() => 0.5);
    expect(fair.floors).toHaveLength(3);
    expect(isBlocked(fair.floors[0]!, fair.fair.spawn.x, fair.fair.spawn.y)).toBe(false);
    // Where someone stands on each floor: the entrance downstairs, the landing upstairs.
    const starts = fair.floors.map((f, i) => {
      if (i === 0) return fair.fair.spawn;
      const down = f.objects!.find((o) => o.type === "stairs" && o.targetFloorId === fair.floors[i - 1]!.id)!;
      return { x: down.x + down.width / 2, y: down.y + down.height + 0.8 };
    });
    fair.floors.forEach((f, i) => {
      expect(isBlocked(f, starts[i]!.x, starts[i]!.y), f.id).toBe(false);
      const stairs = f.objects!.filter((o) => o.type === "stairs");
      expect(stairs, f.id).toHaveLength(i === 0 || i === 2 ? 1 : 2);
      for (const o of stairs) {
        expect(findPath(f, starts[i]!, { x: o.x + o.width / 2, y: o.y + o.height / 2 }), o.id).not.toBeNull();
        // Landing on the other floor is clear of its stairs, so nobody bounces straight back.
        const there = fair.floor(o.targetFloorId!);
        expect(isBlocked(there, o.targetX!, o.targetY!), o.id).toBe(false);
        expect(portalAt(there, o.targetX!, o.targetY!), o.id).toBeNull();
      }
    });
    for (const level of [0, 1, 2]) expect(DEMO_JOB_FAIR.booths.filter((b) => b.floor === level).length).toBeGreaterThanOrEqual(4);
    for (const b of DEMO_JOB_FAIR.booths) {
      const f = fair.floors[b.floor]!;
      expect(b.jobs.length, b.id).toBeGreaterThan(0);
      for (const spot of ["talk", "banner"] as const) {
        const to = boothSpot(b, spot);
        expect(isBlocked(f, to.x, to.y), `${b.id} ${spot}`).toBe(false);
        expect(findPath(f, starts[b.floor]!, to), `${b.id} ${spot}`).not.toBeNull();
      }
    }
    for (const sp of DEMO_JOB_FAIR.sponsors) {
      const front = { x: sp.x + SPONSOR_W / 2, y: sp.y + SPONSOR_H + 0.75 };
      expect(findPath(fair.floors[sp.floor]!, starts[sp.floor]!, front), sp.id).not.toBeNull();
    }
    const ids = DEMO_JOB_FAIR.booths.flatMap((b) => b.jobs.map((j) => j.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the player's applications and stamps across reloads", () => {
    const c = clock();
    let stored: FairSaved | null = null;
    const storage = { load: () => stored, save: (d: FairSaved) => (stored = JSON.parse(JSON.stringify(d))), clear: () => (stored = null) };
    const first = new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage);
    first.join("Chalid", false, PLAYER_ID);
    first.visit(PLAYER_ID, "kopi-kita");
    first.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: "kk-barista", email: "c@x.id" });
    first.viewSponsor(PLAYER_ID, "telko-nusa");
    first.flush();

    const second = new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage);
    expect(second.applications.map((a) => [a.visitorId, a.jobTitle, a.status])).toEqual([[PLAYER_ID, "Barista Trainee", "Dilihat"]]);
    expect([...(second.visitedBy.get(PLAYER_ID) ?? [])]).toEqual(["kopi-kita"]);
    expect(second.sponsorViews.get("telko-nusa")).toBe(1);
    second.join("Chalid", false, PLAYER_ID);
    expect(second.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: "kk-barista" })).toBeNull();

    second.reset();
    expect(stored).toBeNull();
    expect(new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage).applications).toHaveLength(0);
  });

  it("takes one application per job per visitor and lets the organiser decide", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.5, c.now);
    const v = fair.join("Chalid");
    const a = fair.apply(v.memberId, { boothId: "nusantara-tech", jobId: "nt-fe", email: "c@x.id" });
    expect(a).toMatchObject({ company: "Nusantara Tech", jobTitle: "Frontend Developer", status: "Terkirim" });
    expect(fair.apply(v.memberId, { boothId: "nusantara-tech", jobId: "nt-fe" })).toBeNull();
    expect(fair.apply(v.memberId, { boothId: "nusantara-tech", jobId: "kk-sm" })).toBeNull();
    c.advance(7000);
    fair.tick(16);
    expect(a!.status).toBe("Dilihat");
    fair.setStatus(a!.id, "Diundang interview");
    expect(fair.applications[0]!.status).toBe("Diundang interview");
  });

  it("fills all floors with bots who visit booths, apply, and leave", () => {
    const c = clock();
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const fair = new DemoJobFair(rand, c.now);
    let maxVisitors = 0;
    for (let i = 0; i < 60 * 60 * 6; i++) {
      c.advance(50);
      fair.tick(50);
      maxVisitors = Math.max(maxVisitors, fair.visitors.size);
      for (const v of fair.visitors.values()) expect(isBlocked(fair.floor(v.floorId), v.x, v.y, 0.25)).toBe(false);
    }
    expect(maxVisitors).toBeGreaterThan(3);
    expect([...fair.visits.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(10);
    expect(fair.applications.length).toBeGreaterThan(0);
    expect(fair.events.some((e) => e.type === "leave")).toBe(true);
    // Bots take the stairs: booths on the top floor get visitors too.
    const top = DEMO_JOB_FAIR.booths.filter((b) => b.floor === 2);
    expect(top.reduce((n, b) => n + (fair.visits.get(b.id) ?? 0), 0)).toBeGreaterThan(0);
  });
});
