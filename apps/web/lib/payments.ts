import "server-only";
import { attachCheckout, createPayment, grantCoins, markClosed, markPaid, markRefunded, NotEnoughCoinsError, openPayment, type Payment, type PaymentKind, payRegistration, paymentById, readPrices, spendCoins } from "@vwo/db";
import { coinsFor } from "@vwo/shared";
import { liveCoins } from "./coins";
import { db } from "./db";
import { settleInvoice } from "./company-doc";
import { placeRentedStall } from "./stalls";
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

export class CoinsShortError extends Error {
  constructor(
    readonly balance: number,
    readonly needed: number,
  ) {
    super("not enough coins");
  }
}

/**
 * Pay for a booth registration, a company bill or a food court stand with coins from the account's
 * ledger. The coin price comes from the server's rupiah price and the organiser's coin value. The
 * charge is keyed to the thing bought (a bill or registration is never charged twice); if what was
 * bought can't be handed over, the coins go back.
 */
export async function payWithCoins(user: { id: string }, p: Purchase): Promise<Payment> {
  const coins = coinsFor(await readPrices(db), p.amount);
  await liveCoins(user.id);
  const row = await createPayment(db, { userId: user.id, kind: p.kind, ref: p.ref, description: `${p.description} · ${coins.toLocaleString("id-ID")} koin`.slice(0, 200), amount: coins, meta: { ...p.meta, rupiah: p.amount, coins }, provider: "koin" });
  // A bill can be charged once ever; a registration or a stand once per attempt (a second attempt
  // on a registration that is already paid gets its coins back below).
  const key = p.kind === "invoice" ? `buy:invoice:${p.ref}` : `buy:${p.kind}:${row.id}`;
  try {
    const charged = await spendCoins(db, { userId: user.id, amount: coins, reason: p.description.slice(0, 120), key, refId: row.id });
    if (!charged) {
      await markClosed(db, row.id, "failed");
      throw new CoinsShortError(-1, coins);
    }
  } catch (e) {
    if (e instanceof NotEnoughCoinsError) {
      await markClosed(db, row.id, "failed");
      throw new CoinsShortError(e.balance, e.needed);
    }
    throw e;
  }
  const paid = (await markPaid(db, row.id, "Koin"))!;
  let ok = true;
  try {
    if (p.kind === "registration") ok = await payRegistration(db, p.ref, user.id, "Koin");
    else if (p.kind === "invoice") await settleInvoice(paid, user.id);
    else if (p.kind === "stall") ok = !!(await placeRentedStall(paid));
  } catch (e) {
    console.error("coin purchase not delivered", row.id, e);
    ok = false;
  }
  if (!ok) {
    await grantCoins(db, { userId: user.id, amount: coins, reason: `Pengembalian: ${p.description}`.slice(0, 120), key: `refund:${row.id}` });
    await markRefunded(db, row.id);
    throw new Error("purchase_failed");
  }
  return paid;
}

/** What a confirmed payment unlocks on the server: coins go into the ledger, a registration is paid, a bill is settled, a rented stand opens. */
async function fulfil(p: Payment) {
  const coins = (p.meta as { coins?: unknown }).coins;
  if (p.kind === "coins" && typeof coins === "number" && coins > 0) await grantCoins(db, { userId: p.userId, amount: coins, reason: p.description, key: `pay:${p.id}` });
  if (p.kind === "registration") await payRegistration(db, p.ref, p.userId, p.method ?? "Xendit");
  if (p.kind === "invoice") await settleInvoice(p, p.userId);
  if (p.kind === "stall") await placeRentedStall(p);
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
