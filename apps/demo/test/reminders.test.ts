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
