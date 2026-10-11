import { describe, expect, it } from "vitest";
import {
  ANNOUNCE_HISTORY,
  cleanBoard,
  currentAnnouncement,
  DEMO_JOB_FAIR,
  EMPTY_BOARD,
  editStall,
  hideAnnouncement,
  legacyBoard,
  postAnnouncement,
  removeAnnouncement,
  repostAnnouncement,
} from "../src";

describe("announcement board", () => {
  it("shows the newest, keeps the old ones, and takes one down without losing it", () => {
    let b = postAnnouncement(EMPTY_BOARD, "  Walk-in jam 13.00 ", 1, "a1");
    b = postAnnouncement(b, "Seminar mulai", 2, "a2");
    expect(currentAnnouncement(b)).toEqual({ id: "a2", text: "Seminar mulai", at: 2 });
    expect(b.history.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(b.history[1]!.text).toBe("Walk-in jam 13.00");
    b = hideAnnouncement(b);
    expect(currentAnnouncement(b)).toBeUndefined();
    expect(b.history).toHaveLength(2);
    expect(postAnnouncement(b, "   ", 3, "a3")).toBe(b);
  });

  it("deletes one for good, clearing the screen only when it was the one showing", () => {
    let b = postAnnouncement(postAnnouncement(EMPTY_BOARD, "satu", 1, "a1"), "dua", 2, "a2");
    b = removeAnnouncement(b, "a1");
    expect(b).toEqual({ current: "a2", history: [{ id: "a2", text: "dua", at: 2 }] });
    b = removeAnnouncement(b, "a2");
    expect(b).toEqual(EMPTY_BOARD);
  });

  it("shows a past one again as new, so visitors who closed it see it once more", () => {
    let b = postAnnouncement(postAnnouncement(EMPTY_BOARD, "satu", 1, "a1"), "dua", 2, "a2");
    b = repostAnnouncement(b, "a1", 5, "a3");
    expect(currentAnnouncement(b)).toEqual({ id: "a3", text: "satu", at: 5 });
    expect(b.history.map((a) => a.id)).toEqual(["a3", "a2"]);
    expect(repostAnnouncement(b, "nope", 6, "a4")).toBe(b);
  });

  it("keeps a bounded history and cleans what was stored", () => {
    let b = EMPTY_BOARD;
    for (let i = 0; i < ANNOUNCE_HISTORY + 5; i++) b = postAnnouncement(b, `n${i}`, i, `a${i}`);
    expect(b.history).toHaveLength(ANNOUNCE_HISTORY);
    expect(cleanBoard({ current: "x", history: [{ id: "bad id!", text: "a", at: 1 }, { id: "ok", text: "<b>" + "x".repeat(500), at: 2 }, "junk"] })).toEqual({
      current: null,
      history: [{ id: "ok", text: ("<b>" + "x".repeat(500)).slice(0, 200), at: 2 }],
    });
    expect(cleanBoard(null)).toEqual(EMPTY_BOARD);
  });

  it("starts from the announcement kept in the old setup", () => {
    expect(legacyBoard({ announcement: { text: "lama", at: 9 } })).toEqual({ current: "a9", history: [{ id: "a9", text: "lama", at: 9 }] });
    expect(legacyBoard({})).toEqual(EMPTY_BOARD);
    expect(legacyBoard(null)).toEqual(EMPTY_BOARD);
  });
});

describe("editing a food court stall", () => {
  const stall = DEMO_JOB_FAIR.rooms.flatMap((r) => r.stalls ?? []).find((s) => s.deals.length > 0)!;

  it("changes only what was given, and keeps id and slot", () => {
    const out = editStall({ ...stall, slot: 3 }, { name: "  Bakso Baru ", hours: "10.00–21.00" });
    expect(out.id).toBe(stall.id);
    expect(out.slot).toBe(3);
    expect(out.name).toBe("Bakso Baru");
    expect(out.hours).toBe("10.00–21.00");
    expect(out.deals).toEqual(stall.deals);
    expect(out.menu).toEqual(stall.menu);
    expect(editStall(stall, { name: "   " }).name).toBe(stall.name);
  });

  it("keeps vouchers by id, adds new ones with fresh ids, and bounds prices", () => {
    const first = stall.deals[0]!;
    const out = editStall(stall, {
      deals: [
        { title: "Baru", worth: "Rp10.000", price: 999 },
        { id: first.id, title: "Diubah", worth: first.worth, price: 0.4 },
        { title: "", worth: "", price: 5 },
        { title: "Gratis?", worth: "", price: 0 },
      ],
    });
    expect(out.deals).toHaveLength(2);
    expect(out.deals[0]!.price).toBe(200);
    expect(out.deals[0]!.id).not.toBe(first.id);
    expect(stall.deals.some((d) => d.id === out.deals[0]!.id)).toBe(false);
    expect(out.deals[1]).toMatchObject({ id: first.id, title: "Diubah", price: 1 });
    expect(editStall(stall, { deals: Array.from({ length: 9 }, (_, i) => ({ title: `v${i}`, worth: "", price: 5 })) }).deals).toHaveLength(4);
  });

  it("drops a colour or link that is not one", () => {
    const out = editStall(stall, { color: "red;background:url(x)", website: "javascript:alert(1)" });
    expect(out.color).toBe(stall.color);
    expect(out.website).toBe("");
    expect(editStall(stall, { website: "https://contoh.example" }).website).toBe("https://contoh.example");
  });
});
