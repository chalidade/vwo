// Live site: paying real money through the server's payment gateway (Xendit). The server works out
// every price; the browser only says what to buy and is sent to the gateway's checkout page.
import { whenPlayerReady } from "./player-sync";
import { refreshShared } from "./shared-state";
import { fair } from "./useFair";

export type Gateway = "xendit" | "demo";

export interface PaymentView {
  id: string;
  kind: "coins" | "registration" | "invoice";
  ref: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "failed";
  provider: Gateway;
  method: string | null;
  checkoutUrl: string | null;
  claimed: boolean;
}

const ERRORS: Record<string, string> = {
  not_signed_in: "Sesi login habis. Muat ulang halaman lalu masuk lagi.",
  not_allowed: "Akun ini tidak bisa membayar tagihan stand ini.",
  not_payable: "Tagihan ini sudah dibayar atau tidak bisa dibayar lagi.",
  too_many_requests: "Terlalu banyak percobaan bayar. Coba lagi nanti.",
  gateway_error: "Halaman pembayaran belum bisa dibuat. Coba lagi sebentar lagi.",
};

let gateway: Gateway | null = null;

/** Which gateway the server uses: xendit, or demo when none is set up (nothing is charged). */
export async function paymentGateway(): Promise<Gateway> {
  if (gateway) return gateway;
  try {
    const r = await fetch("/api/payments?kind=none", { credentials: "same-origin" });
    if (r.ok) gateway = ((await r.json()) as { provider: Gateway }).provider;
  } catch {
    // Offline: assume the real gateway, so nothing claims to be free.
  }
  return gateway ?? "xendit";
}

/**
 * Pay for coins or a company bill. Returns "redirect" when the browser is on its way to the
 * checkout page, the paid payment when it was settled at once (demo), or an error to show.
 */
export async function pay(body: { kind: "coins"; pack: string } | { kind: "invoice"; booth: string; invoice: string }): Promise<{ ok: true; redirect: true } | { ok: true; payment: PaymentView } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/payments", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as { error?: string; code?: string; payment?: PaymentView };
    const msg = ERRORS[d.error ?? ""] ?? "Pembayaran gagal dimulai. Coba lagi.";
    if (!r.ok || !d.payment) return { ok: false, error: d.code ? `${msg} (kode: ${d.code})` : msg };
    if (d.payment.status === "pending" && d.payment.checkoutUrl) {
      window.location.href = d.payment.checkoutUrl;
      return { ok: true, redirect: true };
    }
    return { ok: true, payment: d.payment };
  } catch {
    return { ok: false, error: "Tidak tersambung ke server. Periksa internet lalu coba lagi." };
  }
}

/**
 * Take what was paid for and not yet taken: coins go into the wallet, and a paid company bill is
 * marked paid here at once (the server already recorded it on the booth). Each is claimed once.
 */
export async function claimPaidCoins() {
  try {
    const r = await fetch("/api/payments?kind=coins,invoice", { credentials: "same-origin" });
    if (!r.ok) return { pending: false };
    const { payments } = (await r.json()) as { payments: PaymentView[] };
    let bills = false;
    for (const p of payments) {
      if (p.status !== "paid" || p.claimed) continue;
      const c = await fetch(`/api/payments/${p.id}/claim`, { method: "POST", credentials: "same-origin" });
      if (!c.ok) continue;
      if (p.kind === "coins") fair.buyCoins(p.ref, p.method ?? "Xendit");
      else {
        const at = p.ref.indexOf(":");
        fair.payInvoice(p.ref.slice(0, at), p.ref.slice(at + 1), p.method ?? "Xendit");
        bills = true;
      }
    }
    if (bills) refreshShared();
    return { pending: payments.some((p) => p.status === "pending" && p.checkoutUrl) };
  } catch {
    return { pending: false };
  }
}

let running = false;

/** After the account's progress loads, add paid coins, and keep checking while a payment is open. */
export function startPaymentSync() {
  whenPlayerReady(() => {
    if (running) return;
    running = true;
    let tries = 0;
    const round = async () => {
      const { pending } = await claimPaidCoins();
      // Back from the checkout page, the gateway may confirm a moment later.
      if (pending && tries++ < 40) setTimeout(() => void round(), 6_000);
      else running = false;
    };
    void round();
  });
}
