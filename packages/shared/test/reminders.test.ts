import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUNDOWN,
  type AulaEvent,
  type ReminderApplication,
  alertsDue,
  applicationReminders,
  aulaReminders,
  cleanRemind,
  dueReminders,
  nextDay,
  remindDayFor,
  reminderMessage,
  rundownOf,
  toggleRemind,
  wibClock,
  wibDay,
  wibTime,
} from "../src";

// 11 October 2026, 09.00 WIB = 02.00 UTC.
const NINE = Date.UTC(2026, 9, 11, 2, 0);
const DAY = "2026-10-11";

const app = (patch: Partial<ReminderApplication> = {}): ReminderApplication => ({ id: "a1", company: "Nusantara Tech", jobTitle: "Frontend Developer", status: "Diundang interview", ...patch });

describe("WIB time", () => {
  it("works out the day and clock in Jakarta, not UTC", () => {
    // 23.30 UTC on the 10th is already 06.30 on the 11th in Jakarta.
    expect(wibDay(Date.UTC(2026, 9, 10, 23, 30))).toBe(DAY);
    expect(wibDay(Date.UTC(2026, 9, 10, 16, 59))).toBe("2026-10-10");
    expect(wibDay(Date.UTC(2026, 9, 10, 17, 0))).toBe(DAY);
    expect(wibClock(NINE)).toBe("09.00");
    expect(wibTime(DAY, "09.00")).toBe(NINE);
    expect(wibTime(DAY, "09:00")).toBe(NINE);
    expect(wibTime(DAY, "00.00")).toBe(Date.UTC(2026, 9, 10, 17, 0));
  });

  it("rejects malformed days and clocks", () => {
    expect(wibTime("11-10-2026", "09.00")).toBeNull();
    expect(wibTime(DAY, "9.00")).toBeNull();
    expect(wibTime(DAY, "25.00")).toBeNull();
    expect(wibTime(DAY, "09.75")).toBeNull();
  });

  it("steps over month ends", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});

describe("applicationReminders", () => {
  it("lists today's interview and office visit, in WIB", () => {
    const list = applicationReminders(
      [app({ interview: { at: NINE, mode: "Video call", place: "https://meet.example/abc" }, visit: { at: NINE + 5 * 3_600_000, address: "Jl. Sudirman 1" } })],
      DAY,
    );
    expect(list.map((r) => r.kind)).toEqual(["interview", "visit"]);
    expect(list[0]).toMatchObject({ title: "Interview Frontend Developer · Nusantara Tech", where: "Video call · https://meet.example/abc", at: NINE });
    expect(list[1]).toMatchObject({ title: "Kunjungan kantor Nusantara Tech", where: "Jl. Sudirman 1" });
  });

  it("an interview at 05.00 WIB is today's, though it is still yesterday in UTC", () => {
    const early = Date.UTC(2026, 9, 10, 22, 0);
    expect(applicationReminders([app({ interview: { at: early, mode: "Telepon" } })], DAY)).toHaveLength(1);
    expect(applicationReminders([app({ interview: { at: early, mode: "Telepon" } })], "2026-10-10")).toHaveLength(0);
  });

  it("skips other days, rejected applications and invitations the seeker asked to move", () => {
    expect(applicationReminders([app({ interview: { at: NINE + 86_400_000, mode: "Video call" } })], DAY)).toEqual([]);
    expect(applicationReminders([app({ status: "Belum cocok", interview: { at: NINE, mode: "Video call" } })], DAY)).toEqual([]);
    expect(applicationReminders([app({ interview: { at: NINE, mode: "Video call", reply: "jadwal-ulang" } })], DAY)).toEqual([]);
    expect(applicationReminders([app({ interview: { at: NINE, mode: "Video call", reply: "hadir" } })], DAY)).toHaveLength(1);
  });

  it("ignores a broken time instead of throwing", () => {
    expect(applicationReminders([app({ interview: { at: Number.NaN, mode: "x" } }), app({ visit: { at: "soon" as unknown as number, address: "x" } })], DAY)).toEqual([]);
  });
});

describe("remind list", () => {
  it("keeps only well-formed days and ids", () => {
    expect(cleanRemind(null)).toEqual({});
    expect(cleanRemind(["talk1"])).toEqual({});
    expect(cleanRemind({ [DAY]: ["talk1", "talk1", 5, "bad id!"], tomorrow: ["x"], "2026-10-12": "talk2" })).toEqual({ [DAY]: ["talk1"] });
  });

  it("toggles an item on and off and drops past days", () => {
    let list = toggleRemind({ "2026-10-01": ["old"] }, DAY, "talk1", DAY);
    expect(list).toEqual({ [DAY]: ["talk1"] });
    list = toggleRemind(list, DAY, "seminar", DAY);
    expect(list[DAY]).toEqual(["talk1", "seminar"]);
    list = toggleRemind(list, DAY, "talk1", DAY);
    list = toggleRemind(list, DAY, "seminar", DAY);
    expect(list).toEqual({});
  });

  it("is for today while the item is still to come, else tomorrow", () => {
    expect(remindDayFor({ start: "10.00" }, NINE)).toBe(DAY);
    expect(remindDayFor({ start: "09.00" }, NINE)).toBe("2026-10-12");
    expect(remindDayFor({ start: "08.00" }, NINE)).toBe("2026-10-12");
  });
});

describe("aulaReminders", () => {
  it("finds the reminded rundown items of the day, and skips removed ones", () => {
    const list = aulaReminders({ [DAY]: ["seminar", "gone"], "2026-10-12": ["talk1"] }, DEFAULT_RUNDOWN, DAY);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "aula", title: "Seminar CV & interview", where: "Ruang Seminar · Lantai 5", at: wibTime(DAY, "11.00") });
  });

  it("reads the organiser's rundown, or the default one", () => {
    const custom: AulaEvent[] = [{ id: "x", start: "13.00", end: "14.00", title: "Kelas LinkedIn", host: "Kak Dina", kind: "talkshow" }];
    expect(rundownOf({ rundown: custom })).toEqual(custom);
    expect(rundownOf({})).toBe(DEFAULT_RUNDOWN);
    expect(rundownOf(null)).toBe(DEFAULT_RUNDOWN);
    expect(rundownOf({ rundown: [null, { id: 1 }, ...custom] })).toEqual(custom);
  });
});

