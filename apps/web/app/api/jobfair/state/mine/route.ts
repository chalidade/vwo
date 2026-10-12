import { boothsOf, readFairState, readFairStateKey, readPrices } from "@vwo/db";
import { cleanPrices } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail } from "@/lib/http";
import { kickSeminarPushes } from "@/lib/seminars";
import { buildState, type StateRow } from "@/lib/state-view";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Never kept by the CDN or shared between accounts. */
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/**
 * What this account sees beyond the public setup (../route.ts). An event admin gets the whole setup
 * as they may see it (PINs, bookings, invoices, who rented a stall), and pulls only this. A booth
 * account gets its own booths' documents with their invoices, laid over the public ones. Anyone else
 * gets nothing more.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const admin = isFairAdmin(user);
  const booths = await boothsOf(db, user.id);
  const mine = new Set(booths);
  if (admin) {
    const [rows, prices] = await Promise.all([readFairState(db), readPrices(db)]);
    const org = rows.find((r) => r.key === "org");
    if (org) kickSeminarPushes(org.data);
    return NextResponse.json({ ...buildState(rows, { admin, mine }), prices: cleanPrices(prices), admin, booths }, { headers: PRIVATE });
  }
  // A booth account: only its own documents, read by key.
  const rows: StateRow[] = [];
  for (const id of booths.slice(0, 20)) {
    const row = await readFairStateKey(db, `company:${id}`);
    if (row) rows.push({ key: `company:${id}`, ...row });
  }
  const { companies, version } = buildState(rows, { admin, mine });
  return NextResponse.json({ companies, version, admin, booths }, { headers: PRIVATE });
}
