import { myPayments, type PaymentKind, readPrices, registrationById } from "@vwo/db";
import { COIN_PACKAGES, priceFrom } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { companyDoc, PRODUCT_IDS } from "@/lib/company-doc";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { type Purchase, paymentOut, provider, refresh, startPayment } from "@/lib/payments";
import { allow } from "@/lib/ratelimit";
import { XenditError } from "@/lib/xendit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("coins"), pack: z.string().max(40) }),
  z.object({ kind: z.literal("registration"), id: z.string().uuid() }),
  z.object({ kind: z.literal("invoice"), booth: z.string().regex(/^[\w-]{1,80}$/), invoice: z.string().max(80) }),
]);

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/** This account's payments (pending ones are checked with Xendit first), and which gateway is on. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const kinds = new URL(req.url).searchParams.get("kind")?.split(",").filter((k): k is PaymentKind => ["coins", "registration", "invoice"].includes(k));
  let rows = await myPayments(db, user.id, kinds);
  if (rows.some((p) => p.status === "pending" && p.providerId) && (await allow(`pay-refresh:${user.id}`, 30, 600_000))) {
    rows = await Promise.all(rows.map((p) => (p.status === "pending" ? refresh(p).catch(() => p) : p)));
  }
  return NextResponse.json({ provider: provider(), payments: rows.map(paymentOut) }, { headers: { "Cache-Control": "no-store" } });
}

/** Pay for coins, a booth registration or a company invoice. The price is always the server's. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`pay:${user.id}`, 20, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const b = body.data;
  const prices = await readPrices(db);
  let purchase: Purchase;

  if (b.kind === "coins") {
    const pkg = COIN_PACKAGES.find((p) => p.id === b.pack);
    if (!pkg) return fail(404, "not_found");
    const amount = priceFrom(prices, `pack.${pkg.id}`);
    purchase = { kind: "coins", ref: pkg.id, amount, description: `${pkg.coins}${pkg.bonus ? ` + ${pkg.bonus} bonus` : ""} koin Job Fair`, meta: { coins: pkg.coins + pkg.bonus }, back: "/play/#/jobfair" };
  } else if (b.kind === "registration") {
    const reg = await registrationById(db, b.id);
    if (!reg || reg.userId !== user.id) return fail(404, "not_found");
    if (reg.status !== "unpaid") return fail(409, "not_payable");
    purchase = { kind: "registration", ref: reg.id, amount: reg.price, description: `Pendaftaran stand ${reg.tier === "premium" ? "VIP" : "reguler"} · ${reg.company}`.slice(0, 200), back: "/daftar-perusahaan" };
  } else {
    if (!(await canManageBooth(user, b.booth))) return fail(403, "not_allowed");
    const inv = (await companyDoc(b.booth))?.invoices?.find((i) => i.id === b.invoice);
    if (!inv) return fail(404, "not_found");
    if (inv.status !== "Belum dibayar") return fail(409, "not_payable");
    // Only real products, each once, at the organiser's current price; the bill's own prices are ignored.
    const ids = [...new Set((inv.items ?? []).map((i) => i.id))].filter((id) => PRODUCT_IDS.has(id));
    const items = ids.map((id) => ({ id, name: String(inv.items?.find((i) => i.id === id)?.name ?? id).slice(0, 60), price: priceFrom(prices, `product.${id}`) })).filter((i) => i.price > 0);
    if (!items.length) return fail(409, "not_payable");
    purchase = {
      kind: "invoice",
      ref: `${b.booth}:${inv.id}`,
      amount: items.reduce((n, i) => n + i.price, 0),
      description: `Tagihan stand ${String((inv as { no?: string }).no ?? inv.id)}`.slice(0, 200),
      meta: { items },
      back: `/play/#/jobfair/company/${b.booth}`,
    };
  }
  if (purchase.amount <= 0) return fail(409, "not_payable");
  try {
    const p = await startPayment(req, user, purchase);
    return NextResponse.json({ payment: paymentOut(p), provider: p.provider }, { status: 201 });
  } catch (e) {
    console.error("payment start failed", e);
    const code = e instanceof XenditError ? e.code.replace(/[^A-Z0-9_]/gi, "").slice(0, 60) : "NETWORK";
    return fail(502, "gateway_error", { code, message: `Gagal membuat tagihan ${rupiah(purchase.amount)}. Coba lagi sebentar lagi.` });
  }
}
