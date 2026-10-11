import { describe, expect, it } from "vitest";
import { wibClock } from "@vwo/shared";
import { DemoJobFair, PLAYER_ID, type FairApplication } from "../src/jobfair-engine";

// 11 October 2026, 09.30 WIB.
const NOW = Date.UTC(2026, 9, 11, 2, 30);

const mine = (patch: Partial<FairApplication>): FairApplication =>
  ({ id: "a1", at: NOW, visitorId: PLAYER_ID, name: "Sari", boothId: "b", company: "Nusantara Tech", jobId: "j", jobTitle: "Frontend", email: "", phone: "", cvUrl: "", message: "", status: "Diundang interview", isBot: false, ...patch }) as FairApplication;

describe("reminders in the game", () => {
  it("'Ingatkan saya' on a rundown item: today while it is to come, else tomorrow, and off again", () => {
    const fair = new DemoJobFair(() => 0.5, () => NOW);
    expect(fair.toggleAulaReminder("seminar")).toBe("2026-10-11");
    expect(fair.remindedOn("seminar")).toBe("2026-10-11");
    // The opening speech at 09.00 is over: it is tomorrow's.
    expect(fair.toggleAulaReminder("buka")).toBe("2026-10-12");
    expect(fair.player.remind).toEqual({ "2026-10-11": ["seminar"], "2026-10-12": ["buka"] });
    expect(fair.toggleAulaReminder("seminar")).toBeNull();
    expect(fair.remindedOn("seminar")).toBeNull();
    expect(fair.toggleAulaReminder("not-on-the-rundown")).toBeNull();
  });

  it("lists the player's own interviews and reminded items for today, not other seekers'", () => {
    const fair = new DemoJobFair(() => 0.5, () => NOW);
    fair.applications.push(mine({ interview: { at: NOW + 3 * 3_600_000, mode: "Video call" } }));
    fair.applications.push(mine({ id: "a2", visitorId: "bot-1", interview: { at: NOW + 3_600_000, mode: "Video call" } }));
    fair.toggleAulaReminder("seminar");
    expect(fair.myReminders().map((r) => [r.kind, wibClock(r.at)])).toEqual([
      ["aula", "11.00"],
      ["interview", "12.30"],
    ]);
  });

  it("the remind list goes with the player's saved progress", () => {
    const a = new DemoJobFair(() => 0.5, () => NOW);
    a.toggleAulaReminder("talk2");
    const b = new DemoJobFair(() => 0.5, () => NOW);
    b.loadProgress(a.progress());
    expect(b.remindedOn("talk2")).toBe("2026-10-11");
  });
});

describe("seminar registration in the game", () => {
  const session = (id: string, patch: object = {}) => ({ id, title: `Sesi ${id}`, speaker: "Kak Nadia", role: "HR", slides: [{ title: "a", points: ["b"], say: "c" }], ...patch });

  it("registers for a dated session with seats, refuses full, undated and finished ones, and reminds", () => {
    const fair = new DemoJobFair(
      () => 0.5,
      () => NOW,
    );
    fair.saveSeminar(session("cv", { startAt: NOW + 3_600_000, minutes: 60, capacity: 1 }));
    fair.saveSeminar(session("tbd"));
    fair.saveSeminar(session("old", { startAt: NOW - 2 * 3_600_000, minutes: 60 }));
    expect(fair.toggleSeminarRegLocal("tbd")).toEqual({ ok: false, error: "unscheduled" });
    expect(fair.toggleSeminarRegLocal("old")).toEqual({ ok: false, error: "ended" });
    expect(fair.toggleSeminarRegLocal("cv")).toEqual({ ok: true, registered: true });
    expect(fair.seminarRegCount("cv")).toBe(1);
    expect(fair.myReminders().map((r) => [r.kind, wibClock(r.at)])).toEqual([["seminar", "10.30"]]);
    expect(fair.toggleSeminarRegLocal("cv")).toEqual({ ok: true, registered: false });
    expect(fair.myReminders()).toEqual([]);
    // Someone else took the only seat (the live site's count).
    fair.setSeminarRegs([], { cv: 1 });
    expect(fair.toggleSeminarRegLocal("cv")).toEqual({ ok: false, error: "full" });
  });

  it("live: the server's registrations replace the browser's", () => {
    const fair = new DemoJobFair(
      () => 0.5,
      () => NOW,
    );
    fair.saveSeminar(session("cv", { startAt: NOW + 3_600_000 }));
    fair.setSeminarRegs(["cv"], { cv: 7 });
    expect(fair.seminarRegCount("cv")).toBe(7);
    fair.seminarRegChanged("cv", false, 6);
    expect(fair.seminarRegs()).toEqual([]);
    expect(fair.seminarRegCount("cv")).toBe(6);
  });
});
