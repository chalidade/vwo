import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SUSPECT_AT,
  botUserAgent,
  emailKey,
  ipBucket,
  isDisposableEmail,
  isIndonesianMobile,
  junkText,
  leadingZeroBits,
  plausibleEmail,
  solvePow,
  suspicion,
} from "../src/antibot";

describe("emails", () => {
  it("treats one Gmail inbox written many ways as one", () => {
    expect(emailKey("S.A.R.I+jobfair@Gmail.com")).toBe("sari@gmail.com");
    expect(emailKey("sari@googlemail.com")).toBe("sari@gmail.com");
    expect(emailKey("s.ari@gmail.com")).toBe(emailKey("sari+1@gmail.com"));
    // Elsewhere dots matter; only +tags go.
    expect(emailKey("budi.s+x@kantor.co.id")).toBe("budi.s@kantor.co.id");
    expect(emailKey("budi.s@kantor.co.id")).not.toBe(emailKey("budis@kantor.co.id"));
  });

  it("knows throwaway inboxes, subdomains too, and leaves real ones", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@YOPMAIL.com")).toBe(true);
    expect(isDisposableEmail("x@abc.guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("sari@gmail.com")).toBe(false);
    expect(isDisposableEmail("hr@telkom.co.id")).toBe(false);
  });

  it("wants a plain address", () => {
    expect(plausibleEmail("sari@gmail.com")).toBe(true);
    expect(plausibleEmail("sari@localhost")).toBe(false);
    expect(plausibleEmail("<b>@x.com")).toBe(false);
  });
});

describe("WhatsApp numbers", () => {
  it("takes Indonesian mobiles written the usual ways", () => {
    for (const n of ["0812 3456 7890", "081234567890", "+62 812-3456-7890", "6281234567890", "0857 1234 567", "+62 (812) 3456 7890"]) expect(isIndonesianMobile(n)).toBe(true);
  });
  it("refuses landlines, foreign, too short or too long, and letters", () => {
    for (const n of ["021 1234 5678", "+1 415 555 0100", "0812 345", "0812 3456 7890 1234", "08abc", "", "8123456789"]) expect(isIndonesianMobile(n)).toBe(false);
  });
});

describe("networks", () => {
  it("groups IPv4 by /24 and IPv6 by /64", () => {
    expect(ipBucket("36.71.12.200")).toBe("36.71.12.0/24");
    expect(ipBucket("::ffff:36.71.12.9")).toBe("36.71.12.0/24");
    expect(ipBucket("2001:db8:85a3:12::1")).toBe("2001:db8:85a3:12::/64");
    expect(ipBucket("2001:0db8:0000:0000:1:2:3:4")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("2001:db8::1")).toBe(ipBucket("2001:db8:0:0:ffff::9"));
  });
  it("spots tools that are not browsers", () => {
    expect(botUserAgent("")).toBe(true);
    expect(botUserAgent(null)).toBe(true);
    expect(botUserAgent("curl/8.4.0")).toBe(true);
    expect(botUserAgent("python-requests/2.31.0")).toBe(true);
    expect(botUserAgent("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0")).toBe(true);
    expect(botUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36")).toBe(false);
  });
});

describe("junk text", () => {
  const person = { fullName: "Sari Wulandari", city: "Kota Bandung" };
  const more = { institution: "Universitas Padjadjaran", major: "Teknik Informatika", skills: "Excel, Komunikasi", experience: "Magang 6 bulan di https://contoh.co.id" };
  it("lets a normal person through, a link in free text included", () => {
    expect(junkText(person, more)).toEqual([]);
    expect(junkText({ fullName: "Muhammad Al-Fatih", city: "Kab. Bogor" }, { institution: "Universitas 17 Agustus 1945" })).toEqual([]);
    expect(junkText({ fullName: "Ni Luh Putu Ayu", city: "Denpasar" }, { experience: "Ketua panitia........ seminar" })).toEqual([]);
  });
  it("refuses links, markup, digits, held keys, endless words and pasted text", () => {
    expect(junkText({ fullName: "Cheap pills www.spam.ru" })).toContain("link_in_name");
    expect(junkText({ fullName: "http://x.y" })).toContain("link_in_name");
    expect(junkText(person, { experience: "<a href=x>buy</a>" })).toContain("html");
    expect(junkText({ fullName: "123456" })).toContain("digits_name");
    expect(junkText({ fullName: "!!!???" })).toContain("no_letters");
    expect(junkText({ fullName: "aaaaaaaaaaaa" })).toContain("repeated_char");
    expect(junkText({ fullName: "x".repeat(3) + "y".repeat(3) + "z".repeat(40) })).toContain("long_word");
    expect(junkText({ fullName: "asdf qwer", city: "asdf qwer" }, { institution: "asdf qwer" })).toContain("repeated_text");
  });
});

describe("suspicion score", () => {
  const row = (id: string, email: string, signals: object = {}, names = { fullName: "Sari", city: "Bandung" }) => ({ id, email, signals, names, others: {} });
  it("leaves a normal sign-up unflagged", () => {
    const s = suspicion([row("a", "sari@gmail.com", { ib: "n1", ft: 140 })]).get("a")!;
    expect(s.score).toBeLessThan(SUSPECT_AT);
    expect(s.reasons).toEqual([]);
  });
  it("flags many from one network, very fast sending, the same inbox twice and throwaway email", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row(`n${i}`, `orang${i}@gmail.com`, { ib: "same", ft: 60 })),
      row("fast", "cepat@gmail.com", { ib: "x", ft: 4 }),
      row("d1", "s.ari@gmail.com"),
      row("d2", "sari+2@gmail.com"),
      row("tmp", "x@yopmail.com"),
      row("junk", "j@gmail.com", {}, { fullName: "Budi Budi", city: "Budi Budi" }),
    ];
    const s = suspicion(rows);
    expect(s.get("n0")!.reasons).toContain("same_network");
    expect(s.get("fast")!.score).toBeGreaterThanOrEqual(SUSPECT_AT);
    expect(s.get("d1")!.reasons).toContain("same_inbox");
    expect(s.get("d2")!.score).toBeGreaterThanOrEqual(SUSPECT_AT);
    expect(s.get("tmp")!.score).toBeGreaterThanOrEqual(SUSPECT_AT);
    expect(s.get("junk")!.reasons).toContain("junk_text");
  });
});

describe("proof of work", () => {
  it("counts leading zero bits", () => {
    expect(leadingZeroBits(new Uint8Array([0, 0x0f]))).toBe(12);
    expect(leadingZeroBits(new Uint8Array([0x80]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0, 0]))).toBe(16);
  });
  it("finds an answer the server's one hash accepts", async () => {
    const answer = await solvePow("tok", 10);
    expect(answer).not.toBeNull();
    expect(leadingZeroBits(createHash("sha256").update(`tok:${answer}`).digest())).toBeGreaterThanOrEqual(10);
    expect(await solvePow("tok", 0)).toBe("0");
  });
});
