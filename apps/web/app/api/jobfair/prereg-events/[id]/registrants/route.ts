import { deletePreregs, preregEventById, preregRegistrants } from "@vwo/db";
import { preregCsv } from "@vwo/shared";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFairAdmin } from "@/lib/fair";
import { z } from "zod";
import { fail, readSizedBody, sameOrigin } from "@/lib/http";
import { currentUser } from "@/lib/session";
import { UUID, adminRegistrants } from "../../view";

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
  // Scored among all of the event's sign-ups, not just the ones a search found.
  const q = url.searchParams.get("q") ?? "";
  const all = q.trim() ? await preregRegistrants(db, id) : rows;
  const shown = new Set(rows.map((r) => r.id));
  return NextResponse.json({ registrants: adminRegistrants(all).filter((r) => shown.has(r.id)) }, { headers: { "Cache-Control": "no-store" } });
}

const bulk = z.object({ ids: z.array(z.string().regex(UUID)).min(1).max(1000) });

/** Remove many sign-ups of this event at once (the organiser picked them, e.g. every suspicious one). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  if (!isFairAdmin(await currentUser())) return fail(403, "not_allowed");
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "not_found");
  const body = await readSizedBody(req, bulk, 60_000);
  if ("error" in body) return body.error;
  return NextResponse.json({ deleted: await deletePreregs(db, id, [...new Set(body.data.ids)]) });
}
