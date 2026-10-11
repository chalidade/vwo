import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { invoiceOut, visibleInvoice } from "@/lib/invoices";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** One invoice, for its printable page: the buyer, the booth accounts it was bought for, and the event's admins. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const row = await visibleInvoice(user, (await params).id);
  if (!row) return fail(404, "not_found");
  return NextResponse.json({ invoice: invoiceOut(row) }, { headers: { "Cache-Control": "no-store" } });
}
