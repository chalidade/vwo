import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PREREG_ALPHABET,
  csvCell,
  fillEmptyProfile,
  isGmail,
  newPreregCode,
  normalizePreregCode,
  preregCsv,
  preregEventInput,
  preregInput,
  preregSlug,
  preregState,
  profileFromPrereg,
} from "../src";

const form = {
  fullName: "Sari Wulandari",
  email: " Sari@Gmail.com ",
  whatsapp: "0812 3456 7890",
  city: "Kota Bandung",
  age: "18–22",
  education: "S1",
  major: "Teknik Informatika",
  institution: "Universitas Padjadjaran",
  status: "Fresh graduate",
  fields: ["Teknologi informasi", "Data"],
  jobTypes: ["Full-time", "Magang"],
  skills: "react, sql, React",
  experience: "",
  link: "linkedin.com/in/sari",
  consent: true,
};

describe("code", () => {
  it("is JF-XXXX-XXXX from the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const c = newPreregCode((n) => randomBytes(n));
      expect(c).toMatch(/^JF-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      for (const ch of c.slice(3).replace("-", "")) expect(PREREG_ALPHABET).toContain(ch);
      expect(c.slice(3)).not.toMatch(/[01OIL]/);
    }
  });

  it("does not repeat in practice", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => newPreregCode((n) => randomBytes(n))));
    expect(seen.size).toBe(5000);
  });

  it("skips bytes that would bias the draw", () => {
    // 248 and up would favour the first letters; a source of only those never yields them.
    let calls = 0;
    const code = newPreregCode((n) => (calls++ === 0 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(0)));
    expect(code).toBe("JF-2222-2222");
  });

  it("reads a typed code back however it was typed", () => {
    expect(normalizePreregCode("jf-7k3m-q9tx")).toBe("JF-7K3M-Q9TX");
    expect(normalizePreregCode(" JF 7K3M Q9TX ")).toBe("JF-7K3M-Q9TX");
    expect(normalizePreregCode("7K3MQ9TX")).toBe("JF-7K3M-Q9TX");
    expect(normalizePreregCode("JF-7K3M-Q9T0")).toBeNull();
    expect(normalizePreregCode("JF-7K3M")).toBeNull();
    expect(normalizePreregCode(42)).toBeNull();
    expect(normalizePreregCode("x".repeat(100))).toBeNull();
  });
});

describe("form", () => {
  it("accepts a full form and cleans it", () => {
    const d = preregInput.parse(form);
    expect(d.email).toBe("sari@gmail.com");
    expect(d.skills).toBe("React, SQL");
    expect(d.link).toBe("https://linkedin.com/in/sari");
  });

  it("refuses what the profile can't take", () => {
    const bad = (over: Record<string, unknown>) => preregInput.safeParse({ ...form, ...over }).success;
    expect(bad({ consent: false })).toBe(false);
    expect(bad({ email: "bukan-email" })).toBe(false);
    expect(bad({ whatsapp: "telepon saya" })).toBe(false);
    expect(bad({ link: "javascript:alert(1)" })).toBe(false);
    expect(bad({ link: "ftp://x.id" })).toBe(false);
    expect(bad({ fields: ["Hacking"] })).toBe(false);
    expect(bad({ fields: [] })).toBe(false);
    expect(bad({ fields: ["Data", "Data"] })).toBe(false);
    expect(bad({ jobTypes: ["Freelance"] })).toBe(false);
    expect(bad({ education: "S9" })).toBe(false);
    expect(bad({ fullName: "x".repeat(81) })).toBe(false);
    expect(bad({ experience: "x".repeat(1001) })).toBe(false);
    expect(bad({ link: "" })).toBe(true);
  });

  it("tells Gmail addresses apart", () => {
    expect(isGmail("a@gmail.com")).toBe(true);
    expect(isGmail("a@googlemail.com")).toBe(true);
    expect(isGmail("a@kampus.ac.id")).toBe(false);
  });
});

describe("profile", () => {
  it("maps a sign-up onto the profile fields", () => {
    expect(profileFromPrereg(preregInput.parse(form))).toEqual({
      name: "Sari Wulandari",
      headline: "Fresh graduate Teknik Informatika",
      email: "sari@gmail.com",
      phone: "0812 3456 7890",
      city: "Kota Bandung",
      education: "S1 Teknik Informatika",
      campus: "Universitas Padjadjaran",
      skills: "React, SQL",
      cvUrl: "https://linkedin.com/in/sari",
    });
  });

  it("fills only the empty fields", () => {
    const out = fillEmptyProfile({ name: "Sari W.", city: " ", photo: "x", contactable: true }, { name: "Sari Wulandari", city: "Kota Bandung", cvUrl: "" });
    expect(out.profile).toEqual({ name: "Sari W.", city: "Kota Bandung", photo: "x", contactable: true });
    expect(out.filled).toEqual(["city"]);
    expect(fillEmptyProfile(null, { name: "A" }).profile).toEqual({ name: "A" });
  });
});

describe("event", () => {
  it("makes an address from the name, or keeps a good typed one", () => {
    expect(preregSlug("Job Fair Bandung 2027!")).toBe("job-fair-bandung-2027");
    expect(preregSlug("x", "kampus-ui")).toBe("kampus-ui");
    expect(preregSlug("Pameran Kerja", "../admin")).toBe("pameran-kerja");
    expect(preregSlug("Ö")).toMatch(/^event/);
  });

  it("takes sign-ups only while open, before the deadline, with room left", () => {
    const now = Date.parse("2027-01-01T00:00:00Z");
    expect(preregState({ open: false, deadline: null, capacity: null }, 0, now)).toBe("closed");
    expect(preregState({ open: true, deadline: new Date(now - 1), capacity: null }, 0, now)).toBe("deadline");
    expect(preregState({ open: true, deadline: null, capacity: 2 }, 2, now)).toBe("full");
    expect(preregState({ open: true, deadline: new Date(now + 1), capacity: 2 }, 1, now)).toBe("open");
  });

  it("checks the organiser's form", () => {
    const ok = preregEventInput.safeParse({ name: "Job Fair", location: "Online", open: true, startDate: "2027-02-30" });
    expect(ok.success && ok.data.startDate).toBe("");
    expect(preregEventInput.safeParse({ name: "Job Fair", location: "Online", open: true, banner: "data:image/svg+xml;base64,AAAA" }).success).toBe(false);
    expect(preregEventInput.safeParse({ name: "Job Fair", location: "Online", open: true, capacity: 0 }).success).toBe(false);
  });
});

describe("csv", () => {
  it("quotes cells and defuses formulas", () => {
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+62812")).toBe(`"'+62812"`);
    expect(csvCell(null)).toBe('""');
  });

  it("writes one row per registrant after the header", () => {
    const csv = preregCsv([{ code: "JF-2222-2222", data: preregInput.parse(form), createdAt: 0, linkedAt: null }]);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"JF-2222-2222","Sari Wulandari","sari@gmail.com"');
  });
});

describe("park building link", () => {
  it("keeps a usable pre-registration address and drops anything else", async () => {
    const { cleanParkBuildings } = await import("../src");
    const [a, b] = cleanParkBuildings([
      { id: "a", name: "A", regSlug: "job-fair-bandung" },
      { id: "b", name: "B", regSlug: "../../admin" },
    ]);
    expect(a!.regSlug).toBe("job-fair-bandung");
    expect(b).not.toHaveProperty("regSlug");
  });
});
