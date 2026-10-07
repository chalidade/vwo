import { describe, expect, it } from "vitest";
import { COIN_STAND_SPOTS, DEMO_JOB_FAIR, LIFT_FRONT, SPONSOR_H, SPONSOR_W, boothSpot, fairRoomFloorId, findPath, isBlocked, stallSpot } from "@vwo/shared";
import { APPLY_COST, START_COINS, levelOf } from "../src/fair/content";
import { DemoJobFair, type FairSaved, PLAYER_ID } from "../src/jobfair-engine";

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("DemoJobFair", () => {
  it("can walk from the entrance or the lift to every booth, sponsor, seat and stall on all six floors", () => {
    const fair = new DemoJobFair(() => 0.5);
    const halls = fair.floors.slice(0, DEMO_JOB_FAIR.floors.length);
    expect(halls).toHaveLength(3);
    expect(fair.stops.map((s) => s.name)).toEqual(["Lantai 1", "Lantai 2", "Lantai 3", "Lantai 4", "Lantai 5", "Lantai 6"]);
    expect(fair.stops.slice(3).map((s) => s.roomId)).toEqual(["foodcourt", "seminar", "psikotes"]);
    expect(isBlocked(fair.floors[0]!, fair.fair.spawn.x, fair.fair.spawn.y)).toBe(false);
    // Every floor has the lift in the same corner, reachable from where you step out of it.
    for (const f of fair.floors) {
      expect(f.objects!.filter((o) => o.type === "elevator"), f.id).toHaveLength(1);
      expect(f.objects!.some((o) => o.type === "stairs"), f.id).toBe(false);
      expect(isBlocked(f, LIFT_FRONT.x, LIFT_FRONT.y), f.id).toBe(false);
    }
    expect(findPath(halls[0]!, fair.fair.spawn, LIFT_FRONT)).not.toBeNull();
    const starts = halls.map((_, i) => (i === 0 ? fair.fair.spawn : LIFT_FRONT));
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
    // Each room floor: every seat and stall from the lift.
    for (const room of DEMO_JOB_FAIR.rooms) {
      const inside = fair.floor(fairRoomFloorId(DEMO_JOB_FAIR, room.id));
      for (const seat of inside.seats) expect(findPath(inside, LIFT_FRONT, seat), seat.id).not.toBeNull();
      (room.stalls ?? []).forEach((_, i) => expect(findPath(inside, LIFT_FRONT, stallSpot(i, "order")), `${room.id} stall ${i}`).not.toBeNull());
    }
    const c = DEMO_JOB_FAIR.coinStand;
    expect(findPath(halls[c.floor]!, starts[c.floor]!, { x: c.x + COIN_STAND_SPOTS.front.x, y: c.y + COIN_STAND_SPOTS.front.y })).not.toBeNull();
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
    // Bots ride the lift: booths on the top floor get visitors too.
    const top = DEMO_JOB_FAIR.booths.filter((b) => b.floor === 2);
    expect(top.reduce((n, b) => n + (fair.visits.get(b.id) ?? 0), 0)).toBeGreaterThan(0);
  });

  it("charges coins for applying and premium rooms, and hands out vouchers at the food court", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.5, c.now);
    fair.join("Chalid", false, PLAYER_ID);
    expect(fair.player.coins).toBe(START_COINS);
    expect(fair.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: "kk-barista" })).not.toBeNull();
    expect(fair.player.coins).toBe(START_COINS - APPLY_COST);

    expect(fair.hasTicket("psikotes")).toBe(false);
    expect(fair.hasTicket("foodcourt")).toBe(true);
    expect(fair.buyTicket("psikotes")).toBe(true);
    expect(fair.player.coins).toBe(START_COINS - APPLY_COST - 20);

    // Food: pay coins, get a voucher (rand 0.5 picks the half-price psikotes voucher).
    const meal = fair.buyFood("kopi", "es-teh")!;
    expect(meal.voucher.title).toBeTruthy();
    expect(fair.player.vouchers).toHaveLength(1);

    // Run out of coins: applying is refused until topping up.
    for (let i = 0; i < 100 && fair.player.coins >= APPLY_COST; i++) fair.buyFood("kopi", "es-teh");
    const jobs = DEMO_JOB_FAIR.booths.flatMap((b) => b.jobs.map((j) => ({ boothId: b.id, jobId: j.id })));
    let sent = 0;
    for (const j of jobs.slice(1, 40)) if (fair.apply(PLAYER_ID, j)) sent++;
    expect(sent).toBe(fair.player.vouchers.filter((v) => v.kind === "free-apply").length);
    expect(fair.canAffordApply()).toBe(false);
    expect(fair.buyCoins("koin-120", "QRIS")).toBe(120);
    expect(fair.canAffordApply()).toBe(true);
    expect(fair.claimDaily()).toBe(true);
    expect(fair.claimDaily()).toBe(false);
  });

  it("rates applicants and companies, and levels the player up", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.9, c.now);
    fair.join("Chalid", false, PLAYER_ID);
    fair.recordPsych({ score: 12, total: 12, grade: "Sangat baik", sections: {} });
    const a = fair.apply(PLAYER_ID, { boothId: "data-raya", jobId: "dr-da", cvUrl: "https://cv.example", phone: "0812", message: "Saya suka data dan sudah membuat beberapa dashboard." })!;
    expect(a.psych).toBe(100);
    for (let i = 0; i < 30; i++) {
      c.advance(1000);
      fair.tick(16);
    }
    expect(a.rating).toBe(5);
    expect(a.status).toBe("Diundang interview");
    expect(fair.notices.some((n) => n.includes("Data Raya"))).toBe(true);
    expect(fair.player.xp).toBeGreaterThan(50 + 10 + 50 - 1);
    expect(levelOf(fair.player.xp).level).toBeGreaterThan(1);

    const before = fair.companyRating("data-raya");
    fair.reviewCompany(PLAYER_ID, "data-raya", 5);
    fair.reviewCompany(PLAYER_ID, "data-raya", 4);
    const after = fair.companyRating("data-raya");
    expect(after.count).toBe(before.count + 1);
    expect(fair.myReview(PLAYER_ID, "data-raya")!.stars).toBe(4);
  });

  it("lets the player sit in a room, one person per chair", () => {
    const fair = new DemoJobFair(() => 0.5);
    fair.join("Chalid", false, PLAYER_ID);
    const room = fair.floor(fairRoomFloorId(DEMO_JOB_FAIR, "seminar"));
    fair.changeFloor(PLAYER_ID, room.id, room.width / 2, room.height - 2);
    const seat = room.seats.find((s) => !fair.seatTaken(s.id))!;
    expect(fair.sit(PLAYER_ID, seat.id)).toBe(true);
    const other = fair.join("Sari", false, "sari");
    fair.changeFloor(other.memberId, room.id, 1, 1);
    expect(fair.sit(other.memberId, seat.id)).toBe(false);
    fair.stand(PLAYER_ID);
    expect(fair.sit(other.memberId, seat.id)).toBe(true);
  });
});
