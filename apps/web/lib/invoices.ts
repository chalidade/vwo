import "server-only";
import {
  buyerKey,
  type InvoiceMeta,
  type InvoiceRow,
  invoiceById,
  isBoothMember,
  issuePaymentInvoice,
  type Payment,
  paymentsWithoutInvoice,
  readFairStateKey,
  SELLER_KEY,
} from "@vwo/db";
import { type BuyerInfo, cleanBuyer, EMPTY_BUYER, type InvoiceLine, sellerOf } from "@vwo/shared";
import { db } from "./db";
import { isOwnerAdmin } from "./fair";

type User = { id: string; email: string; name: string; role: string };

/** The organiser's seller details as saved (empty fields until set). */
export async function readSeller() {
  return sellerOf((await readFairStateKey(db, SELLER_KEY))?.data);
}

/** The buyer details this account saved, or null when it never did. */
export async function readBuyer(userId: string): Promise<BuyerInfo | null> {
  const got = cleanBuyer((await readFairStateKey(db, buyerKey(userId)))?.data);
  return "buyer" in got ? got.buyer : null;
}

/** Who a gateway invoice is made out to when the account saved no details: its own name and email. */
export const defaultBuyer = (user: { name: string; email: string }): BuyerInfo => ({ ...EMPTY_BUYER, name: user.name.slice(0, 120), email: user.email.slice(0, 160) });

/** The buyer a payment carries (saved when it started), checked again. */
function buyerOfPayment(p: Payment): BuyerInfo | null {
  const got = cleanBuyer((p.meta as { buyer?: unknown }).buyer);
  if ("buyer" in got) return got.buyer;
  // Accounts without saved details have no address yet; the name and email still make a valid invoice.
  const b = (p.meta as { buyer?: Partial<BuyerInfo> }).buyer;
  return b && typeof b.name === "string" && typeof b.email === "string" ? defaultBuyer({ name: b.name, email: b.email }) : null;
}

const linesOf = (p: Payment): InvoiceLine[] => [{ name: p.description.slice(0, 160), qty: 1, unit: p.amount, amount: p.amount }];

/** The paid invoice of a confirmed gateway payment (money, not coins). Issued once; errors never block delivery. */
export async function invoiceForPayment(p: Payment, fallback?: BuyerInfo) {
  if (p.status !== "paid" || p.provider === "koin" || p.amount <= 0) return null;
  const buyer = buyerOfPayment(p) ?? fallback;
  if (!buyer) return null;
  const booth = (p.meta as { booth?: unknown }).booth;
  return issuePaymentInvoice(db, {
    paymentId: p.id,
    paidAt: p.paidAt ?? new Date(),
    userId: p.userId,
    boothKey: typeof booth === "string" ? booth : null,
    buyer,
    seller: await readSeller(),
    items: linesOf(p),
    deliver: { coins: Number((p.meta as { coins?: unknown }).coins) || 0, pack: p.ref },
    delivered: true,
  });
}

/** Paid gateway payments that somehow have no invoice yet get one now. */
export async function backfillInvoices(user: User) {
  const rows = await paymentsWithoutInvoice(db, user.id);
  if (!rows.length) return;
  const fallback = (await readBuyer(user.id)) ?? defaultBuyer(user);
  for (const p of rows) await invoiceForPayment(p, fallback).catch((e) => console.error("invoice backfill", p.id, e));
}

/** The buyer, the booth accounts it was bought for, and the event's own admins may see an invoice. */
export async function canSeeInvoice(user: User | null, row: Pick<InvoiceRow, "userId" | "boothKey">) {
  if (!user) return false;
  if (row.userId === user.id || isOwnerAdmin(user)) return true;
  return !!row.boothKey && (await isBoothMember(db, user.id, row.boothKey));
}

export async function visibleInvoice(user: User | null, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await invoiceById(db, id);
  return row && (await canSeeInvoice(user, row)) ? row : null;
}

/** What a page shows of an invoice: never the stored files themselves, only that they exist. */
export function invoiceOut(row: InvoiceRow) {
  const meta = (row.meta ?? {}) as InvoiceMeta;
  return {
    id: row.id,
    number: row.number,
    boothKey: row.boothKey,
    buyer: row.buyer as BuyerInfo,
    seller: meta.seller ?? null,
    items: row.items as InvoiceLine[],
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    rate: meta.rate ?? 0,
    method: row.method,
    status: row.status,
    dueAt: row.dueAt?.getTime() ?? null,
    paidAt: row.paidAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
    taxInvoiceNo: row.taxInvoiceNo,
    taxFile: !!meta.taxFile,
    instalments: meta.instalments ?? [],
    proofs: (meta.proofs ?? []).map((p, i) => ({ ...p, file: p.image ? `proof-${i}` : null })),
    coins: meta.deliver?.coins ?? 0,
    delivered: !!meta.delivered,
    voidNote: meta.voidNote ?? null,
  };
}

export type InvoiceOut = ReturnType<typeof invoiceOut>;

/** A data: URL of an allowed type within `max` bytes, as a stored file; null when it is not one. */
export function fileFromDataUrl(input: { name: string; data: string }, types: string[], max: number) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data);
  if (!m || !types.includes(m[1]!)) return null;
  const bytes = Math.floor((m[2]!.length * 3) / 4);
  if (bytes > max) return null;
  // The first bytes must match the type the browser named, so a script can't pose as a picture.
  const head = Buffer.from(m[2]!.slice(0, 16), "base64");
  const ok =
    (m[1] === "application/pdf" && head.subarray(0, 4).toString("latin1") === "%PDF") ||
    (m[1] === "image/jpeg" && head[0] === 0xff && head[1] === 0xd8) ||
    (m[1] === "image/png" && head.subarray(1, 4).toString("latin1") === "PNG");
  if (!ok) return null;
  return { type: m[1]!, name: input.name.replace(/[^\w.\- ]/g, "_").slice(0, 80) || "file", data: input.data };
}
