// Official bills for coin purchases: the invoice number, who sells and who buys, the tax split, and
// the instalment plan for bank transfer or termin. Pure logic, shared by the server and the pages.

/** How an invoice gets paid: through the gateway, one bank transfer, or instalments. */
export type InvoiceMethod = "gateway" | "transfer" | "termin";
export type InvoiceStatus = "issued" | "paid" | "void";

/** The organiser as the seller on every invoice. Set in the organiser's settings, never by the browser of a buyer. */
export interface SellerInfo {
  name: string;
  address: string;
  npwp: string;
  email: string;
  phone: string;
  /** Pengusaha Kena Pajak: invoices then show DPP and PPN, and get a faktur pajak. */
  pkp: boolean;
  /** PPN in percent, 11 by default. */
  ppnRate: number;
  bank: { name: string; account: string; holder: string };
}

/** Who is billed: a company or an agency, entered once and remembered for the next invoice. */
export interface BuyerInfo {
  name: string;
  npwp: string;
  address: string;
  email: string;
  contact: string;
}

export interface InvoiceLine {
  name: string;
  qty: number;
  unit: number;
  amount: number;
}

export interface Instalment {
  amount: number;
  dueAt: number;
  paidAt?: number;
}

export const DEFAULT_PPN = 11;

export const EMPTY_SELLER: SellerInfo = { name: "", address: "", npwp: "", email: "", phone: "", pkp: false, ppnRate: DEFAULT_PPN, bank: { name: "", account: "", holder: "" } };
export const EMPTY_BUYER: BuyerInfo = { name: "", npwp: "", address: "", email: "", contact: "" };

/** Days a buyer has to pay a transfer, and to pay the first instalment of a termin. */
export const TRANSFER_DAYS = 7;
/** Days between instalments. */
export const TERMIN_GAP_DAYS = 30;
/** How many instalments a termin may have. */
export const TERMIN_COUNTS = [2, 3] as const;

const DAY = 86_400_000;

/** The month in Jakarta (WIB, UTC+7), which is where the invoice is issued. */
function jakarta(at: Date) {
  const d = new Date(at.getTime() + 7 * 3_600_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** INV/2026/10/000042: the year and month it was issued, then the running number. */
export function invoiceNumber(seq: number, at: Date) {
  if (!Number.isInteger(seq) || seq < 1) throw new RangeError("invoice sequence must be a positive integer");
  const { year, month } = jakarta(at);
  return `INV/${year}/${String(month).padStart(2, "0")}/${String(seq).padStart(6, "0")}`;
}

export const INVOICE_NO = /^INV\/\d{4}\/\d{2}\/\d{6,}$/;

/**
 * Split a price into DPP and PPN. Prices in the price table already include PPN (the gateway charges
 * the listed price), so a PKP seller's total stays the same and the tax is taken out of it.
 */
export function taxSplit(total: number, seller: Pick<SellerInfo, "pkp" | "ppnRate"> | null | undefined) {
  const t = Math.max(0, Math.round(total));
  const rate = seller?.pkp ? cleanRate(seller.ppnRate) : 0;
  if (!rate) return { subtotal: t, tax: 0, total: t, rate: 0 };
  const subtotal = Math.round((t * 100) / (100 + rate));
  return { subtotal, tax: t - subtotal, total: t, rate };
}

function cleanRate(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(50, Math.round(n * 100) / 100)) : DEFAULT_PPN;
}

/**
 * When and how much to pay: one transfer due in a week, or 2–3 instalments a month apart. Amounts are
 * whole rupiah and add up to the total exactly; the last one takes the remainder.
 */
export function instalmentPlan(total: number, count: number, from: Date): Instalment[] {
  const n = Math.max(1, Math.min(3, Math.floor(count)));
  const each = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    amount: i === n - 1 ? total - each * (n - 1) : each,
    dueAt: from.getTime() + (TRANSFER_DAYS + i * TERMIN_GAP_DAYS) * DAY,
  }));
}

/** The first instalment not yet paid, or null when everything is paid. */
export const nextInstalment = (plan: Instalment[]) => plan.findIndex((p) => !p.paidAt);

/** NPWP as digits: 15 (old) or 16 (NIK-based) digits; anything else is not an NPWP. Empty is fine. */
export function cleanNpwp(input: unknown): string | null {
  if (typeof input !== "string") return "";
  const digits = input.replace(/[\s.\-]/g, "");
  if (!digits) return "";
  return /^\d{15,16}$/.test(digits) ? digits : null;
}

/** 01.234.567.8-901.000 for the old 15 digits; the 16-digit form is shown as is. */
export function npwpText(npwp: string) {
  if (!/^\d{15}$/.test(npwp)) return npwp;
  return `${npwp.slice(0, 2)}.${npwp.slice(2, 5)}.${npwp.slice(5, 8)}.${npwp.slice(8, 9)}-${npwp.slice(9, 12)}.${npwp.slice(12)}`;
}

const str = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .trim()
        .slice(0, max)
    : "";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A buyer from the browser, trimmed to size. Returns the reason when it can't be used on an invoice. */
export function cleanBuyer(input: unknown): { buyer: BuyerInfo } | { error: "name" | "address" | "email" | "npwp" } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const npwp = cleanNpwp(o.npwp);
  const buyer: BuyerInfo = { name: str(o.name, 120), npwp: npwp ?? "", address: str(o.address, 300), email: str(o.email, 160).toLowerCase(), contact: str(o.contact, 120) };
  if (buyer.name.length < 2) return { error: "name" };
  if (buyer.address.length < 5) return { error: "address" };
  if (!EMAIL.test(buyer.email)) return { error: "email" };
  if (npwp === null) return { error: "npwp" };
  return { buyer };
}

/** The organiser's seller details from a form, trimmed to size. Bank and NPWP may stay empty until known. */
export function cleanSeller(input: unknown): SellerInfo | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const bank = (o.bank && typeof o.bank === "object" ? o.bank : {}) as Record<string, unknown>;
  const npwp = cleanNpwp(o.npwp);
  if (npwp === null) return null;
  return {
    name: str(o.name, 120),
    address: str(o.address, 300),
    npwp,
    email: str(o.email, 160),
    phone: str(o.phone, 40),
    pkp: o.pkp === true,
    ppnRate: cleanRate(o.ppnRate ?? DEFAULT_PPN),
    bank: { name: str(bank.name, 60), account: str(bank.account, 40).replace(/[^\d\- ]/g, ""), holder: str(bank.holder, 120) },
  };
}

/** A stored seller document, with defaults for anything missing. */
export const sellerOf = (data: unknown): SellerInfo => (data && typeof data === "object" ? (cleanSeller({ ...EMPTY_SELLER, ...(data as object) }) ?? EMPTY_SELLER) : EMPTY_SELLER);

/** Bank transfer and termin need somewhere to send the money. */
export const sellerTakesTransfer = (s: SellerInfo) => !!(s.name && s.bank.name && s.bank.account && s.bank.holder);
