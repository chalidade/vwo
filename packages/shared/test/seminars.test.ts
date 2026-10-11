import { describe, expect, it } from "vitest";
import {
  type SeminarSlot,
  alertsDue,
  cleanSchedule,
  dueReminders,
  registerBlock,
  registrantsOf,
  reminderMessage,
  seminarPhase,
  seminarPushMark,
  seminarPushMessage,
  seminarPushesDue,
  seminarReminders,
  seminarSlots,
  seminarWhen,
  sortByStart,
  tomorrowOf,
  wibTime,
} from "../src";

// 12 October 2026, 10.00 WIB = 03.00 UTC.
const TEN = Date.UTC(2026, 9, 12, 3, 0);
const MIN = 60_000;
const slot = (patch: Partial<SeminarSlot> = {}): SeminarSlot => ({ id: "cv", title: "CV yang Dilirik Recruiter", speaker: "Kak Nadia", startAt: TEN, minutes: 60, ...patch });

describe("seminar schedule", () => {
  it("reads the organiser's sessions, keeping undated ones and dropping junk", () => {
    const org = {
      seminars: [
        { id: "cv", title: "CV", speaker: "Nadia", startAt: TEN, minutes: 90, capacity: 40, slides: [] },
        { id: "ai", title: "AI", speaker: "Dimas", slides: [] },
        { id: "bad id!", title: "x" },
        { id: "nt", title: 5 },
        null,
      ],
    };
    expect(seminarSlots(org)).toEqual([
      { id: "cv", title: "CV", speaker: "Nadia", startAt: TEN, minutes: 90, capacity: 40 },
      { id: "ai", title: "AI", speaker: "Dimas", startAt: undefined, minutes: 60, capacity: undefined },
    ]);
    expect(seminarSlots(null)).toEqual([]);
    expect(seminarSlots({ seminars: "no" })).toEqual([]);
  });

  it("cleans times, durations and seats", () => {
    expect(cleanSchedule({ startAt: "tomorrow", minutes: 2, capacity: 0 })).toEqual({ startAt: undefined, minutes: 5, capacity: undefined });
    expect(cleanSchedule({ startAt: Date.UTC(1999, 0, 1), minutes: 9999, capacity: 1e9 })).toEqual({ startAt: undefined, minutes: 600, capacity: 10_000 });
    expect(cleanSchedule({ startAt: TEN + 0.5, minutes: 44.6, capacity: 12.9 })).toEqual({ startAt: TEN, minutes: 45, capacity: 12 });
    expect(cleanSchedule({})).toEqual({ startAt: undefined, minutes: 60, capacity: undefined });
  });

  it("sorts by start time with undated sessions last, in their own order", () => {
    const list = [{ id: "a" }, { id: "late", startAt: TEN + 3_600_000 }, { id: "b" }, { id: "early", startAt: TEN }];
    expect(sortByStart(list).map((s) => s.id)).toEqual(["early", "late", "a", "b"]);
  });

  it("knows when a session is upcoming, live and over", () => {
    expect(seminarPhase(slot({ startAt: undefined }), TEN)).toBe("unscheduled");
    expect(seminarPhase(slot(), TEN - 1)).toBe("upcoming");
    expect(seminarPhase(slot(), TEN)).toBe("live");
    expect(seminarPhase(slot(), TEN + 59 * MIN)).toBe("live");
    expect(seminarPhase(slot(), TEN + 60 * MIN)).toBe("ended");
  });

  it("shows the time in WIB, or that it isn't set yet", () => {
    expect(seminarWhen(slot())).toBe("Sen, 12 Okt · 10.00–11.00 WIB");
    expect(seminarWhen(slot({ startAt: undefined }))).toBe("Jadwal belum ditentukan");
    // Set from a WIB date and clock: 23.30 WIB is still the same day in Jakarta.
    expect(seminarWhen(slot({ startAt: wibTime("2026-10-12", "23:30")!, minutes: 30 }))).toBe("Sen, 12 Okt · 23.30–00.00 WIB");
  });
});

describe("registration rules", () => {
  it("is open until the session ends, while there are seats", () => {
    expect(registerBlock(slot({ capacity: 2 }), 1, TEN - 86_400_000)).toBeNull();
    expect(registerBlock(slot({ capacity: 2 }), 1, TEN + 30 * MIN)).toBeNull();
    expect(registerBlock(slot({ capacity: 2 }), 2, TEN - MIN)).toBe("full");
    expect(registerBlock(slot(), 1, TEN + 60 * MIN)).toBe("ended");
    expect(registerBlock(slot({ startAt: undefined }), 0, TEN)).toBe("unscheduled");
    // No seat limit still has the hard cap.
    expect(registerBlock(slot(), 4_999, TEN - MIN)).toBeNull();
    expect(registerBlock(slot(), 5_000, TEN - MIN)).toBe("full");
  });

  it("reads registrants from the server document, ignoring junk", () => {
    expect(registrantsOf({ users: { "u-1": 5, "bad id": 6, u2: "x" } })).toEqual({ "u-1": 5 });
    expect(registrantsOf(null)).toEqual({});
    expect(registrantsOf({ users: [] })).toEqual({});
  });
});

