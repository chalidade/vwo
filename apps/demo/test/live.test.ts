import { describe, expect, it } from "vitest";
import { DEMO_JOB_FAIR, fairFloorId } from "@vwo/shared";
import { DemoJobFair, PLAYER_ID, remoteId } from "../src/jobfair-engine";
import { parseWire } from "../src/live";

const floor = fairFloorId(DEMO_JOB_FAIR, 0);
const known = (id: string) => id === floor;
const wire = (extra: object = {}) =>
  JSON.stringify({ v: 1, id: "abc123", name: "Sari", look: { skin: "#f1c27d", style: "long", glasses: true }, floorId: floor, x: 10, y: 12, facing: "front", seatId: null, say: null, ...extra });

describe("live channel", () => {
  it("accepts a well-formed player and rejects junk from the public broker", () => {
    const p = parseWire(wire({ name: "  Sari\u0007  Dewi ", say: "Halo!" }), known)!;
    expect(p.name).toBe("Sari Dewi");
    expect(p.say).toBe("Halo!");
    expect(p.look).toEqual({ skin: "#f1c27d", style: "long", glasses: true });
    expect(parseWire("not json", known)).toBeNull();
    expect(parseWire(wire({ v: 2 }), known)).toBeNull();
    expect(parseWire(wire({ floorId: "elsewhere" }), known)).toBeNull();
    expect(parseWire(wire({ x: "1e999" }), known)).toBeNull();
    expect(parseWire(wire({ facing: "up" }), known)).toBeNull();
    expect(parseWire(wire({ id: "../../x" }), known)).toBeNull();
    // Odd look values are dropped rather than drawn.
    expect(parseWire(wire({ look: { skin: "url(javascript:x)", hair: "#000" } }), known)!.look).toEqual({ hair: "#000" });
    expect(parseWire(wire({ name: "x".repeat(50) }), known)!.name).toHaveLength(20);
  });

  it("mirrors remote players as visitors and removes them when they leave", () => {
    const fair = new DemoJobFair(() => 0.5);
    const p = parseWire(wire(), known)!;
    fair.upsertRemote(p);
    const v = fair.visitors.get(remoteId("abc123"))!;
    expect(v.remote).toBe(true);
    expect(v.displayName).toBe("🌐 Sari");
    fair.upsertRemote({ ...p, x: 11, say: "Hai" });
    expect(v.x).toBe(11);
    expect(fair.bubbles.get(remoteId("abc123"))?.text).toBe("Hai");
    // A sofa seat on the ground floor is honoured; a made-up one is not.
    const sofa = fair.floors[0]!.seats.find((s) => s.sofa)!;
    fair.upsertRemote({ ...p, seatId: sofa.id });
    expect(fair.seatTaken(sofa.id)).toBe(true);
    fair.upsertRemote({ ...p, seatId: "nope" });
    expect(v.seatId).toBeNull();
    fair.removeRemote("abc123");
    expect(fair.visitors.has(remoteId("abc123"))).toBe(false);
  });
});

describe("live company inbox and notes", () => {
  const booth = DEMO_JOB_FAIR.booths[0]!;
  const job = booth.jobs[0]!;
  const app = (extra: object = {}) => ({
    id: "11111111-1111-1111-1111-111111111111",
    seeker: "u1",
    status: "Terkirim" as const,
    at: 1000,
    updatedAt: 1000,
    boothId: booth.id,
    company: booth.company,
    jobId: job.id,
    jobTitle: job.title,
    name: "Sari",
    email: "sari@example.com",
    ...extra,
  });

  it("works the booth's notifications out from its applications, with read marks that only grow", () => {
    const fair = new DemoJobFair(() => 0.5);
    fair.serverInbox = true;
    const marks: unknown[] = [];
    fair.onBoothRead = (_b, read) => marks.push(read);
    fair.mergeServer([app()], false);
    // A second device merging the same application makes no second notification.
    fair.mergeServer([app()], false);
    expect(fair.notifsFor(booth.id).map((n) => n.id)).toEqual(["apply:11111111-1111-1111-1111-111111111111"]);
    fair.mergeServer(
      [app({ updatedAt: 3000, messages: [{ at: 2000, from: "seeker", text: "Halo" }], interview: { at: 9000, mode: "Online", reply: "hadir", repliedAt: 2500 }, calls: [{ at: 2200, kind: "video", answered: false, seconds: 0 }] })],
      false,
    );
    expect(fair.notifsFor(booth.id).map((n) => n.kind)).toEqual(["confirm", "call", "chat", "apply"]);
    expect(fair.unreadFor(booth.id)).toBe(4);
    fair.markRead(booth.id, "chat:11111111-1111-1111-1111-111111111111:2000");
    expect(fair.unreadFor(booth.id)).toBe(3);
    fair.markRead(booth.id);
    expect(fair.unreadFor(booth.id)).toBe(0);
    expect(marks.at(-1)).toEqual({ all: 2500, ids: [] });
    // Another device's older marks don't make anything unread again.
    fair.setBoothRead(booth.id, { all: 1000, ids: [] });
    expect(fair.unreadFor(booth.id)).toBe(0);
  });

  it("keeps the company's notes from the server, but not over a note still being saved", async () => {
    const fair = new DemoJobFair(() => 0.5);
    fair.mergeServer([app({ notes: "Kandidat kuat" })], false);
    const a = fair.applications.find((x) => x.boothId === booth.id && x.name === "Sari")!;
    expect(a.notes).toBe("Kandidat kuat");
    let done!: (ok: boolean) => void;
    fair.onNote = () => new Promise((r) => (done = r));
    fair.noteApplicant(a.id, "Panggil interview");
    fair.mergeServer([app({ notes: "Kandidat kuat" })], false);
    expect(a.notes).toBe("Panggil interview");
    done(true);
    await Promise.resolve();
    await Promise.resolve();
    fair.mergeServer([app({ notes: "Panggil interview" })], false);
    expect(a.notes).toBe("Panggil interview");
  });
});

