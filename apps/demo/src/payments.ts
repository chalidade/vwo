// Live site: paying real money through the server's payment gateway (Xendit). The server works out
// every price; the browser only says what to buy and is sent to the gateway's checkout page.
import { refreshCoins } from "./coin-sync";
import { whenPlayerReady } from "./player-sync";
import { refreshShared } from "./shared-state";
import { fair } from "./useFair";

export type Gateway = "xendit" | "demo";

export interface PaymentView {
  id: string;
  kind: "coins" | "registration" | "invoice" | "stall";
  ref: string;
  description: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "failed" | "refunded";
  provider: Gateway | "koin";
  method: string | null;
  checkoutUrl: string | null;
  claimed: boolean;
}

const ERRORS: Record<string, string> = {
  not_signed_in: "Sesi login habis. Muat ulang halaman lalu masuk lagi.",
  not_allowed: "Akun ini tidak bisa membayar tagihan stand ini.",
  not_payable: "Tagihan ini sudah dibayar atau tidak bisa dibayar lagi.",
  slot_taken: "Maaf, stan ini baru saja disewa usaha lain. Pilih stan kosong lain.",
  invalid_input: "Data belum lengkap atau terlalu panjang. Periksa lagi isiannya.",
  too_many_requests: "Terlalu banyak percobaan bayar. Coba lagi nanti.",
  gateway_error: "Halaman pembayaran belum bisa dibuat. Coba lagi sebentar lagi.",
  not_delivered: "Pembelian gagal diproses. Koinmu sudah dikembalikan; coba lagi.",
};

type Ledger = Parameters<typeof fair.setLedger>[0];

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

export type PayFor =
  | { kind: "coins"; pack: string; back?: string }
  | { kind: "invoice"; booth: string; invoice: string }
  | { kind: "stall"; slot: number; stall: { name: string; vendor?: string; promo?: string; emoji?: string; color?: string; deal?: { title: string; worth: string; price: number } | null } };

/**
 * Buy coins (through the gateway), or pay a company bill or a food court stand with coins. Returns
 * "redirect" when the browser is on its way to the checkout page, the paid payment when it was
 * settled at once (coins, or the demo gateway), or an error to show.
 */
export async function pay(body: PayFor): Promise<{ ok: true; redirect: true } | { ok: true; payment: PaymentView } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/payments", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as { error?: string; code?: string; payment?: PaymentView; coins?: Ledger; needed?: number; balance?: number } & Partial<Ledger>;
    // A coin payment answers with the ledger as it is now, paid or not.
    if (d.coins) fair.setLedger(d.coins);
    else if (typeof d.balance === "number" && typeof d.seq === "number") fair.setLedger(d as Ledger);
    if (d.error === "not_enough_coins") return { ok: false, error: `Koin belum cukup: perlu ${(d.needed ?? 0).toLocaleString("id-ID")} koin, saldo ${(d.balance ?? 0).toLocaleString("id-ID")} koin. Isi koin dulu.` };
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
    const r = await fetch("/api/payments?kind=coins,invoice,stall", { credentials: "same-origin" });
    if (!r.ok) return { pending: false };
    const { payments } = (await r.json()) as { payments: PaymentView[] };
    let bills = false;
    let coins = false;
    for (const p of payments) {
      if (p.status !== "paid" || p.claimed) continue;
      const c = await fetch(`/api/payments/${p.id}/claim`, { method: "POST", credentials: "same-origin" });
      if (!c.ok) continue;
      if (p.kind === "coins") {
        // Seekers' packages show up at once; the ledger, which already has them, is read below.
        fair.buyCoins(p.ref, p.method ?? "Xendit");
        coins = true;
      }
      // A rented stand is opened by the server; the next pull shows it.
      else if (p.kind === "stall") {
        fair.stallRentPaid(p.description.replace(/^.*· /, ""));
        bills = true;
      }
      else {
        const at = p.ref.indexOf(":");
        fair.payInvoice(p.ref.slice(0, at), p.ref.slice(at + 1), p.method ?? "Xendit");
        bills = true;
      }
    }
    if (bills) refreshShared();
    if (coins) await refreshCoins();
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
