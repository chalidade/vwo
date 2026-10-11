import { describe, expect, it } from "vitest";
import { cleanBuyer, cleanNpwp, cleanSeller, instalmentPlan, invoiceNumber, nextInstalment, npwpText, sellerOf, taxSplit } from "../src";

describe("invoice number", () => {
  it("is INV/YYYY/MM/NNNNNN in Jakarta time", () => {
    expect(invoiceNumber(42, new Date("2026-10-11T03:00:00Z"))).toBe("INV/2026/10/000042");
    // 31 Oct 20:00 UTC is already 1 November in Jakarta.
    expect(invoiceNumber(7, new Date("2026-10-31T20:00:00Z"))).toBe("INV/2026/11/000007");
    expect(invoiceNumber(1_234_567, new Date("2026-01-01T00:00:00Z"))).toBe("INV/2026/01/1234567");
  });

  it("refuses a sequence that is not a positive whole number", () => {
    expect(() => invoiceNumber(0, new Date())).toThrow();
    expect(() => invoiceNumber(1.5, new Date())).toThrow();
  });
});

describe("tax split", () => {
  it("adds no tax for a seller that is not PKP", () => {
    expect(taxSplit(1_000_000, { pkp: false, ppnRate: 11 })).toEqual({ subtotal: 1_000_000, tax: 0, total: 1_000_000, rate: 0 });
    expect(taxSplit(1_000_000, null)).toEqual({ subtotal: 1_000_000, tax: 0, total: 1_000_000, rate: 0 });
  });

  it("takes PPN out of a price that includes it, and keeps the total", () => {
    expect(taxSplit(1_110_000, { pkp: true, ppnRate: 11 })).toEqual({ subtotal: 1_000_000, tax: 110_000, total: 1_110_000, rate: 11 });
    const odd = taxSplit(45_000, { pkp: true, ppnRate: 11 });
    expect(odd.subtotal).toBe(40_541);
    expect(odd.subtotal + odd.tax).toBe(45_000);
    expect(taxSplit(16_000_000, { pkp: true, ppnRate: 12 }).tax).toBe(1_714_286);
  });
});

describe("instalments", () => {
  it("splits a termin into whole rupiah that add up, a month apart", () => {
    const from = new Date("2026-10-11T00:00:00Z");
    const plan = instalmentPlan(4_000_001, 3, from);
    expect(plan.map((p) => p.amount)).toEqual([1_333_333, 1_333_333, 1_333_335]);
    expect(plan.reduce((n, p) => n + p.amount, 0)).toBe(4_000_001);
    expect(plan.map((p) => (p.dueAt - from.getTime()) / 86_400_000)).toEqual([7, 37, 67]);
    expect(instalmentPlan(1_000_000, 9, from)).toHaveLength(3);
    expect(
      nextInstalment([
        { amount: 1, dueAt: 0, paidAt: 1 },
        { amount: 1, dueAt: 0 },
      ]),
    ).toBe(1);
    expect(nextInstalment([{ amount: 1, dueAt: 0, paidAt: 1 }])).toBe(-1);
  });
});

describe("buyer and seller details", () => {
  it("accepts 15 or 16 digit NPWP, or none", () => {
    expect(cleanNpwp("01.234.567.8-901.000")).toBe("012345678901000");
    expect(cleanNpwp("3171234567890001")).toBe("3171234567890001");
    expect(cleanNpwp("")).toBe("");
    expect(cleanNpwp("12345")).toBeNull();
    expect(npwpText("012345678901000")).toBe("01.234.567.8-901.000");
  });

  it("needs a name, an address and an email, trimmed to size", () => {
    expect(cleanBuyer({ name: "PT Maju", address: "Jl. Sudirman 1, Jakarta", email: "Keu@Maju.co.id" })).toEqual({
      buyer: { name: "PT Maju", npwp: "", address: "Jl. Sudirman 1, Jakarta", email: "keu@maju.co.id", contact: "" },
    });
    expect(cleanBuyer({ name: "PT Maju", address: "Jl. Sudirman", email: "nope" })).toEqual({ error: "email" });
    expect(cleanBuyer({ name: "PT Maju", address: "Jl. Sudirman", email: "a@b.co", npwp: "123" })).toEqual({ error: "npwp" });
    const long = cleanBuyer({ name: "x".repeat(500), address: "Jl. Sudirman", email: "a@b.co" });
    expect("buyer" in long && long.buyer.name.length).toBe(120);
  });

  it("defaults the PPN rate to 11% and keeps the rate in range", () => {
    expect(sellerOf(null).ppnRate).toBe(11);
    expect(sellerOf({ pkp: true }).ppnRate).toBe(11);
    expect(cleanSeller({ ppnRate: 900 })!.ppnRate).toBe(50);
    expect(cleanSeller({ npwp: "bad" })).toBeNull();
  });
});
