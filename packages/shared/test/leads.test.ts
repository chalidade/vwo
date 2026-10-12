// Booth and stall requests: the form's checks, the stored request, and the organiser's decisions.
import { describe, expect, it } from "vitest";
import { boothLeadInput, cleanWebsite, type Lead, leadOps, newLead, sortLeads, stallLeadInput, telLink, waLink } from "../src";

const booth = {
  company: "PT Contoh Maju",
  industry: "Teknologi",
  city: "Jakarta",
  website: "",
  contactName: "Rina",
  contactRole: "HR",
  email: "hr@contoh.co.id",
  phone: "0812 3456 7890",
};
const stall = { business: "Warung Rina", sells: "Nasi uduk", contactName: "Rina", email: "rina@contoh.id", phone: "081234567890" };
const make = (over: Partial<Lead> = {}): Lead => ({ ...newLead("l1", "u1", { kind: "booth", data: boothLeadInput.parse(booth) }, 1), ...over });

describe("lead forms", () => {
  it("accepts a booth form without a website and with a site typed without https", () => {
    expect(boothLeadInput.parse(booth).website).toBe("");
    expect(boothLeadInput.parse({ ...booth, website: "contoh.co.id" }).website).toBe("https://contoh.co.id/");
  });

  it("refuses bad contacts, oversize fields, a filled honeypot and odd websites", () => {
    for (const bad of [
      { ...booth, email: "nope" },
      { ...booth, phone: "call me" },
      { ...booth, company: "x" },
      { ...booth, company: "x".repeat(61) },
      { ...booth, note: "x".repeat(501) },
      { ...booth, website2: "spam" },
      { ...booth, website: "javascript:alert(1)" },
      { ...booth, website: "localhost" },
      { ...booth, want: { floor: 99, x: 1, y: 1 } },
    ])
      expect(boothLeadInput.safeParse(bad).success).toBe(false);
    expect(stallLeadInput.safeParse({ ...stall, slot: 99 }).success).toBe(false);
    expect(stallLeadInput.safeParse({ ...stall, sells: "" }).success).toBe(false);
    expect(stallLeadInput.safeParse({ ...stall, slot: 3 }).success).toBe(true);
  });

  it("stores no price and keeps what the form said", () => {
    const l = newLead("s1", "u1", { kind: "stall", data: stallLeadInput.parse({ ...stall, slot: 2, note: "Pagi saja" }) }, 5);
    expect(l).toMatchObject({ kind: "stall", status: "new", name: "Warung Rina", sells: "Nasi uduk", wantSlot: 2, note: "Pagi saja", userId: "u1", at: 5 });
    expect(JSON.stringify(l)).not.toMatch(/price|coin/);
  });
});

describe("leadOps", () => {
  it("caps open requests per account and kind", () => {
    const open = [make({ id: "a" }), make({ id: "b", status: "contacted" }), make({ id: "c" })];
    expect(leadOps.create(open, make({ id: "d" }))).toEqual({ error: "too_many_open" });
    expect("result" in leadOps.create([...open.slice(0, 2), make({ id: "c", status: "done" })], make({ id: "d" }))).toBe(true);
    expect("result" in leadOps.create(open, make({ id: "d", kind: "stall" }))).toBe(true);
    expect("result" in leadOps.create(open, make({ id: "d", userId: "u2" }))).toBe(true);
  });

  it("finishes a request once, and only while it is open", () => {
    const done = leadOps.finish(make(), { boothId: "pt-contoh", pin: "123456", by: "admin" }, 9);
    expect(done).toMatchObject({ result: { status: "done", result: { boothId: "pt-contoh", at: 9 } } });
    expect(leadOps.finish((done as { result: Lead }).result, { boothId: "x", by: "admin" }, 10)).toEqual({ error: "not_open" });
    expect(leadOps.finish(make({ status: "rejected" }), { boothId: "x", by: "admin" }, 10)).toEqual({ error: "not_open" });
  });

  it("lets the organiser move the status and keep notes, but not reopen a fulfilled one", () => {
    expect(leadOps.edit(make(), { status: "contacted", orgNote: "Telepon besok" }, 3)).toMatchObject({ result: { status: "contacted", orgNote: "Telepon besok", updatedAt: 3 } });
    const fulfilled = make({ status: "done", result: { boothId: "b", at: 1, by: "a" } });
    expect(leadOps.edit(fulfilled, { status: "new" }, 3)).toEqual({ error: "fulfilled" });
    expect(leadOps.edit(fulfilled, { orgNote: "Sudah bayar transfer" }, 3)).toMatchObject({ result: { status: "done", orgNote: "Sudah bayar transfer" } });
  });

  it("lists open requests first, newest first", () => {
    const list = sortLeads([make({ id: "old", at: 1 }), make({ id: "done", at: 9, status: "done" }), make({ id: "new", at: 5 })]);
    expect(list.map((l) => l.id)).toEqual(["new", "old", "done"]);
  });
});

describe("contact links", () => {
  it("builds WhatsApp and phone links from Indonesian numbers", () => {
    expect(waLink("0812 3456 7890")).toBe("https://wa.me/6281234567890");
    expect(waLink("+62 812-3456-7890")).toBe("https://wa.me/6281234567890");
    expect(waLink("12")).toBeNull();
    expect(telLink("+62 812-3456")).toBe("tel:+628123456");
    expect(telLink("0812 3456")).toBe("tel:08123456");
  });

  it("cleans websites", () => {
    expect(cleanWebsite("")).toBe("");
    expect(cleanWebsite("http://a.id")).toBe("http://a.id/");
    expect(cleanWebsite("ftp://a.id")).toBeNull();
  });
});
