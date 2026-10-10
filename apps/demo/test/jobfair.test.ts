import { describe, expect, it } from "vitest";
import { BOOTH_W, COIN_STAND_SPOTS, DEMO_JOB_FAIR, boothFrame, LIFT_FRONT, SPONSOR_H, SPONSOR_W, boothSpot, fairRoomFloorId, findPath, isBlocked, stallSpot } from "@vwo/shared";
import { APPLY_COST, DAILY_COINS, GAME_DAILY_CAP, MISSIONS_BONUS, SEMINARS, START_COINS, VERIFY_COST, levelOf, seminarScript, todaysMissions, CAREER_ARTICLES, stepKey } from "../src/fair/content";
import { AULA, makeStall, fairFloorId, infoDeskOn, STALL_SLOTS, stallSlot, LOUNGE, LOUNGE_PLANS, aulaSpot, fairStops, loungeSpot, safeImage } from "@vwo/shared";
import { BOOTH_SLOTS, CONVOS, DEFAULT_RUNDOWN, DemoJobFair, type FairSaved, PLAYER_ID, aulaNow, consultantId, migrateHallX, promoterId, recruiterId } from "../src/jobfair-engine";
import { VIP_PRODUCT, matchScore } from "../src/fair/company";

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("DemoJobFair", () => {
  it("can walk from the entrance or the lift to every booth, sponsor, seat and stall on all eight floors", () => {
    const fair = new DemoJobFair(() => 0.5);
    const halls = fair.floors.slice(0, DEMO_JOB_FAIR.floors.length);
    expect(halls).toHaveLength(3);
    expect(fair.stops.map((s) => s.name)).toEqual(["Lantai 1", "Lantai 2", "Lantai 3", "Lantai 4", "Lantai 5", "Lantai 6", "Lantai 7", "Lantai 8"]);
    // Lantai 1 is the Aula, the booths are on 2 to 4, then the rooms.
    expect(fair.stops.map((s) => s.roomId)).toEqual(["aula", undefined, undefined, undefined, "seminar", "psikotes", "konsultasi", "foodcourt"]);
    expect(isBlocked(fair.floors[0]!, fair.fair.spawn.x, fair.fair.spawn.y)).toBe(false);
    // Visitors come in on the Aula floor and can walk from there to the lift.
    const me = fair.join("Chalid", false, PLAYER_ID);
    expect(me.floorId).toBe(fairRoomFloorId(fair.fair, "aula"));
    expect(findPath(fair.floor(me.floorId), fair.fair.spawn, LIFT_FRONT)).not.toBeNull();
    fair.leave(PLAYER_ID);
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
    // Sofas in each hall's lounge are seats you can walk to.
    for (const f of halls) {
      const sofas = f.seats.filter((st) => st.sofa);
      expect(sofas.length, f.id).toBe(4);
      for (const st of sofas) expect(findPath(f, LIFT_FRONT, st), st.id).not.toBeNull();
    }
    expect(DEMO_JOB_FAIR.booths.filter((b) => b.tier === "premium")).toHaveLength(6);
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
  }, 60_000);

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

    // Food court: buy a voucher for a business's outlet, with a job fair bonus.
    const deal = fair.buyDeal("kopi", "kopi-free")!;
    expect(deal.voucher.kind).toBe("merchant");
    expect(deal.voucher.code).toMatch(/^KOPI-\d{4}[A-Z]$/);
    expect(deal.bonus.title).toBeTruthy();
    expect(fair.player.vouchers).toHaveLength(2);
    expect(fair.ads.get("stall:kopi")).toMatchObject({ sold: 1, coins: 7 });

    // Run out of coins: applying is refused until topping up.
    for (let i = 0; i < 100 && fair.player.coins >= APPLY_COST; i++) fair.buyDeal("nasgor", "nasgor-paket");
    const jobs = DEMO_JOB_FAIR.booths.flatMap((b) => b.jobs.map((j) => ({ boothId: b.id, jobId: j.id })));
    let sent = 0;
    for (const j of jobs.slice(1, 40)) if (fair.apply(PLAYER_ID, j)) sent++;
    expect(sent).toBe(fair.player.vouchers.filter((v) => v.kind === "free-apply").length);
    expect(fair.canAffordApply()).toBe(false);
    expect(fair.buyCoins("koin-120", "QRIS")).toBe(120);
    expect(fair.canAffordApply()).toBe(true);
    expect(fair.claimDaily()).toBe(20);
    expect(fair.claimDaily()).toBe(0);
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

  it("places promoters where people can walk up to them, and counts their reach", () => {
    const fair = new DemoJobFair(() => 0.5);
    expect(fair.fair.promoters.length).toBeGreaterThanOrEqual(4);
    for (const p of fair.fair.promoters) {
      const npc = fair.staff.find((s) => s.id === promoterId(p.id))!;
      const f = fair.floor(npc.floorId);
      expect(p.url).toMatch(/^https:\/\/[a-z0-9-]+\.example(\/|$)/);
      expect(isBlocked(f, p.x, p.y + 1.1), p.id).toBe(false);
      expect(findPath(f, LIFT_FRONT, { x: p.x, y: p.y + 1.1 }), p.id).not.toBeNull();
    }
    fair.join("Chalid", false, PLAYER_ID);
    const p = fair.fair.promoters.find((x) => x.code)!;
    fair.ad(`promo:${p.id}`, "view");
    expect(fair.savePromo(p.id)).toBe(true);
    expect(fair.savePromo(p.id)).toBe(false);
    expect(fair.hasPromo(p.id)).toBe(true);
    expect(fair.ads.get(`promo:${p.id}`)).toMatchObject({ views: 1, clicks: 1 });
    for (const st of fair.fair.rooms.flatMap((r) => r.stalls ?? [])) {
      expect(st.website).toMatch(/\.example$/);
      expect(st.deals.length).toBeGreaterThan(0);
    }
  });

  it("sells the blue check once and shows it on applications", () => {
    const fair = new DemoJobFair(() => 0.5);
    const me = fair.join("Chalid", false, PLAYER_ID);
    expect(me.verified).toBe(false);
    expect(fair.buyVerified()).toBe(false);
    fair.buyCoins("koin-120", "QRIS");
    const before = fair.player.coins;
    expect(fair.buyVerified()).toBe(true);
    expect(fair.player.coins).toBe(before - VERIFY_COST);
    expect(me.verified).toBe(true);
    expect(fair.buyVerified()).toBe(true);
    expect(fair.player.coins).toBe(before - VERIFY_COST);
    expect(fair.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: "kk-barista" })?.verified).toBe(true);
    fair.reset();
    expect(me.verified).toBe(false);
  });

  it("scripts every seminar slide point by point", () => {
    for (const s of SEMINARS) {
      const lines = seminarScript(s);
      s.slides.forEach((sl, i) => expect(lines.filter((l) => l.slide === i && l.reveal > 0).map((l) => l.reveal).slice(0, sl.points.length)).toEqual(sl.points.map((_, k) => k + 1)));
      expect(lines.at(-1)!.text).toContain("Terima kasih");
    }
  });

  it("caps mini game coins per day, tracks missions, and rewards a daily streak", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.5, c.now);
    fair.join("Chalid", false, PLAYER_ID);
    // Mini games pay up to the daily cap, then nothing until tomorrow.
    let paid = 0;
    for (let i = 0; i < 10; i++) paid += fair.rewardGame("Kuis Karier", 10);
    expect(paid).toBe(GAME_DAILY_CAP);
    expect(fair.gameCoinsLeft()).toBe(0);

    // Missions: always a mini game mission, all four claimable once done.
    const ms = fair.missions();
    expect(ms).toHaveLength(4);
    expect(ms[0]!.kind).toBe("game");
    expect(new Set(ms.map((m) => m.id)).size).toBe(4);
    expect(todaysMissions("2026-10-07")).toEqual(todaysMissions("2026-10-07"));
    expect(fair.claimMission(ms[0]!.id)).toBe(true);
    expect(fair.claimMission(ms[0]!.id)).toBe(false);
    for (const m of ms.slice(1)) {
      expect(fair.claimMission(m.id)).toBe(false);
      fair.track(m.kind, m.target);
      expect(fair.claimMission(m.id)).toBe(true);
    }
    const before = fair.player.coins;
    expect(fair.claimMissionBonus()).toBe(true);
    expect(fair.player.coins).toBe(before + MISSIONS_BONUS);
    expect(fair.claimable()).toBe(0);

    // Streak: each consecutive day pays more; missing a day starts over.
    expect(fair.claimDaily()).toBe(DAILY_COINS);
    c.advance(86400000);
    expect(fair.missions().every((m) => !m.claimed)).toBe(true);
    expect(fair.gameCoinsLeft()).toBe(GAME_DAILY_CAP);
    expect(fair.claimDaily()).toBe(DAILY_COINS + 5);
    c.advance(86400000);
    expect(fair.claimDaily()).toBe(DAILY_COINS + 10);
    c.advance(2 * 86400000);
    expect(fair.claimDaily()).toBe(DAILY_COINS);
    expect(fair.player.streak).toBe(1);
  });

  it("reads career articles and ticks off roadmap stages", () => {
    const fair = new DemoJobFair(() => 0.5);
    fair.join("Chalid", false, PLAYER_ID);
    for (const a of CAREER_ARTICLES) {
      expect(a.roadmap.map((st) => st.level)).toEqual(["Pemula", "Menengah", "Mahir", "Ahli"]);
      expect(a.sections.length).toBeGreaterThan(0);
      // Every article points to at least one open job at the fair.
      expect(DEMO_JOB_FAIR.booths.some((b) => b.jobs.some((j) => a.keywords.some((k) => j.title.toLowerCase().includes(k)))), a.id).toBe(true);
    }
    const xp0 = fair.player.xp;
    expect(fair.readArticle("barista")).toBe(true);
    expect(fair.readArticle("barista")).toBe(false);
    expect(fair.player.xp).toBe(xp0 + 8);
    const a = CAREER_ARTICLES[0]!;
    const xp1 = fair.player.xp;
    a.roadmap[0]!.steps.forEach((_, k) => fair.toggleStep(a.id, stepKey(0, k)));
    expect(fair.player.xp).toBe(xp1 + 15);
    // Unticking and ticking again does not pay twice.
    fair.toggleStep(a.id, stepKey(0, 0));
    fair.toggleStep(a.id, stepKey(0, 0));
    expect(fair.player.xp).toBe(xp1 + 15);
  });

  it("lets a company edit its booth, vacancies and FAQ, and keeps the edits", () => {
    const c = clock();
    let stored: FairSaved | null = null;
    const storage = { load: () => stored, save: (d: FairSaved) => (stored = JSON.parse(JSON.stringify(d))), clear: () => (stored = null) };
    const fair = new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage);
    fair.editBooth("kopi-kita", { tagline: "Kopi untuk semua", theme: "wood", recruiter: "Bu Rina", faq: [{ q: "Ada mess?", a: "Ada untuk luar kota." }], x: 99 } as never);
    const b = fair.booth("kopi-kita")!;
    expect([b.tagline, b.theme, b.recruiter, b.faq.length, b.x]).toEqual(["Kopi untuk semua", "wood", "Bu Rina", 1, DEMO_JOB_FAIR.booths.find((x) => x.id === "kopi-kita")!.x]);
    expect(fair.staff.find((s) => s.id === recruiterId("kopi-kita"))!.name).toBe("Bu Rina");
    // The shared event data is untouched.
    expect(DEMO_JOB_FAIR.booths.find((x) => x.id === "kopi-kita")!.tagline).not.toBe("Kopi untuk semua");

    const id = fair.newJobId("kopi-kita");
    fair.saveJob("kopi-kita", { id, title: "Roaster", type: "Kontrak", location: "Bandung", requirements: ["Paham kopi"] });
    fair.join("Chalid", false, PLAYER_ID);
    expect(fair.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: id })).not.toBeNull();
    // A vacancy with applicants is closed instead of deleted, and stops taking applications.
    expect(fair.deleteJob("kopi-kita", id)).toBe("closed");
    const v = fair.join("Sari", true);
    expect(fair.apply(v.memberId, { boothId: "kopi-kita", jobId: id })).toBeNull();
    fair.flush();

    const again = new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage);
    const b2 = again.booth("kopi-kita")!;
    expect([b2.tagline, b2.theme, b2.jobs.find((j) => j.id === id)?.closed]).toEqual(["Kopi untuk semua", "wood", true]);
    again.reset();
    expect(again.booth("kopi-kita")!.tagline).toBe(DEMO_JOB_FAIR.booths.find((x) => x.id === "kopi-kita")!.tagline);
  });

  it("bills VIP and decorations, and switches them on once paid", () => {
    const fair = new DemoJobFair(() => 0.5);
    const id = fair.fair.booths.find((b) => b.tier !== "premium")!.id;
    expect(fair.toggleAccessory(id, "plant")).toBe(true);
    expect(fair.toggleAccessory(id, "tv")).toBe(false);
    const inv = fair.createInvoice(id, ["vip", "tv", "plant", "nope"])!;
    expect(inv.items.map((i) => i.id)).toEqual(["vip", "tv"]);
    expect(inv.total).toBe(VIP_PRODUCT.price + 300_000);
    expect(fair.payInvoice(id, inv.id, "QRIS")).toBe(true);
    expect(fair.payInvoice(id, inv.id, "QRIS")).toBe(false);
    const b = fair.booth(id)!;
    expect(b.tier).toBe("premium");
    expect(b.accessories).toEqual(["plant", "tv"]);
    expect(fair.createInvoice(id, ["vip", "tv"])).toBeNull();
    // Only four floor items fit.
    for (const a of ["flag", "standee", "giveaway"]) fair.toggleAccessory(id, a);
    expect(fair.toggleAccessory(id, "beanbag")).toBe(false);
  });

  it("lets a company review, chat with and invite an applicant", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.5, c.now);
    fair.join("Chalid", false, PLAYER_ID);
    const job = fair.booth("kopi-kita")!.jobs[0]!;
    const a = fair.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: job.id, cvUrl: "https://cv.example/c", phone: "0812", skills: job.requirements.join(", ") })!;
    expect(matchScore(a, job)).toBeGreaterThan(matchScore({ ...a, skills: "", cvUrl: "", phone: "" }, job));
    fair.notices.length = 0;
    fair.setStatus(a.id, "Shortlist");
    fair.scheduleInterview(a.id, { at: c.now() + 86400000, mode: "Video call" });
    expect(a.status).toBe("Diundang interview");
    expect(a.messages?.[0]?.text).toContain("Video call");
    expect(fair.notices.some((n) => n.includes("Shortlist"))).toBe(true);
    fair.replyToCompany(a.id, "Siap!");
    expect(a.messages?.map((m) => m.from)).toEqual(["company", "seeker"]);
    fair.logCall(a.id, { at: c.now(), kind: "voice", answered: false, seconds: 0 });
    expect(fair.notices.at(-1)).toContain("tak terjawab");
  });

  it("takes newer application changes and company edits from another tab", () => {
    const c = clock();
    const tabA = new DemoJobFair(() => 0.5, c.now);
    const tabB = new DemoJobFair(() => 0.5, c.now);
    tabA.join("Chalid", false, PLAYER_ID);
    const a = tabA.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: tabA.booth("kopi-kita")!.jobs[0]!.id })!;
    let saved: FairSaved | null = null;
    const grab = (f: DemoJobFair) => {
      (f as unknown as { storage: unknown }).storage = { load: () => saved, save: (d: FairSaved) => (saved = JSON.parse(JSON.stringify(d))), clear() {} };
      (f as unknown as { dirty: boolean }).dirty = true;
      f.flush();
      return saved;
    };
    tabB.mergeSaved(grab(tabA));
    expect(tabB.applications.map((x) => x.id)).toEqual([a.id]);
    c.advance(1000);
    tabB.editBooth("kopi-kita", { theme: "neon" });
    tabB.setStatus(a.id, "Diterima");
    tabA.mergeSaved(grab(tabB));
    expect(tabA.applications[0]!.status).toBe("Diterima");
    expect(tabA.booth("kopi-kita")!.theme).toBe("neon");
    // The applicant's tab hears about a status change, a chat message and an interview set in the portal.
    expect(tabA.notices.some((n) => n.includes("Diterima"))).toBe(true);
    c.advance(1000);
    tabB.scheduleInterview(a.id, { at: c.now() + 86_400_000, mode: "Video call", place: "https://meet.example/abc" });
    tabA.notices.length = 0;
    tabA.mergeSaved(grab(tabB));
    expect(tabA.interviewAlerts).toEqual([a.id]);
    expect(tabA.applications[0]!.interview?.place).toBe("https://meet.example/abc");
    expect(tabA.notices.some((n) => n.startsWith("💬"))).toBe(true);
  });
  it("lets the organiser take a booth out, put a new company in its place, and bring the old one back", () => {
    const fair = new DemoJobFair(() => 0.5);
    expect(fair.freeSlots()).toHaveLength(fair.fair.floors.length * BOOTH_SLOTS.length - fair.fair.booths.length);
    fair.join("Chalid", false, PLAYER_ID);
    const old = fair.fair.booths.find((b) => b.floor === 1)!;
    fair.apply(PLAYER_ID, { boothId: old.id, jobId: old.jobs[0]!.id });
    expect(fair.addBooth({ company: "Tak Ada Tempat", industry: "", color: "#000", floor: old.floor, x: old.x, y: old.y })).toBeNull();
    fair.removeBooth(old.id);
    expect(fair.booth(old.id)).toBeUndefined();
    expect(fair.applications.some((a) => a.boothId === old.id)).toBe(false);
    expect(fair.staff.some((s) => s.id === recruiterId(old.id))).toBe(false);
    const nb = fair.addBooth({ company: "Studio Contoh", industry: "Desain", color: "#9333ea", floor: old.floor, x: old.x, y: old.y })!;
    expect(nb.id).toBe("studio-contoh");
    expect(fair.staff.some((s) => s.id === recruiterId(nb.id))).toBe(true);
    // The new booth is reachable from the lift.
    const f = fair.floors[nb.floor]!;
    expect(findPath(f, LIFT_FRONT, boothSpot(nb, "talk"))).not.toBeNull();
    expect(fair.restoreBooth(old.id)).toBe(false); // its place is taken
    fair.removeBooth(nb.id);
    expect(fair.restoreBooth(old.id)).toBe(true);
    expect(fair.booth(old.id)?.company).toBe(old.company);
  });

  it("keeps the organiser's booths, ads, psikotes and seminars across reloads", () => {
    let saved: FairSaved | null = null;
    const storage = { load: () => saved, save: (d: FairSaved) => (saved = JSON.parse(JSON.stringify(d))), clear() {} };
    const a = new DemoJobFair(() => 0.5, undefined, undefined, storage);
    const slot = a.freeSlots()[0] ?? (a.removeBooth(a.fair.booths[0]!.id), a.freeSlots()[0]!);
    a.addBooth({ company: "Kopi Baru", industry: "F&B", color: "#f97316", ...slot });
    const p = a.allPromoters().find((x) => x.walks)!;
    a.savePromoter({ ...p, active: false });
    a.announce("Walk-in interview jam 13.00");
    expect(a.notices.at(-1)).toContain("Walk-in");
    expect(a.savePsych({ questions: [{ id: "x", section: "Logika", q: "1+1?", options: ["2", "3"], answer: 0 }], minutes: 3, pass: 0.5 })).toBe(true);
    expect(a.savePsych({ questions: [{ id: "y", section: "Logika", q: "", options: ["2"], answer: 0 }], minutes: 3, pass: 0.5 })).toBe(false);
    a.saveSeminar({ id: "new", title: "Sesi baru", speaker: "Bu Rina", role: "HR", slides: [{ title: "Halo", points: ["Satu"], say: "Hai" }] });
    a.flush();
    const b = new DemoJobFair(() => 0.5, undefined, undefined, storage);
    expect(b.booth("kopi-baru")?.company).toBe("Kopi Baru");
    expect(b.fair.promoters.some((x) => x.id === p.id)).toBe(false);
    expect(b.allPromoters().find((x) => x.id === p.id)?.active).toBe(false);
    expect(b.org.announcement?.text).toContain("13.00");
    expect(b.psychConfig().questions).toHaveLength(1);
    expect(b.seminars().at(-1)?.title).toBe("Sesi baru");
  });

  it("lets visitors use a booth's paid decorations, and counts it for the company", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.5, c.now);
    fair.join("Chalid", false, PLAYER_ID);
    const id = fair.fair.booths.find((b) => !(b.accessories ?? []).includes("giveaway"))!.id;
    expect(fair.useAccessory(id, "giveaway", "claim").ok).toBe(false);
    fair.editBooth(id, { accessories: ["giveaway", "balloons"], media: { merch: { name: "Tumbler", stock: 1 } } });
    const vouchers = fair.player.vouchers.length;
    const got = fair.useAccessory(id, "giveaway", "claim");
    expect(got.ok && got.voucher?.title).toContain("Tumbler");
    expect(fair.player.vouchers).toHaveLength(vouchers + 1);
    expect(fair.useAccessory(id, "giveaway", "claim").ok).toBe(false);
    const coins = fair.player.coins;
    const pop = fair.useAccessory(id, "balloons", "claim");
    expect(pop.ok && pop.coins).toBeGreaterThan(0);
    expect(fair.player.coins).toBeGreaterThan(coins);
    expect(fair.useAccessory(id, "balloons", "claim").ok).toBe(false);
    c.advance(86_400_000);
    expect(fair.useAccessory(id, "balloons", "claim").ok).toBe(true);
    fair.useAccessory(id, "balloons", "view");
    expect(fair.ads.get(`acc:${id}:giveaway`)?.sold).toBe(1);
    expect(fair.ads.get(`acc:${id}:balloons`)?.views).toBe(1);
  });

  it("sends walking promoters up to the player to pitch their offer", () => {
    const c = clock();
    const fair = new DemoJobFair(() => 0.3, c.now);
    const p = fair.fair.promoters.find((x) => x.walks && x.level === 1)!;
    fair.join("Chalid", false, PLAYER_ID);
    fair.ride(PLAYER_ID, fairFloorId(fair.fair, 0));
    const me = fair.visitors.get(PLAYER_ID)!;
    const npc = fair.staff.find((s) => s.id === promoterId(p.id))!;
    const start = { x: npc.x, y: npc.y };
    for (let i = 0; i < 600 && !fair.ads.get(`promo:${p.id}`)?.views; i++) {
      c.advance(100);
      fair.tick(100);
    }
    expect(fair.ads.get(`promo:${p.id}`)?.views).toBeGreaterThan(0);
    expect(Math.hypot(npc.x - start.x, npc.y - start.y)).toBeGreaterThan(1);
    expect(Math.hypot(npc.x - me.x, npc.y - me.y)).toBeLessThan(2.4);
    expect(fair.bubbles.get(npc.id)?.text).toContain(p.headline);
  });
  it("gives a company that buys a promoter its own walker, which points to its vacancies", () => {
    const fair = new DemoJobFair(() => 0.5);
    const b = fair.fair.booths.find((x) => x.floor === 2)!;
    const before = fair.fair.promoters.length;
    const inv = fair.createInvoice(b.id, ["promoter"])!;
    expect(inv.total).toBe(1_000_000);
    expect(fair.fair.promoters).toHaveLength(before);
    fair.payInvoice(b.id, inv.id, "QRIS");
    const p = fair.fair.promoters.find((x) => x.boothId === b.id)!;
    expect(p.walks).toBe(true);
    expect(p.level).toBe(b.floor + 1);
    expect(fair.staff.some((s) => s.id === promoterId(p.id))).toBe(true);
    expect(b.accessories ?? []).not.toContain("promoter");
    fair.editBooth(b.id, { promoter: { headline: "Walk-in interview jam 13.00" } });
    expect(fair.fair.promoters.find((x) => x.boothId === b.id)!.headline).toBe("Walk-in interview jam 13.00");
  });

  it("lets a company book an empty stand from the map and sign in with the PIN it gets", () => {
    const fair = new DemoJobFair(() => 0.5);
    const gone = fair.fair.booths.find((x) => x.floor === 0)!;
    fair.removeBooth(gone.id);
    const slot = fair.freeSlots().find((sl) => sl.floor === 0 && sl.x === gone.x && sl.y === gone.y)!;
    expect(slot).toBeTruthy();
    const r = fair.bookStand({ company: "Kopi Nusa", industry: "F&B", color: "#16a34a", contact: "Dewi", email: "hr@kopinusa.example", tier: "premium", method: "QRIS", ...slot })!;
    expect(r.booth.tier).toBe("premium");
    expect(fair.booth(r.booth.id)?.email).toBe("hr@kopinusa.example");
    expect(fair.bookings()[0]!.price).toBe(15_000_000);
    expect(fair.freeSlots().some((sl) => sl.floor === 0 && sl.x === slot.x && sl.y === slot.y)).toBe(false);
    expect(fair.bookStand({ company: "Telat", industry: "", color: "#000", contact: "A", email: "a@b.example", tier: "regular", method: "QRIS", ...slot })).toBeNull();
    expect(fair.companyLogin(r.booth.id, r.pin)?.id).toBe(r.booth.id);
    expect(fair.companyLogin(r.booth.id, "0000")).toBeUndefined();
    const other = fair.fair.booths.find((x) => x.id !== r.booth.id)!;
    expect(fair.companyLogin(other.id.toUpperCase(), fair.companyPin(other.id))?.id).toBe(other.id);
    expect(fair.setCompanyPin(other.id, "12ab")).toBe(false);
    expect(fair.setCompanyPin(other.id, "246810")).toBe(true);
    expect(fair.companyLogin(other.id, "246810")?.id).toBe(other.id);
  });

  it("shows stands booked on the live server, and keeps one the organiser took out gone", () => {
    const fair = new DemoJobFair(() => 0.5);
    const gone = fair.fair.booths.find((x) => x.floor === 0)!;
    const org = { removed: [gone.id], added: [] };
    const booth = { ...structuredClone(gone), id: "kopi-nusa", company: "Kopi Nusa" };
    const booking = { id: "book-1", boothId: "kopi-nusa", company: "Kopi Nusa", contact: "Dewi", email: "hr@kopinusa.example", tier: "regular" as const, price: 7_500_000, method: "QRIS", at: 1 };
    // A visitor gets only the booth.
    fair.applyShared(org, {}, [{ booth }]);
    expect(fair.booth("kopi-nusa")?.company).toBe("Kopi Nusa");
    expect(fair.hasCompanyPin("kopi-nusa")).toBe(false);
    expect(fair.bookings()).toEqual([]);
    // The organiser also gets the booking and its PIN, once however often it pulls.
    fair.applyShared(org, {}, [{ booth, booking, pin: "4821" }]);
    fair.applyShared(org, {}, [{ booth, booking, pin: "4821" }]);
    expect(fair.companyPin("kopi-nusa")).toBe("4821");
    expect(fair.bookings()).toHaveLength(1);
    expect(fair.fair.booths.filter((b) => b.id === "kopi-nusa")).toHaveLength(1);
    // Taking it out marks it removed, so the booking still on the server doesn't bring it back.
    fair.removeBooth("kopi-nusa");
    expect(fair.org.removed).toContain("kopi-nusa");
    fair.applyShared(fair.org, {}, [{ booth, booking, pin: "4821" }]);
    expect(fair.booth("kopi-nusa")).toBeUndefined();
  });

  it("lets the organiser cap how many of its walking promoters are out", () => {
    const fair = new DemoJobFair(() => 0.5);
    const walking = () => fair.fair.promoters.filter((p) => p.walks && !p.boothId).length;
    const all = walking();
    expect(fair.walkerLimit()).toBe(all);
    fair.setWalkerLimit(2);
    expect(walking()).toBe(2);
    expect(fair.fair.promoters.some((p) => !p.walks)).toBe(true);
    fair.setWalkerLimit(0);
    expect(walking()).toBe(0);
    fair.setWalkerLimit(99);
    expect(walking()).toBe(all);
    expect(fair.walkerLimit()).toBe(all);
  });
  it("makes VIP stands wider with a gate and a video wall, and every booth stays reachable", () => {
    const c = clock();
    let stored: FairSaved | null = null;
    const storage = { load: () => stored, save: (d: FairSaved) => (stored = JSON.parse(JSON.stringify(d))), clear: () => (stored = null) };
    const fair = new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage);
    // Turn every booth into a VIP stand: the wider frames still fit side by side and leave the aisles open.
    for (const b of fair.fair.booths) fair.configureBooth(b.id, { tier: "premium" });
    for (const b of fair.fair.booths) {
      const f = fair.floors[b.floor]!;
      const frame = boothFrame(b);
      expect(frame.width, b.id).toBeGreaterThan(BOOTH_W);
      // The banner wings block their tiles, and the gate posts stand at the entrance.
      expect(isBlocked(f, frame.x + 0.5, b.y + 0.5), b.id).toBe(true);
      expect(isBlocked(f, frame.x + 0.25, b.y + 3.35), `${b.id} gate`).toBe(true);
      const start = b.floor === 0 ? fair.fair.spawn : LIFT_FRONT;
      for (const spot of ["talk", "banner"] as const) expect(findPath(f, start, boothSpot(b, spot)), `${b.id} ${spot}`).not.toBeNull();
      expect(fair.useAccessory(b.id, "tv").ok, b.id).toBe(true);
    }

    // A regular booth gets the gate as an add-on, with the organiser's video and gate settings.
    const id = fair.fair.booths[0]!.id;
    fair.configureBooth(id, { tier: "regular", theme: "wood", accessories: ["gapura", "tv", "plant"], media: { videoUrl: "https://video.example/a.mp4", gate: "balon", gateText: "Ayo masuk" } });
    const b = fair.booth(id)!;
    expect(boothFrame(b).width).toBe(BOOTH_W);
    expect(isBlocked(fair.floors[b.floor]!, b.x + 0.25, b.y + 3.35)).toBe(true);
    expect([fair.owns(id, "gapura"), fair.owns(id, "tv"), fair.owns(id, "vip")]).toEqual([true, true, false]);
    fair.flush();
    const again = new DemoJobFair(() => 0.5, c.now, DEMO_JOB_FAIR, storage);
    const b2 = again.booth(id)!;
    expect(again.hallBanner(0).title).toBe(DEMO_JOB_FAIR.name);
    again.setHallBanner("Bursa Kerja Kota", ["Lantai 1 · Teknologi"]);
    expect(again.hallBanner(0)).toEqual({ title: "Bursa Kerja Kota", subtitle: "Lantai 1 · Teknologi" });
    expect(again.hallBanner(1).subtitle).toBe(again.floors[1]!.name);
    expect([b2.tier, b2.theme, [...b2.accessories!].sort(), b2.media?.gate, b2.media?.gateText, b2.media?.videoUrl]).toEqual(["regular", "wood", ["gapura", "plant", "tv"], "balon", "Ayo masuk", "https://video.example/a.mp4"]);
    expect(isBlocked(again.floors[b2.floor]!, b2.x + 0.25, b2.y + 3.35)).toBe(true);
  });

  it("notifies HR and the applicant of each other, across tabs, and keeps what was read", () => {
    const c = clock();
    const seeker = new DemoJobFair(() => 0.5, c.now);
    const hr = new DemoJobFair(() => 0.5, c.now);
    let saved: FairSaved | null = null;
    const grab = (f: DemoJobFair) => {
      (f as unknown as { storage: unknown }).storage = { load: () => saved, save: (d: FairSaved) => (saved = JSON.parse(JSON.stringify(d))), clear() {} };
      (f as unknown as { dirty: boolean }).dirty = true;
      f.flush();
      return saved;
    };
    seeker.join("Chalid", false, PLAYER_ID);
    const a = seeker.apply(PLAYER_ID, { boothId: "kopi-kita", jobId: "kk-barista" })!;
    hr.mergeSaved(grab(seeker));
    // HR hears about the new application.
    expect(hr.notifsFor("kopi-kita").map((n) => [n.kind, n.appId])).toEqual([["apply", a.id]]);
    expect(hr.unreadFor("kopi-kita")).toBe(1);

    // HR chats, invites, and calls without an answer: the applicant gets one notification for each.
    c.advance(1000);
    hr.messageApplicant(a.id, "Halo, bisa interview minggu ini?");
    hr.scheduleInterview(a.id, { at: c.now() + 86_400_000, mode: "Video call" });
    hr.logCall(a.id, { at: c.now(), kind: "video", answered: false, seconds: 0 });
    seeker.mergeSaved(grab(hr));
    expect(seeker.notifsFor(PLAYER_ID).map((n) => n.kind)).toEqual(["call", "interview", "chat"]);
    expect(seeker.unreadFor(PLAYER_ID)).toBe(3);

    // The applicant confirms and replies; HR is told, and its own notifications are not duplicated.
    c.advance(1000);
    seeker.markRead(PLAYER_ID);
    seeker.answerInterview(a.id, "hadir");
    seeker.replyToCompany(a.id, "Siap, terima kasih!");
    hr.mergeSaved(grab(seeker));
    const kinds = hr.notifsFor("kopi-kita").map((n) => n.kind);
    expect(kinds.slice(0, 2)).toEqual(["chat", "confirm"]);
    expect(kinds.filter((k) => k === "apply")).toHaveLength(1);
    expect(hr.applications[0]!.interview?.reply).toBe("hadir");
    // Read marks travel too.
    expect(hr.unreadFor(PLAYER_ID)).toBe(0);
    hr.markRead("kopi-kita");
    seeker.mergeSaved(grab(hr));
    expect(seeker.unreadFor("kopi-kita")).toBe(0);
  });

  it("has an Aula floor with a stage, a rundown by the clock, and boards you can walk to", () => {
    const fair = new DemoJobFair(() => 0.5);
    const aula = fair.fair.rooms.find((r) => r.kind === "aula")!;
    expect(fairStops(fair.fair).find((s) => s.roomId === "aula")?.name).toBe("Lantai 1");
    const f = fair.floor(fairRoomFloorId(fair.fair, aula.id));
    expect(isBlocked(f, AULA.stage.x + 5, AULA.stage.y + 1)).toBe(true);
    for (const board of ["rundown", "info"] as const) expect(findPath(f, LIFT_FRONT, aulaSpot(board)), board).not.toBeNull();
    expect(f.seats.length).toBe(AULA.rows * AULA.blocks.length * AULA.perRow);
    expect(f.seats.every((s) => s.facing === "back")).toBe(true);

    const at = (h: number, m: number) => new Date(2026, 9, 8, h, m);
    expect(aulaNow(DEFAULT_RUNDOWN, at(9, 5)).current?.id).toBe("buka");
    expect(aulaNow(DEFAULT_RUNDOWN, at(7, 0))).toMatchObject({ current: null, next: { id: "reg" }, over: false });
    expect(aulaNow(DEFAULT_RUNDOWN, at(20, 0))).toMatchObject({ current: null, next: null, over: true });

    // The organiser writes its own rundown: bad rows are dropped, times are sorted.
    expect(fair.saveRundown([
      { id: "b", start: "10:00", end: "10.30", title: "Talkshow", host: "HR", kind: "talkshow" },
      { id: "a", start: "09.00", end: "09.15", title: " Sambutan Walikota ", host: "Walikota", kind: "sambutan" },
      { id: "x", start: "9", end: "", title: "Rusak", host: "", kind: "info" },
    ])).toBe(2);
    expect(fair.rundown().map((e) => [e.start, e.title])).toEqual([["09.00", "Sambutan Walikota"], ["10.00", "Talkshow"]]);
    fair.resetRundown();
    expect(fair.rundown()).toBe(DEFAULT_RUNDOWN);
  });

  it("moves booths, sponsors and promoters saved for the old 38-tile halls into the wider halls", () => {
    expect([1, 16, 31].map(migrateHallX)).toEqual([3, 20, 37]);
    let stored: FairSaved | null = {
      version: 2,
      applications: [],
      visits: {},
      sponsorViews: {},
      visitedBy: {},
      org: {
        removed: ["nusantara-tech"],
        added: [{ ...structuredClone(DEMO_JOB_FAIR.booths[0]!), id: "baru", company: "Baru", x: 1, y: 0.4 }],
        sponsors: structuredClone(DEMO_JOB_FAIR.sponsors).map((sp) => ({ ...sp, x: sp.x === 14.05 ? 11.05 : 26.05 })),
        promoters: [{ ...structuredClone(DEMO_JOB_FAIR.promoters[0]!), level: 3, x: 34.5 }],
      },
    };
    const storage = { load: () => stored, save: (d: FairSaved) => (stored = d), clear: () => (stored = null) };
    const fair = new DemoJobFair(() => 0.5, () => 0, DEMO_JOB_FAIR, storage);
    expect(fair.booth("baru")).toMatchObject({ x: 3, y: 0.4 });
    expect(fair.fair.sponsors.map((sp) => sp.x)).toEqual(DEMO_JOB_FAIR.sponsors.map((sp) => sp.x));
    // Level 3 was the Aula's old floor in the oldest saves, which became the food court, now on Lantai 8.
    expect(fair.fair.promoters[0]).toMatchObject({ level: 7, x: 38.5 });
    expect(fair.org.layout).toBe(3);
  });

  it("live: shows food court stands rented through the server, and the organiser can take one out", () => {
    const fair = new DemoJobFair(() => 0.5);
    const stall = makeStall("rent-abc", 13, { name: "Kopi Sewa", deal: { title: "Voucher kopi", worth: "Rp15.000", price: 6 } })!;
    fair.applyShared(null, {}, [], [{ roomId: "foodcourt", stall }]);
    expect(fair.foodCourt()!.stalls!.map((st) => st.id)).toContain("rent-abc");
    expect(fair.freeStallSlots()).toEqual([12, 14]);
    // A second rental claiming a taken slot is not drawn on top of it.
    fair.applyShared(null, {}, [], [{ roomId: "foodcourt", stall }, { roomId: "foodcourt", stall: { ...stall, id: "rent-def" } }]);
    expect(fair.foodCourt()!.stalls!.filter((st) => st.slot === 13)).toHaveLength(1);
    // Taken out by the organiser: it stays out when the server sends it again.
    expect(fair.removeStall("rent-abc")).toBe(true);
    expect(fair.org.removedStalls).toEqual(["rent-abc"]);
    fair.applyShared(fair.org, {}, [], [{ roomId: "foodcourt", stall }]);
    expect(fair.foodCourt()!.stalls!.some((st) => st.id === "rent-abc")).toBe(false);
  });

  it("has 15 food court stands along three walls, which the organiser can empty and anyone can rent", () => {
    const fair = new DemoJobFair(() => 0.5);
    const room = fair.foodCourt()!;
    expect(STALL_SLOTS).toHaveLength(15);
    expect(room.stalls).toHaveLength(12);
    expect(fair.freeStallSlots()).toEqual([12, 13, 14]);
    // Fill every free slot, then check each stand's counter can be reached from the lift.
    for (const slot of fair.freeStallSlots()) expect(fair.addStall(slot, { name: `Warung ${slot}`, deal: { title: "Voucher", worth: "Rp10.000", price: 5 } })).not.toBeNull();
    expect(fair.freeStallSlots()).toEqual([]);
    expect(fair.addStall(3, { name: "Tidak muat" })).toBeNull();
    const f = fair.floor(fairRoomFloorId(fair.fair, room.id));
    room.stalls!.forEach((st, i) => {
      const at = stallSpot(stallSlot(st, i), "order");
      expect(isBlocked(f, at.x, at.y), st.id).toBe(false);
      expect(findPath(f, LIFT_FRONT, at), st.id).not.toBeNull();
    });
    // Taking one out leaves the others where they stand.
    const second = room.stalls![1]!;
    expect(fair.removeStall(room.stalls![0]!.id)).toBe(true);
    expect(fair.freeStallSlots()).toEqual([0]);
    expect(stallSlot(room.stalls!.find((x) => x.id === second.id)!, 0)).toBe(1);
    fair.resetStalls();
    expect(room.stalls).toHaveLength(12);
  });

  it("lets job seekers near each other talk, one line each in turn", () => {
    const c = clock();
    const fair = new DemoJobFair(Math.random, c.now);
    const all = new Set(Object.values(CONVOS).flat(2));
    const heard = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      c.advance(100);
      fair.tick(100);
      for (const b of fair.bubbles.values()) if (all.has(b.text)) heard.add(b.text);
    }
    expect(heard.size).toBeGreaterThan(3);
  });

  it("has a consultation lounge with big sofas and consultants, and charges for each call", () => {
    const fair = new DemoJobFair(() => 0.5);
    const room = fair.fair.rooms.find((r) => r.kind === "konsultasi")!;
    expect(fairStops(fair.fair).find((s) => s.roomId === "konsultasi")?.name).toBe("Lantai 7");
    const floor = fair.floor(fairRoomFloorId(DEMO_JOB_FAIR, room.id));
    // Six groups of two long sofas, three seats each.
    expect(floor.seats.filter((s) => s.sofa)).toHaveLength(LOUNGE.groups.length * LOUNGE.rows.length * 2 * 3);
    room.consultants!.forEach((c, i) => {
      const st = fair.staff.find((x) => x.id === consultantId(c.id))!;
      expect(st).toMatchObject({ floorId: floor.id, ...loungeSpot(i, "consultant") });
      const front = loungeSpot(i, "front");
      expect(isBlocked(floor, front.x, front.y)).toBe(false);
      expect(findPath(floor, LIFT_FRONT, front)).not.toBeNull();
    });
    const plan = LOUNGE_PLANS[0];
    const before = fair.player.coins;
    expect(fair.startLoungeCall("consult", plan.minutes, "Pak Hendra")).toBe(true);
    expect(fair.player.coins).toBe(before - plan.consultCoins);
    expect(fair.startLoungeCall("peer", plan.minutes, "Rina")).toBe(true);
    expect(fair.player.coins).toBe(before - plan.consultCoins - plan.coins);
    expect(fair.player.txns[0]?.reason).toBe("Telepon 10 menit dengan Rina");
    expect(fair.startLoungeCall("peer", 99, "Rina")).toBe(false);
    fair.player.coins = 3;
    expect(fair.startLoungeCall("consult", 15, "Bu Rina")).toBe(false);
    expect(fair.player.coins).toBe(3);
  });

  it("keeps only inline PNG, JPEG or WebP pictures as logos and photos", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(safeImage(png)).toBe(png);
    expect(safeImage("data:image/svg+xml;base64,PHN2Zz4=")).toBeUndefined();
    expect(safeImage("https://evil.example/logo.png")).toBeUndefined();
    expect(safeImage('data:image/png;base64,AAAA" onerror="alert(1)')).toBeUndefined();
    const fair = new DemoJobFair(() => 0.5);
    const id = fair.fair.booths[0]!.id;
    fair.editBooth(id, { logoImg: "javascript:alert(1)", vipStyle: "cyber", vipHeadline: ["JOIN", "US"] });
    expect(fair.booth(id)).toMatchObject({ logoImg: undefined, vipStyle: "cyber", vipHeadline: ["JOIN", "US"] });
    fair.editBooth(id, { logoImg: png });
    expect(fair.booth(id)?.logoImg).toBe(png);
  });

  it("has an info desk with someone behind it on every floor, reachable from the lift", () => {
    const fair = new DemoJobFair(() => 0.5);
    for (const st of fair.stops) {
      const d = infoDeskOn(fair.fair, st.floorId);
      const floor = fair.floor(st.floorId);
      expect(isBlocked(floor, d.x + d.width / 2, d.y + d.height / 2), st.floorId).toBe(true);
      expect(findPath(floor, LIFT_FRONT, { x: d.x + d.width / 2, y: d.y + d.height + 0.6 }), st.floorId).not.toBeNull();
      expect(fair.staff.some((x) => x.floorId === st.floorId && x.name === d.staff), st.floorId).toBe(true);
    }
  });

  it("lets the organiser add and remove booth floors, switch rooms off, and charge for a floor", () => {
    const store: { data: FairSaved | null } = { data: null };
    const storage = { load: () => store.data, save: (d: FairSaved) => (store.data = structuredClone(d)), clear: () => (store.data = null) };
    const fair = new DemoJobFair(() => 0.5, () => 1_000_000, DEMO_JOB_FAIR, storage);
    fair.join("Chalid", false, PLAYER_ID);
    const promo = fair.fair.promoters.find((p) => !p.walks && p.level === 7)!;
    expect(fair.addHall("Startup & UMKM")).toBe(true);
    expect(fair.stops.map((s) => s.label)).toEqual(["Aula Utama", "Teknologi & Keuangan", "Kreatif, Kuliner & Ritel", "Industri, Energi & Kesehatan", "Startup & UMKM", "Ruang Seminar", "Ruang Psikotes", "Lounge Konsultasi", "Food Court"]);
    expect(fair.stops[4]).toMatchObject({ name: "Lantai 5", floorId: fairFloorId(fair.fair, 3) });
    // Rooms above moved up a floor, with their promoters.
    expect(fair.room("foodcourt")?.level).toBe(8);
    if (promo) expect(fair.fair.promoters.find((p) => p.id === promo.id)?.level).toBe(8);
    expect(fair.freeSlots().filter((sl) => sl.floor === 3)).toHaveLength(6);
    // A booth floor with stands cannot go; the new empty one can.
    expect(fair.removeHall()).toBe(true);
    expect(fair.fair.floors).toHaveLength(3);
    expect(fair.removeHallBlocker()).toMatch(/stand/);
    expect(fair.removeHall()).toBe(false);
    // Switch the psikotes floor off: the floors above close the gap.
    fair.setRoomHidden("psikotes", true);
    expect(fair.stops.map((s) => s.roomId ?? "hall")).toEqual(["aula", "hall", "hall", "hall", "seminar", "konsultasi", "foodcourt"]);
    expect(fair.room("foodcourt")?.level).toBe(6);
    // A booth floor can cost coins; the entrance stays free.
    const hall3 = fairFloorId(fair.fair, 2);
    fair.setFloorPrice(hall3, 15);
    fair.setFloorPrice(fair.stops[0]!.floorId, 50);
    expect(fair.floorPrice(fair.stops[0]!.floorId)).toBe(0);
    expect(fair.passFor(hall3)).toMatchObject({ id: hall3, price: 15 });
    expect(fair.hasTicket(hall3)).toBe(false);
    const coins = fair.player.coins;
    expect(fair.buyTicket(hall3)).toBe(true);
    expect(fair.player.coins).toBe(coins - 15);
    expect(fair.hasTicket(hall3)).toBe(true);
    fair.setFloorPrice(fairRoomFloorId(fair.fair, "seminar"), 0);
    expect(fair.passFor(fairRoomFloorId(fair.fair, "seminar"))).toBeNull();
    // All of it survives a reload.
    fair.flush();
    const again = new DemoJobFair(() => 0.5, () => 1_000_000, DEMO_JOB_FAIR, storage);
    expect(again.stops.map((s) => s.roomId ?? "hall")).toEqual(["aula", "hall", "hall", "hall", "seminar", "konsultasi", "foodcourt"]);
    expect(again.floorPrice(hall3)).toBe(15);
    again.setRoomHidden("psikotes", false);
    expect(again.room("psikotes")?.level).toBe(5);
  });
});

