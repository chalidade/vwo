import { invoiceFile } from "@vwo/db";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { visibleInvoice } from "@/lib/invoices";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Download a file of an invoice: the faktur pajak PDF, or a transfer receipt photo (?name=proof-0). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return fail(401, "not_signed_in");
  const row = await visibleInvoice(user, (await params).id);
  if (!row) return fail(404, "not_found");
  const name = new URL(req.url).searchParams.get("name") ?? "faktur";
  if (!/^(faktur|proof-[0-4])$/.test(name)) return fail(404, "not_found");
  const file = await invoiceFile(db, row.id, name);
  const m = file && /^data:([\w/+.-]+);base64,(.+)$/.exec(file.data);
  if (!file || !m || !["application/pdf", "image/jpeg", "image/png"].includes(m[1]!)) return fail(404, "not_found");
  const base = name === "faktur" ? `Faktur-Pajak-${row.number.replace(/\//g, "-")}` : `Bukti-${row.number.replace(/\//g, "-")}-${name.slice(6)}`;
  const ext = m[1] === "application/pdf" ? "pdf" : m[1] === "image/png" ? "png" : "jpg";
  return new Response(Buffer.from(m[2]!, "base64"), {
    headers: {
      "Content-Type": m[1]!,
      "Content-Disposition": `attachment; filename="${base}.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
