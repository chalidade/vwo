import { describe, expect, it } from "vitest";
import { REGIONS, canonicalSkill, parseSkills, placeName, provinceOf, searchRegions, searchSkills } from "@vwo/shared";

describe("skills list", () => {
  it("reads old free-typed skills as list spellings, without repeats", () => {
    expect(parseSkills("excel, MS Excel, react , Desain grafis;  bikin kue")).toEqual(["Microsoft Excel", "React", "Desain grafis", "bikin kue"]);
    expect(canonicalSkill("  typescript ")).toBe("TypeScript");
    expect(canonicalSkill("bikin kue")).toBeNull();
  });

  it("suggests skills by prefix and alias, leaving out chosen ones", () => {
    expect(searchSkills("excel")[0]).toBe("Microsoft Excel");
    expect(searchSkills("rea", ["React"])).not.toContain("React");
  });
});

describe("places", () => {
  it("has every kabupaten and kota of 38 provinces", () => {
    expect(REGIONS).toHaveLength(38);
    expect(REGIONS.reduce((n, [, l]) => n + l.length, 0)).toBe(514);
  });

  it("finds the city before the regency of the same name", () => {
    const hits = searchRegions("bandung").map((h) => h.region);
    expect(hits[0]).toBe("Kota Bandung");
    expect(hits).toContain("Kab. Bandung");
    expect(provinceOf("Kota Surabaya")).toBe("Jawa Timur");
    expect(placeName("Kota Jakarta Selatan")).toBe("Jakarta Selatan");
  });
});
