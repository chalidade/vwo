import { createInvoice, invoicesOf, openInvoiceCount, readPrices } from "@vwo/db";
import { BUSINESS_PACKAGES, instalmentPlan, priceFrom, sellerTakesTransfer } from "@vwo/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canManageBooth } from "@/lib/fair";
import { fail, readBody, sameOrigin } from "@/lib/http";
import { backfillInvoices, invoiceOut, readBuyer, readSeller } from "@/lib/invoices";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BOOTH = /^[\w-]{1,80}$/;
/** Unpaid transfer and termin invoices one account may have open at once. */
const MAX_OPEN = 5;

/** What a buyer sees of the seller: what goes on an invoice and where to transfer to. */
async function sellerForBuyers() {
  const s = await readSeller();
  return { name: s.name, address: s.address, npwp: s.npwp, email: s.email, phone: s.phone, pkp: s.pkp, ppnRate: s.ppnRate, bank: s.bank, takesTransfer: sellerTakesTransfer(s) };
}

/** This account's invoices (and, with ?booth=, that booth's), its saved buyer details and the seller. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const booth = new URL(req.url).searchParams.get("booth");
  const booths = booth && BOOTH.test(booth) && (await canManageBooth(user, booth)) ? [booth] : [];
  if (await allow(`invoice-backfill:${user.id}`, 30, 600_000)) await backfillInvoices(user);
  const rows = await invoicesOf(db, user.id, booths);
  return NextResponse.json({ invoices: rows.map(invoiceOut), buyer: await readBuyer(user.id), seller: await sellerForBuyers() }, { headers: { "Cache-Control": "no-store" } });
}

const schema = z.object({
  pack: z.string().max(40),
  method: z.enum(["transfer", "termin"]),
  /** Instalments for a termin. */
  count: z.union([z.literal(2), z.literal(3)]).optional(),
  booth: z.string().regex(BOOTH).optional(),
});

/**
 * A company or agency buys a coin package by bank transfer or in instalments: an unpaid invoice with
 * the organiser's bank account and due dates. The price is the server's; coins come when the
 * organiser confirms the money arrived.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  if (!(await allow(`invoice-new:${user.id}`, 10, 3_600_000))) return fail(429, "too_many_requests");
  const body = await readBody(req, schema);
  if ("error" in body) return body.error;
  const b = body.data;
  const pkg = BUSINESS_PACKAGES.find((p) => p.id === b.pack);
  if (!pkg) return fail(404, "not_found");
  const buyer = await readBuyer(user.id);
  if (!buyer) return fail(409, "no_buyer");
  const seller = await readSeller();
  if (!sellerTakesTransfer(seller)) return fail(409, "no_bank");
  if (b.booth && !(await canManageBooth(user, b.booth))) return fail(403, "not_allowed");
  if ((await openInvoiceCount(db, user.id)) >= MAX_OPEN) return fail(409, "too_many_open");
  const amount = priceFrom(await readPrices(db), `pack.${pkg.id}`);
  if (amount <= 0) return fail(409, "not_payable");
  const coins = pkg.coins + pkg.bonus;
  const n = (x: number) => x.toLocaleString("id-ID");
  const row = await createInvoice(db, {
    userId: user.id,
    boothKey: b.booth ?? null,
    buyer,
    seller,
    items: [{ name: `Paket koin Job Fair: ${n(pkg.coins)}${pkg.bonus ? ` + ${n(pkg.bonus)} bonus` : ""} koin`, qty: 1, unit: amount, amount }],
    method: b.method,
    instalments: instalmentPlan(amount, b.method === "termin" ? (b.count ?? 2) : 1, new Date()),
    deliver: { coins, pack: pkg.id },
  });
  return NextResponse.json({ invoice: invoiceOut(row) }, { status: 201 });
}
