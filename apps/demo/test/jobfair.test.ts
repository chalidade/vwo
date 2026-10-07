import { describe, expect, it } from "vitest";
import { COIN_STAND_SPOTS, DEMO_JOB_FAIR, LIFT_FRONT, SPONSOR_H, SPONSOR_W, boothSpot, fairRoomFloorId, findPath, isBlocked, stallSpot } from "@vwo/shared";
import { APPLY_COST, DAILY_COINS, GAME_DAILY_CAP, MISSIONS_BONUS, SEMINARS, START_COINS, VERIFY_COST, levelOf, seminarScript, todaysMissions, CAREER_ARTICLES, stepKey } from "../src/fair/content";
import { BOOTH_SLOTS, DemoJobFair, type FairSaved, PLAYER_ID, promoterId, recruiterId } from "../src/jobfair-engine";
import { VIP_PRODUCT, matchScore } from "../src/fair/company";

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
    const p = fair.fair.promoters.find((x) => x.walks && x.level === 0)!;
    fair.join("Chalid", false, PLAYER_ID);
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
});
