// Numbered invoices for coin purchases. A gateway payment gets a paid invoice once it is confirmed;
// a bank transfer or termin starts as an issued invoice that the organiser marks paid instalment by
// instalment. The last confirmation hands over the coins, under an idempotency key, exactly once.
import { and, desc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { type BuyerInfo, type Instalment, type InvoiceLine, type InvoiceMethod, invoiceNumber, nextInstalment, type SellerInfo, taxSplit } from "@vwo/shared";
import type { Db } from "./client";
import { coinLedger, fairInvoices, fairPayments } from "./jobfair-schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type InvoiceRow = typeof fairInvoices.$inferSelect;

/** A proof of transfer the buyer sent: the bank's reference, and maybe a photo (kept apart, see files). */
export interface TransferProof {
  ref: string;
  note: string;
  at: number;
  image: boolean;
}

/** What an invoice's meta holds. Files (proof photos, the faktur pajak) live under `files` and are left out of lists. */
export interface InvoiceMeta {
  seller?: SellerInfo;
  rate?: number;
  instalments?: Instalment[];
  proofs?: TransferProof[];
  /** What is handed over once it is paid: coins into the buyer's ledger. */
  deliver?: { coins: number; pack: string };
  delivered?: boolean;
  confirmedBy?: string;
  taxFile?: { name: string; type: string };
  voidNote?: string;
}

export interface StoredFile {
  type: string;
  name: string;
  data: string;
}

/** Every column, with the stored files taken out of meta so lists stay small. */
const lean = {
  id: fairInvoices.id,
  number: fairInvoices.number,
  userId: fairInvoices.userId,
  boothKey: fairInvoices.boothKey,
  paymentId: fairInvoices.paymentId,
  buyer: fairInvoices.buyer,
  items: fairInvoices.items,
  subtotal: fairInvoices.subtotal,
  tax: fairInvoices.tax,
  total: fairInvoices.total,
  method: fairInvoices.method,
  status: fairInvoices.status,
  dueAt: fairInvoices.dueAt,
  paidAt: fairInvoices.paidAt,
  taxInvoiceNo: fairInvoices.taxInvoiceNo,
  meta: sql<unknown>`${fairInvoices.meta} - 'files'`.as("meta"),
  createdAt: fairInvoices.createdAt,
};

/** The next number from the sequence, for an invoice issued at `at`. */
export async function nextInvoiceNumber(db: Db | Tx, at = new Date()) {
  const rows = await db.execute<{ n: string }>(sql`select nextval('fair_invoice_seq')::text as n`);
  return invoiceNumber(Number(rows[0]!.n), at);
}

export interface NewInvoice {
  userId: string;
  boothKey?: string | null;
  paymentId?: string | null;
  buyer: BuyerInfo;
  seller: SellerInfo;
  items: InvoiceLine[];
  method: InvoiceMethod;
  /** Paid invoices (gateway) are issued already paid. */
  paidAt?: Date | null;
  instalments?: Instalment[];
  deliver?: InvoiceMeta["deliver"];
  delivered?: boolean;
}

async function insertInvoice(tx: Db | Tx, input: NewInvoice) {
  const now = new Date();
  const gross = input.items.reduce((n, i) => n + i.amount, 0);
  const t = taxSplit(gross, input.seller);
  const meta: InvoiceMeta = {
    seller: input.seller,
    rate: t.rate,
    ...(input.instalments ? { instalments: input.instalments } : {}),
    ...(input.deliver ? { deliver: input.deliver, delivered: !!input.delivered } : {}),
  };
  const [row] = await tx
    .insert(fairInvoices)
    .values({
      number: await nextInvoiceNumber(tx, now),
      userId: input.userId,
      boothKey: input.boothKey ?? null,
      paymentId: input.paymentId ?? null,
      buyer: input.buyer,
      items: input.items,
      subtotal: t.subtotal,
      tax: t.tax,
      total: t.total,
      method: input.method,
      status: input.paidAt ? "paid" : "issued",
      dueAt: input.instalments?.length ? new Date(input.instalments[0]!.dueAt) : null,
      paidAt: input.paidAt ?? null,
      meta,
    })
    .returning();
  return row!;
}

/** Issue an unpaid invoice (bank transfer or termin). */
export function createInvoice(db: Db, input: NewInvoice) {
  return insertInvoice(db, input);
}

/** The invoice of a gateway payment, issued once however many times this is called. */
export async function issuePaymentInvoice(db: Db, input: Omit<NewInvoice, "method" | "paidAt"> & { paymentId: string; paidAt: Date }) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"invoice-pay:" + input.paymentId}))`);
    const [have] = await tx.select(lean).from(fairInvoices).where(eq(fairInvoices.paymentId, input.paymentId));
    if (have) return { row: have, created: false };
    const row = await insertInvoice(tx, { ...input, method: "gateway" });
    return { row: { ...row, meta: stripFiles(row.meta) }, created: true };
  });
}

/** Paid gateway payments of this account (money, not coins) that have no invoice yet. */
export function paymentsWithoutInvoice(db: Db, userId: string) {
  return db
    .select()
    .from(fairPayments)
    .where(
      and(
        eq(fairPayments.userId, userId),
        eq(fairPayments.status, "paid"),
        inArray(fairPayments.provider, ["xendit", "demo"]),
        notExists(
          db
            .select({ one: sql`1` })
            .from(fairInvoices)
            .where(eq(fairInvoices.paymentId, fairPayments.id)),
        ),
      ),
    )
    .limit(20);
}

const stripFiles = (meta: unknown) => {
  const { files: _f, ...rest } = (meta ?? {}) as Record<string, unknown>;
  return rest;
};

/** One invoice, without its files. */
export async function invoiceById(db: Db, id: string) {
  const [row] = await db.select(lean).from(fairInvoices).where(eq(fairInvoices.id, id));
  return row ?? null;
}

/** One stored file of an invoice: "faktur", or "proof-<n>". */
export async function invoiceFile(db: Db, id: string, name: string) {
  const rows = await db.execute<{ f: StoredFile | null }>(sql`select ${fairInvoices.meta} -> 'files' -> ${name} as f from ${fairInvoices} where ${fairInvoices.id} = ${id}`);
  return rows[0]?.f ?? null;
}

/**
 * The invoices one page lists. A company portal (`{ booth }`) lists that booth's invoices whoever in
 * the booth bought them, and nothing else; the personal page lists the account's own invoices that
 * were not bought for a booth. The caller checks booth membership before asking for a booth.
 */
export function invoicesOf(db: Db, userId: string, scope: { booth: string } | "personal" = "personal") {
  return db
    .select(lean)
    .from(fairInvoices)
    .where(scope === "personal" ? and(eq(fairInvoices.userId, userId), isNull(fairInvoices.boothKey)) : eq(fairInvoices.boothKey, scope.booth))
    .orderBy(desc(fairInvoices.createdAt))
    .limit(100);
}

/** For the organiser: unpaid transfers and termins first, then the latest of the rest. */
export function invoicesForOrganiser(db: Db, status?: "issued" | "paid" | "void") {
  return db
    .select(lean)
    .from(fairInvoices)
    .where(status ? eq(fairInvoices.status, status) : undefined)
    .orderBy(sql`case when ${fairInvoices.status} = 'issued' then 0 else 1 end`, desc(fairInvoices.createdAt))
    .limit(200);
}

/** How many unpaid invoices an account has open, so one account can't pile them up. */
export async function openInvoiceCount(db: Db, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(fairInvoices)
    .where(and(eq(fairInvoices.userId, userId), eq(fairInvoices.status, "issued")));
  return row?.n ?? 0;
}

async function lockInvoice(tx: Tx, id: string) {
  const [row] = await tx.select().from(fairInvoices).where(eq(fairInvoices.id, id)).for("update");
  return row ?? null;
}

const MAX_PROOFS = 5;

/** The buyer says they transferred: a reference, maybe a photo. Only on an unpaid transfer or termin. */
export async function addTransferProof(db: Db, id: string, proof: { ref: string; note: string; image?: StoredFile | null }) {
  return db.transaction(async (tx) => {
    const row = await lockInvoice(tx, id);
    if (!row || row.status !== "issued" || row.method === "gateway") return "not_open" as const;
    const meta = row.meta as InvoiceMeta & { files?: Record<string, StoredFile> };
    const proofs = meta.proofs ?? [];
    if (proofs.length >= MAX_PROOFS) return "too_many" as const;
    const files = { ...(meta.files ?? {}) };
    if (proof.image) files[`proof-${proofs.length}`] = proof.image;
    const next = { ...meta, files, proofs: [...proofs, { ref: proof.ref, note: proof.note, at: Date.now(), image: !!proof.image }] };
    await tx.update(fairInvoices).set({ meta: next }).where(eq(fairInvoices.id, id));
    return "ok" as const;
  });
}

/**
 * The organiser saw instalment `index` arrive. When it was the last one the invoice is paid and its
 * coins go into the buyer's ledger, keyed to the invoice, so they are handed over exactly once.
 * Returns null when there was nothing to confirm (already paid, void, or that instalment is done).
 */
export async function confirmInvoicePayment(db: Db, input: { id: string; index: number; by: string; at?: Date }) {
  return db.transaction(async (tx) => {
    const row = await lockInvoice(tx, input.id);
    if (!row || row.status !== "issued" || row.method === "gateway") return null;
    const meta = row.meta as InvoiceMeta;
    const plan = [...(meta.instalments ?? [])];
    const step = plan[input.index];
    if (!step || step.paidAt) return null;
    const at = input.at ?? new Date();
    plan[input.index] = { ...step, paidAt: at.getTime() };
    const done = nextInstalment(plan) === -1;
    let delivered = false;
    if (done && meta.deliver && meta.deliver.coins > 0) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"coins:" + row.userId}))`);
      const got = await tx
        .insert(coinLedger)
        .values({ userId: row.userId, delta: meta.deliver.coins, reason: `Pembelian koin ${row.number}`, refId: row.id, idempotencyKey: `invoice:${row.id}` })
        .onConflictDoNothing({ target: coinLedger.idempotencyKey })
        .returning({ id: coinLedger.id });
      delivered = got.length > 0;
    }
    const next = { ...meta, instalments: plan, confirmedBy: input.by, ...(done ? { delivered: delivered || !!meta.delivered } : {}) };
    const left = plan.find((p) => !p.paidAt);
    const [out] = await tx
      .update(fairInvoices)
      .set({ meta: next, status: done ? "paid" : "issued", paidAt: done ? at : null, dueAt: left ? new Date(left.dueAt) : row.dueAt })
      .where(and(eq(fairInvoices.id, input.id), eq(fairInvoices.status, "issued")))
      .returning(lean);
    return out ? { invoice: out, paid: done, delivered } : null;
  });
}