describe("dueReminders", () => {
  it("merges applications and Aula items, earliest first", () => {
    const list = dueReminders({
      day: DAY,
      applications: [app({ interview: { at: wibTime(DAY, "13.30")!, mode: "Video call" } })],
      remind: { [DAY]: ["seminar", "talk1"] },
      rundown: DEFAULT_RUNDOWN,
    });
    expect(list.map((r) => wibClock(r.at))).toEqual(["10.00", "11.00", "13.30"]);
    expect(list.map((r) => r.kind)).toEqual(["aula", "aula", "interview"]);
  });

  it("is empty when nothing is on", () => {
    expect(dueReminders({ day: DAY, applications: [app()], remind: undefined, rundown: DEFAULT_RUNDOWN })).toEqual([]);
  });
});

describe("alertsDue", () => {
  const r = applicationReminders([app({ interview: { at: NINE, mode: "Video call" } })], DAY);

  it("alerts an hour before, then ten minutes before, once each", () => {
    const shown = new Set<string>();
    expect(alertsDue(r, NINE - 61 * 60_000, shown)).toEqual([]);
    const first = alertsDue(r, NINE - 59 * 60_000, shown);
    expect(first).toHaveLength(1);
    expect(first[0]!.minutes).toBe(59);
    shown.add(first[0]!.mark);
    expect(alertsDue(r, NINE - 30 * 60_000, shown)).toEqual([]);
    const second = alertsDue(r, NINE - 9 * 60_000, shown);
    expect(second).toHaveLength(1);
    expect(second[0]!.mark).not.toBe(first[0]!.mark);
    shown.add(second[0]!.mark);
    expect(alertsDue(r, NINE - 1 * 60_000, shown)).toEqual([]);
  });

  it("opening the game five minutes before shows only the ten-minute alert", () => {
    const due = alertsDue(r, NINE - 5 * 60_000, new Set());
    expect(due).toHaveLength(1);
    expect(due[0]!.mark.endsWith("@10")).toBe(true);
  });

  it("nothing once it has started", () => {
    expect(alertsDue(r, NINE, new Set())).toEqual([]);
  });
});

describe("reminderMessage", () => {
  it("lists the schedule in WIB with a link, in Indonesian", () => {
    const list = dueReminders({ day: DAY, applications: [app({ interview: { at: NINE, mode: "Video call" } })], remind: { [DAY]: ["seminar"] }, rundown: DEFAULT_RUNDOWN });
    const m = reminderMessage("Sari", DAY, list, "https://jobfair.co.id/play/");
    expect(m.subject).toBe("Pengingat: 2 jadwal kamu hari ini");
    expect(m.text).toContain("Halo Sari,");
    expect(m.text).toContain("09.00 WIB · Interview Frontend Developer · Nusantara Tech");
    expect(m.text).toContain("11.00 WIB · Seminar CV & interview");
    expect(m.text).toContain("https://jobfair.co.id/play/");
    expect(m.push.title).toBe("⏰ 2 jadwal kamu hari ini");
    expect(m.push.body).toContain("09.00 Interview");
  });

  it("names the single event in the subject", () => {
    const list = applicationReminders([app({ visit: { at: NINE, address: "Jl. Sudirman 1" } })], DAY);
    const m = reminderMessage("", DAY, list, "https://x/play/");
    expect(m.subject).toBe("Pengingat: Kunjungan kantor Nusantara Tech jam 09.00 hari ini");
    expect(m.push.body).toBe("Jl. Sudirman 1");
    expect(m.text).toContain("Halo kamu,");
  });
});
