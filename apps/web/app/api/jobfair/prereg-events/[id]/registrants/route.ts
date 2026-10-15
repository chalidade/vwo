import { preregEventById, preregRegistrants } from "@vwo/db";
import { preregCsv } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { fail } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { UUID, adminRegistrant } from "../../view";

export const dynamic = "force-dynamic";

/** An event's registrants, searched, as JSON for the hub or as a CSV file (?format=csv): event admins only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "not_found");
  const event = await preregEventById(db, id);
  if (!event) return fail(404, "not_found");
  const url = new URL(req.url);
  const rows = await preregRegistrants(db, id, url.searchParams.get("q") ?? "");
  if (url.searchParams.get("format") === "csv")
    return new NextResponse(preregCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pendaftar-${event.slug}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  return NextResponse.json({ registrants: rows.map(adminRegistrant) }, { headers: { "Cache-Control": "no-store" } });
}
