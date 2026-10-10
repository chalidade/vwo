import "server-only";
import { attachCheckout, createPayment, grantCoins, markClosed, markPaid, openPayment, type Payment, type PaymentKind, payRegistration, paymentById } from "@vwo/db";
import { db } from "./db";
import { settleInvoice } from "./company-doc";
import { createXenditInvoice, getXenditInvoice, methodName, xenditEnabled } from "./xendit";

export const provider = () => (xenditEnabled() ? "xendit" : "demo");

/** The site's own address as the browser sees it; the checkout page sends the buyer back here. */
export function siteOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export type Purchase = { kind: PaymentKind; ref: string; description: string; amount: number; meta?: Record<string, unknown>; back: string };

/**
 * Start paying for something whose price the server already worked out. With Xendit the buyer gets
 * a checkout link; without it (local and demo setups) the payment counts as paid straight away.
 */
export async function startPayment(req: Request, user: { id: string; email: string }, p: Purchase): Promise<Payment> {
  const reuse = await openPayment(db, user.id, p.kind, p.ref, p.amount);
  if (reuse?.checkoutUrl) return reuse;
  const row = reuse ?? (await createPayment(db, { userId: user.id, kind: p.kind, ref: p.ref, description: p.description, amount: p.amount, meta: p.meta, provider: provider() }));
  if (row.provider !== "xendit") {
    const paid = await markPaid(db, row.id, "Simulasi (tanpa uang)");
    if (paid) await fulfil(paid);
    return paid ?? row;
  }
  const back = new URL(p.back, siteOrigin(req)).toString();
  const [path, hash] = back.split("#");
  const withQuery = (q: string) => `${path}${path!.includes("?") ? "&" : "?"}${q}${hash ? `#${hash}` : ""}`;
  const inv = await createXenditInvoice({
    externalId: row.id,
    amount: row.amount,
    email: user.email,
    description: row.description,
    successUrl: withQuery("bayar=ok"),
    failureUrl: withQuery("bayar=gagal"),
  });
  await attachCheckout(db, row.id, inv.id, inv.invoice_url);
  return { ...row, providerId: inv.id, checkoutUrl: inv.invoice_url };
}

/** What a confirmed payment unlocks on the server: coins go into the ledger, a registration is paid, a bill is settled. */
async function fulfil(p: Payment) {
  const coins = (p.meta as { coins?: unknown }).coins;
  if (p.kind === "coins" && typeof coins === "number" && coins > 0) await grantCoins(db, { userId: p.userId, amount: coins, reason: p.description, key: `pay:${p.id}` });
  if (p.kind === "registration") await payRegistration(db, p.ref, p.userId, p.method ?? "Xendit");
  if (p.kind === "invoice") await settleInvoice(p, p.userId);
}

/**
 * Bring a payment up to date with what Xendit says. Never trusts the webhook body or the browser:
 * the invoice is fetched again with our secret key, and its amount must match ours.
 */
export async function refresh(p: Payment): Promise<Payment> {
  if (p.status !== "pending" || p.provider !== "xendit" || !p.providerId || !xenditEnabled()) return p;
  const inv = await getXenditInvoice(p.providerId);
  if (inv.external_id !== p.id) return p;
  if ((inv.status === "PAID" || inv.status === "SETTLED") && inv.amount === p.amount && (inv.currency ?? "IDR") === "IDR") {
    const paid = await markPaid(db, p.id, methodName(inv));
    if (paid) await fulfil(paid);
    return (await paymentById(db, p.id)) ?? p;
  }
  if (inv.status === "EXPIRED") {
    await markClosed(db, p.id, "expired");
    return { ...p, status: "expired" };
  }
  return p;
}

/** What the browser may see of a payment. */
export const paymentOut = (p: Payment) => ({
  id: p.id,
  kind: p.kind,
  ref: p.ref,
  description: p.description,
  amount: p.amount,
  status: p.status,
  provider: p.provider,
  method: p.method,
  checkoutUrl: p.status === "pending" ? p.checkoutUrl : null,
  claimed: !!p.claimedAt,
  items: (p.meta as { items?: unknown }).items ?? undefined,
  paidAt: p.paidAt?.getTime() ?? null,
  createdAt: p.createdAt.getTime(),
});
