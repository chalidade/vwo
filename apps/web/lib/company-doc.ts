import "server-only";
import { type Payment, paidInvoicesOf, readFairState, readPrices, writeFairState } from "@vwo/db";
import { ACCESSORY_DEFAULTS, priceFrom } from "@vwo/shared";
import { db } from "./db";

/** What a company can buy for its booth, by the id the game uses. */
export const PRODUCT_IDS = new Set(["vip", "promoter", ...ACCESSORY_DEFAULTS.map((a) => a.id)]);
/** VIP booths get these without buying them. */
const VIP_INCLUDED = ["gapura"];

type Item = { id: string; name: string; price: number };
type Invoice = { id: string; status?: string; items?: Item[]; method?: string; paidAt?: number; [k: string]: unknown };
type Doc = { edits?: Record<string, unknown>; owned?: string[]; invoices?: Invoice[]; [k: string]: unknown };

const invoiceIdOf = (p: Payment) => p.ref.slice(p.ref.indexOf(":") + 1);
const itemsOf = (p: Payment) => ((p.meta as { items?: Item[] }).items ?? []).map((i) => i.id);

export async function companyDoc(boothId: string): Promise<Doc | null> {
  const row = (await readFairState(db)).find((r) => r.key === `company:${boothId}`);
  return (row?.data as Doc) ?? null;
}

/** The booth's paid invoice: Lunas, with what it bought owned and switched on. */
function applyPaid(doc: Doc, p: Payment) {
  const inv = doc.invoices?.find((i) => i.id === invoiceIdOf(p));
  if (inv && inv.status !== "Lunas") Object.assign(inv, { status: "Lunas", method: p.method ?? "Xendit", paidAt: (p.paidAt ?? new Date()).getTime() });
  const owned = new Set(doc.owned ?? []);
  const on = new Set((doc.edits?.accessories as string[] | undefined) ?? []);
  for (const id of itemsOf(p)) {
    if (!owned.has(id)) {
      owned.add(id);
      if (id !== "vip" && id !== "promoter") on.add(id);
    }
  }
  doc.owned = [...owned];
  if (on.size) doc.edits = { ...doc.edits, accessories: [...on] };
}

/** After a gateway payment: record it on the company's booth so every device sees it at once. */
export async function settleInvoice(p: Payment, userId: string) {
  const booth = p.ref.slice(0, p.ref.indexOf(":"));
  const doc = (await companyDoc(booth)) ?? { edits: {}, owned: [], invoices: [] };
  applyPaid(doc, p);
  await writeFairState(db, { key: `company:${booth}`, data: doc, userId });
}

/**
 * A company account saves its booth. The browser may not mark bills paid, own products, switch
 * on decorations or raise its tier by itself: only payments the gateway confirmed count.
 */
export async function guardCompanyDoc(boothId: string, incoming: Doc): Promise<Doc> {
  const [stored, paid, prices] = await Promise.all([companyDoc(boothId), paidInvoicesOf(db, boothId), readPrices(db)]);
  const before = new Map((stored?.invoices ?? []).map((i) => [i.id, i]));
  const doc: Doc = { ...incoming, edits: { ...(incoming.edits ?? {}) } };

  doc.invoices = (Array.isArray(incoming.invoices) ? incoming.invoices : []).map((inv) => {
    const was = before.get(inv.id);
    if (inv.status === "Lunas" && was?.status !== "Lunas") return { ...inv, status: "Belum dibayar", method: undefined, paidAt: undefined };
    if (was?.status === "Lunas") return was;
    return inv;
  });

  const allowed = new Set(stored?.owned ?? []);
  doc.owned = (Array.isArray(incoming.owned) ? incoming.owned : []).filter((id) => typeof id === "string" && allowed.has(id));
  const tier = (stored?.edits ?? {}).tier;
  if (tier === undefined) delete doc.edits!.tier;
  else doc.edits!.tier = tier;

  for (const p of paid) applyPaid(doc, p);

  const vip = doc.owned.includes("vip") || doc.edits!.tier === "premium";
  const owned = new Set(doc.owned);
  if (Array.isArray(doc.edits!.accessories)) {
    doc.edits!.accessories = (doc.edits!.accessories as unknown[]).filter(
      (id): id is string => typeof id === "string" && (owned.has(id) || priceFrom(prices, `product.${id}`) === 0 || (vip && VIP_INCLUDED.includes(id))),
    );
  }
  return doc;
}