describe("live booth reviews", () => {
  it("rates booths from real reviews only, and a changed review replaces the old one", () => {
    const fair = new DemoJobFair(() => 0.5);
    const booth = DEMO_JOB_FAIR.booths[0]!.id;
    expect(fair.companyRating(booth).count).toBeGreaterThan(0); // the offline demo's made-up history
    const sent: [string, number][] = [];
    fair.onReview = (b, s) => sent.push([b, s]);
    fair.setReviews({ totals: { [booth]: { count: 2, sum: 9 } }, mine: {} });
    expect(fair.companyRating(booth)).toEqual({ count: 2, average: 4.5 });
    fair.join("Sari", false, PLAYER_ID);
    fair.reviewCompany(PLAYER_ID, booth, 3);
    expect(fair.companyRating(booth)).toEqual({ count: 3, average: 4 });
    fair.reviewCompany(PLAYER_ID, booth, 5);
    expect(fair.companyRating(booth)).toEqual({ count: 3, average: 14 / 3 });
    expect(fair.myReview(PLAYER_ID, booth)?.stars).toBe(5);
    expect(sent).toEqual([
      [booth, 3],
      [booth, 5],
    ]);
    expect(fair.companyRating(DEMO_JOB_FAIR.booths[1]!.id)).toEqual({ count: 0, average: 0 });
  });
});

describe("live counters", () => {
  it("sends what the player did, and takes the server's totals", () => {
    const fair = new DemoJobFair(() => 0.5);
    const hits: unknown[] = [];
    const events: unknown[] = [];
    fair.onStat = (h) => hits.push(h);
    fair.onEvent = (e) => events.push(e.type);
    const booth = DEMO_JOB_FAIR.booths[0]!;
    fair.join("Sari", false, PLAYER_ID);
    fair.join("Tamu", false, "someone-else");
    fair.visit(PLAYER_ID, booth.id);
    fair.visit("someone-else", booth.id);
    expect(hits).toEqual([{ key: `visit:${booth.id}`, what: "view" }]);
    expect(events).toEqual(["arrive", "visit"]);
    fair.setStats({ [`visit:${booth.id}`]: { views: 12, clicks: 0, sold: 0, coins: 0 }, "seminar:s1": { views: 4, clicks: 0, sold: 0, coins: 0 }, "stall:bakso": { views: 3, clicks: 1, sold: 2, coins: 16 } });
    expect(fair.visits.get(booth.id)).toBe(12);
    expect(fair.seminarCounts.get("s1")).toBe(4);
    expect(fair.ads.get("stall:bakso")).toEqual({ views: 3, clicks: 1, sold: 2, coins: 16 });
  });

  it("takes merchandise back when the server says it is gone", () => {
    const fair = new DemoJobFair(() => 0.5);
    const booth = fair.booth(DEMO_JOB_FAIR.booths[0]!.id)!;
    booth.accessories = [...(booth.accessories ?? []), "giveaway"];
    let asked: [string, string] | null = null;
    fair.onMerch = (b, v) => (asked = [b, v]);
    const r = fair.useAccessory(booth.id, "giveaway", "claim");
    expect(r.ok).toBe(true);
    expect(asked![0]).toBe(booth.id);
    expect(fair.player.vouchers.some((v) => v.id === asked![1])).toBe(true);
    fair.merchRefused(booth.id, asked![1], "out_of_stock");
    expect(fair.player.vouchers.some((v) => v.id === asked![1])).toBe(false);
    expect(fair.useAccessory(booth.id, "giveaway", "claim").ok).toBe(false);
  });
});