describe("organiser price list", () => {
  it("prices calls, applications, coin packs and company products from the table", async () => {
    const { setPriceTable, cleanPrices, price } = await import("@vwo/shared");
    const { VIP_PRODUCT, ACCESSORY_PRODUCTS } = await import("../src/fair/company");
    const { STAND_PRICES, loungePlans } = await import("../src/jobfair-engine");
    expect(cleanPrices({ "coin.apply": 7.4, "nope": 3, "stand.regular": -5, "pack.koin-50": "x" })).toEqual({ "coin.apply": 7, "stand.regular": 0 });
    const fair = new DemoJobFair(() => 0.5);
    fair.applyPrices({ "coin.apply": 9, "call.10": 12, "pack.koin-50": 15_000, "product.vip": 3_000_000, "product.tv": 0, "stand.premium": 20_000_000 });
    expect(price("coin.apply")).toBe(9);
    expect(price("coin.verify")).toBe(60);
    expect(loungePlans()[0]).toEqual({ minutes: 10, coins: 12, consultCoins: 20 });
    expect(fair.fair.coinStand.packages[0]!.price).toBe("Rp15.000");
    expect(VIP_PRODUCT.price).toBe(3_000_000);
    expect(ACCESSORY_PRODUCTS.find((p) => p.id === "tv")!.price).toBe(0);
    expect(STAND_PRICES.premium).toBe(20_000_000);
    fair.join("Sari", false, PLAYER_ID);
    const before = fair.player.coins;
    const b = fair.fair.booths[0]!;
    expect(fair.apply(PLAYER_ID, { boothId: b.id, jobId: b.jobs[0]!.id })).toBeTruthy();
    expect(before - fair.player.coins).toBe(9);
    setPriceTable({});
    expect(price("coin.apply")).toBe(5);
  });
});
