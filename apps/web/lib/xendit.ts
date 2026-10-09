import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Xendit payment links (the Invoice API). On when XENDIT_SECRET_KEY is set; the key and the
 * webhook token live only in the server's environment, never in the browser or the repository.
 */
export const xenditEnabled = () => !!process.env.XENDIT_SECRET_KEY;

const base = () => (process.env.XENDIT_API_URL || "https://api.xendit.co").replace(/\/$/, "");
const auth = () => `Basic ${Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString("base64")}`;

export interface XenditInvoice {
  id: string;
  external_id: string;
  status: "PENDING" | "PAID" | "SETTLED" | "EXPIRED" | string;
  amount: number;
  paid_amount?: number;
  currency?: string;
  invoice_url: string;
  payment_method?: string;
  payment_channel?: string;
}

async function call(path: string, init?: RequestInit): Promise<XenditInvoice> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: auth(), "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`xendit ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return (await res.json()) as XenditInvoice;
}

export function createXenditInvoice(input: { externalId: string; amount: number; email: string; description: string; successUrl: string; failureUrl: string }) {
  return call("/v2/invoices", {
    method: "POST",
    // Same payment id twice gives the same invoice instead of a second charge.
    headers: { "X-IDEMPOTENCY-KEY": input.externalId },
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      currency: "IDR",
      payer_email: input.email,
      description: input.description,
      invoice_duration: 86_400,
      success_redirect_url: input.successUrl,
      failure_redirect_url: input.failureUrl,
    }),
  });
}

export const getXenditInvoice = (id: string) => call(`/v2/invoices/${encodeURIComponent(id)}`);

/** The webhook's X-CALLBACK-TOKEN matches ours (compared in constant time). */
export function callbackTokenOk(token: string | null) {
  const want = process.env.XENDIT_CALLBACK_TOKEN;
  if (!want || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** How the buyer paid, in words for the receipt. */
export function methodName(inv: XenditInvoice) {
  const ch = inv.payment_channel?.replace(/_/g, " ");
  return ch ? `Xendit · ${ch}` : "Xendit";
}