describe("seminar reminders", () => {
  it("lists registered sessions on that WIB day only", () => {
    const slots = [slot(), slot({ id: "ai", title: "Karier di Era AI", startAt: TEN + 86_400_000 }), slot({ id: "nodate", startAt: undefined })];
    const today = seminarReminders(slots, ["cv", "ai", "nodate"], "2026-10-12");
    expect(today).toEqual([{ kind: "seminar", key: `sem:cv:${TEN}`, at: TEN, title: "Seminar: CV yang Dilirik Recruiter", where: "Ruang Seminar · Kak Nadia" }]);
    expect(seminarReminders(slots, ["cv"], "2026-10-13")).toEqual([]);
    expect(seminarReminders(slots, ["ai"], "2026-10-13").map((r) => r.key)).toEqual([`sem:ai:${TEN + 86_400_000}`]);
    expect(tomorrowOf(TEN)).toBe("2026-10-13");
  });

  it("joins the day's other reminders in time order", () => {
    const list = dueReminders({ day: "2026-10-12", applications: [], remind: {}, rundown: [], extra: seminarReminders([slot()], ["cv"], "2026-10-12") });
    expect(list.map((r) => r.kind)).toEqual(["seminar"]);
  });

  it("alerts in the game an hour and 15 minutes before a seminar", () => {
    const [r] = seminarReminders([slot()], ["cv"], "2026-10-12");
    expect(alertsDue([r!], TEN - 61 * MIN, new Set())).toEqual([]);
    expect(alertsDue([r!], TEN - 60 * MIN, new Set()).map((a) => a.mark)).toEqual([`${r!.key}@60`]);
    expect(alertsDue([r!], TEN - 14 * MIN, new Set([`${r!.key}@60`])).map((a) => [a.mark, a.minutes])).toEqual([[`${r!.key}@15`, 14]]);
    expect(alertsDue([r!], TEN - 5 * MIN, new Set([`${r!.key}@15`]))).toEqual([]);
    expect(alertsDue([r!], TEN, new Set())).toEqual([]);
  });

  it("sends H-1 seminars in the morning message, alone or after today's schedule", () => {
    const tomorrow = seminarReminders([slot({ startAt: TEN + 86_400_000 })], ["cv"], "2026-10-13");
    const only = reminderMessage("Sari", "2026-10-12", [], "https://jobfair.co.id/play/", tomorrow);
    expect(only.subject).toBe("Besok jam 10.00: Seminar: CV yang Dilirik Recruiter");
    expect(only.text).toContain("besok Selasa, 13 Oktober kamu sudah terdaftar");
    expect(only.push.title).toContain("Besok 10.00");
    const today = seminarReminders([slot()], ["cv"], "2026-10-12");
    const both = reminderMessage("Sari", "2026-10-12", today, "https://jobfair.co.id/play/", tomorrow);
    expect(both.subject).toBe("Pengingat: Seminar: CV yang Dilirik Recruiter jam 10.00 hari ini");
    expect(both.text).toContain("Besok, Selasa, 13 Oktober:");
    // Without seminars tomorrow the message is as before.
    expect(reminderMessage("Sari", "2026-10-12", today, "u").text).not.toContain("Besok");
  });
});

describe("seminar pushes", () => {
  it("sends '15 minutes to go' before the start and 'starting' in its first minutes", () => {
    const s = slot({ minutes: 10 });
    expect(seminarPushesDue([s], TEN - 16 * MIN)).toEqual([]);
    expect(seminarPushesDue([s], TEN - 15 * MIN).map((d) => d.kind)).toEqual(["soon"]);
    expect(seminarPushesDue([s], TEN - 1).map((d) => d.mark)).toEqual([`sempush:cv:${TEN}:soon`]);
    expect(seminarPushesDue([s], TEN).map((d) => d.kind)).toEqual(["start"]);
    // A ten-minute session stops announcing itself once it is over.
    expect(seminarPushesDue([s], TEN + 10 * MIN)).toEqual([]);
    expect(seminarPushesDue([slot()], TEN + 14 * MIN).map((d) => d.kind)).toEqual(["start"]);
    expect(seminarPushesDue([slot()], TEN + 15 * MIN)).toEqual([]);
    expect(seminarPushesDue([slot({ startAt: undefined })], TEN)).toEqual([]);
  });

  it("marks each push per session time, so moving a session sends again", () => {
    expect(seminarPushMark(slot(), "soon")).not.toBe(seminarPushMark(slot({ startAt: TEN + MIN }), "soon"));
  });

  it("words the pushes", () => {
    expect(seminarPushMessage(slot(), "soon", TEN - 12 * MIN).title).toBe("⏰ 12 menit lagi: CV yang Dilirik Recruiter");
    expect(seminarPushMessage(slot(), "start", TEN).title).toBe("🔴 Seminar dimulai: CV yang Dilirik Recruiter");
  });
});
