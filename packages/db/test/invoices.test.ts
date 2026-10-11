import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMPTY_SELLER, instalmentPlan, INVOICE_NO, type SellerInfo } from "@vwo/shared";
import {
  addTransferProof,
  buyerKey,
  coinBalance,
  confirmInvoicePayment,
  createDb,
  createInvoice,
  createPayment,
  invoiceById,
  invoiceFile,
  invoicesOf,
  issuePaymentInvoice,
  markPaid,
  paymentsWithoutInvoice,
  readFairState,
  register,
  SELLER_KEY,
  setTaxInvoice,
  voidInvoice,
  writeFairState,
} from "../src";

const url = process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test";
const { db, close } = createDb(url);
let buyerId = "";
let adminId = "";

const seller: SellerInfo = { ...EMPTY_SELLER, name: "PT Panitia", address: "Jakarta", pkp: true, ppnRate: 11, bank: { name: "BCA", account: "123", holder: "PT Panitia" } };
const buyer = { name: "PT Maju", npwp: "", address: "Jl. Sudirman 1", email: "keu@maju.example", contact: "" };
const pack = (amount: number) => [{ name: "20.000 koin + 1.000 bonus", qty: 1, unit: amount, amount }];

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  buyerId = (await register(db, { email: "maju@mail.example", password: "rahasia123", name: "Maju" })).userId;
  adminId = (await register(db, { email: "panitia@mail.example", password: "rahasia123", name: "Panitia" })).userId;
});

afterAll(async () => {
  await close();
});

describe("invoice numbers", () => {
  it("come from the sequence, one apart, never repeated", async () => {
    const a = await createInvoice(db, { userId: buyerId, buyer, seller, items: pack(1_000_000), method: "transfer", instalments: instalmentPlan(1_000_000, 1, new Date()) });
    const b = await createInvoice(db, { userId: buyerId, buyer, seller, items: pack(1_000_000), method: "transfer", instalments: instalmentPlan(1_000_000, 1, new Date()) });
    expect(a.number).toMatch(INVOICE_NO);
    expect(Number(b.number.slice(-6))).toBe(Number(a.number.slice(-6)) + 1);
    const many = await Promise.all(
      Array.from({ length: 10 }, () => createInvoice(db, { userId: buyerId, buyer, seller, items: pack(10), method: "transfer", instalments: instalmentPlan(10, 1, new Date()) })),
    );
    expect(new Set(many.map((i) => i.number)).size).toBe(10);
  });

  it("splits PPN out of the server price when the seller is PKP", async () => {
    const inv = await createInvoice(db, { userId: buyerId, buyer, seller, items: pack(1_110_000), method: "transfer", instalments: instalmentPlan(1_110_000, 1, new Date()) });
    expect([inv.subtotal, inv.tax, inv.total]).toEqual([1_000_000, 110_000, 1_110_000]);
    const plain = await createInvoice(db, {
      userId: buyerId,
      buyer,
      seller: { ...seller, pkp: false },
      items: pack(1_110_000),
      method: "transfer",
      instalments: instalmentPlan(1_110_000, 1, new Date()),
    });
    expect([plain.subtotal, plain.tax, plain.total]).toEqual([1_110_000, 0, 1_110_000]);
  });
});