/** The organiser records the faktur pajak number, and may attach its PDF for the buyer to download. */
export async function setTaxInvoice(db: Db, id: string, input: { number: string; file?: StoredFile | null }) {
  return db.transaction(async (tx) => {
    const row = await lockInvoice(tx, id);
    if (!row || row.status === "void") return null;
    const meta = row.meta as InvoiceMeta & { files?: Record<string, StoredFile> };
    const files = { ...(meta.files ?? {}) };
    let taxFile = meta.taxFile;
    if (input.file) {
      files.faktur = input.file;
      taxFile = { name: input.file.name, type: input.file.type };
    }
    const [out] = await tx
      .update(fairInvoices)
      .set({ taxInvoiceNo: input.number, meta: { ...meta, files, ...(taxFile ? { taxFile } : {}) } })
      .where(eq(fairInvoices.id, id))
      .returning(lean);
    return out ?? null;
  });
}

/** Cancel an unpaid invoice nothing has been paid on yet. */
export async function voidInvoice(db: Db, id: string, note: string) {
  return db.transaction(async (tx) => {
    const row = await lockInvoice(tx, id);
    if (!row || row.status !== "issued") return null;
    const meta = row.meta as InvoiceMeta;
    if ((meta.instalments ?? []).some((p) => p.paidAt)) return null;
    const [out] = await tx
      .update(fairInvoices)
      .set({ status: "void", meta: { ...meta, voidNote: note } })
      .where(eq(fairInvoices.id, id))
      .returning(lean);
    return out ?? null;
  });
}

/** Where the organiser's seller details live in fair_state: a private key the public setup read skips. */
export const SELLER_KEY = "billing:seller";
/** Where an account's buyer details live, so they are entered once. */
export const buyerKey = (userId: string) => `billing:buyer:${userId}`;
