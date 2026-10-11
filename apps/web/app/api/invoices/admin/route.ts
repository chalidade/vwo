import { invoicesForOrganiser } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwnerAdmin } from "@/lib/fair";
import { fail } from "@/lib/http";
import { invoiceOut } from "@/lib/invoices";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Every invoice for the organiser: unpaid transfers and termins first. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!isOwnerAdmin(user)) return fail(403, "not_allowed");
  const s = new URL(req.url).searchParams.get("status");
  const status = s === "issued" || s === "paid" || s === "void" ? s : undefined;
  const rows = await invoicesForOrganiser(db, status);
  return NextResponse.json({ invoices: rows.map(invoiceOut) }, { headers: { "Cache-Control": "no-store" } });
}