describe("paying an invoice", () => {
  it("hands over the coins exactly once, after the last instalment", async () => {
    const inv = await createInvoice(db, {
      userId: buyerId,
      buyer,
      seller,
      items: pack(4_000_000),
      method: "termin",
      instalments: instalmentPlan(4_000_000, 2, new Date()),
      deliver: { coins: 21_000, pack: "bisnis-20rb" },
    });
    const before = await coinBalance(db, buyerId);
    const first = await confirmInvoicePayment(db, { id: inv.id, index: 0, by: adminId });
    expect(first?.paid).toBe(false);
    expect(await coinBalance(db, buyerId)).toBe(before);
    // The same instalment twice does nothing.
    expect(await confirmInvoicePayment(db, { id: inv.id, index: 0, by: adminId })).toBeNull();
    // Two organisers confirming the last instalment at the same moment: one wins.
    const both = await Promise.all([confirmInvoicePayment(db, { id: inv.id, index: 1, by: adminId }), confirmInvoicePayment(db, { id: inv.id, index: 1, by: adminId })]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(both.find(Boolean)!.delivered).toBe(true);
    expect(await coinBalance(db, buyerId)).toBe(before + 21_000);
    const now = await invoiceById(db, inv.id);
    expect(now?.status).toBe("paid");
    expect(now?.paidAt).toBeTruthy();
    expect(await confirmInvoicePayment(db, { id: inv.id, index: 1, by: adminId })).toBeNull();
    expect(await coinBalance(db, buyerId)).toBe(before + 21_000);
  });

  it("takes transfer proofs only while unpaid, and keeps photos out of lists", async () => {
    const inv = await createInvoice(db, {
      userId: buyerId,
      buyer,
      seller,
      items: pack(1_000),
      method: "transfer",
      instalments: instalmentPlan(1_000, 1, new Date()),
      deliver: { coins: 5, pack: "x" },
    });
    expect(await addTransferProof(db, inv.id, { ref: "TRF123", note: "", image: { type: "image/jpeg", name: "bukti.jpg", data: "data:image/jpeg;base64,AAAA" } })).toBe("ok");
    const listed = (await invoicesOf(db, buyerId)).find((i) => i.id === inv.id)!;
    expect(JSON.stringify(listed.meta)).not.toContain("base64");
    expect((listed.meta as { proofs: unknown[] }).proofs).toHaveLength(1);
    expect((await invoiceFile(db, inv.id, "proof-0"))?.name).toBe("bukti.jpg");
    await confirmInvoicePayment(db, { id: inv.id, index: 0, by: adminId });
    expect(await addTransferProof(db, inv.id, { ref: "late", note: "" })).toBe("not_open");
    expect(await voidInvoice(db, inv.id, "x")).toBeNull();
  });

  it("records the faktur pajak, and voids only untouched invoices", async () => {
    const inv = await createInvoice(db, { userId: buyerId, buyer, seller, items: pack(1_000), method: "transfer", instalments: instalmentPlan(1_000, 1, new Date()) });
    const taxed = await setTaxInvoice(db, inv.id, {
      number: "010.000-26.00000001",
      file: { type: "application/pdf", name: "faktur.pdf", data: "data:application/pdf;base64,JVBE" },
    });
    expect(taxed?.taxInvoiceNo).toBe("010.000-26.00000001");
    expect((await invoiceFile(db, inv.id, "faktur"))?.type).toBe("application/pdf");
    expect((await voidInvoice(db, inv.id, "batal"))?.status).toBe("void");
    expect(await confirmInvoicePayment(db, { id: inv.id, index: 0, by: adminId })).toBeNull();
  });

  it("issues one invoice per gateway payment, however often it is asked", async () => {
    const p = await createPayment(db, {
      userId: buyerId,
      kind: "coins",
      ref: "bisnis-5rb",
      description: "5.000 koin",
      amount: 1_000_000,
      meta: { coins: 5_000 },
      provider: "demo",
    });
    await markPaid(db, p.id, "Simulasi");
    expect((await paymentsWithoutInvoice(db, buyerId)).map((r) => r.id)).toEqual([p.id]);
    const runs = await Promise.all([1, 2, 3].map(() => issuePaymentInvoice(db, { paymentId: p.id, paidAt: new Date(), userId: buyerId, buyer, seller, items: pack(1_000_000) })));
    expect(runs.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(runs.map((r) => r.row.number)).size).toBe(1);
    expect(runs[0]!.row.status).toBe("paid");
    expect(await paymentsWithoutInvoice(db, buyerId)).toEqual([]);
  });
});

describe("billing state", () => {
  it("stays out of the public setup read", async () => {
    await writeFairState(db, { key: SELLER_KEY, data: { ...seller, npwp: "012345678901000" }, userId: adminId });
    await writeFairState(db, { key: buyerKey(buyerId), data: buyer, userId: buyerId });
    await writeFairState(db, { key: "org", data: { name: "Fair" }, userId: adminId });
    const keys = (await readFairState(db)).map((r) => r.key);
    expect(keys).toContain("org");
    expect(keys.some((k) => k.startsWith("billing:"))).toBe(false);
  });
});
