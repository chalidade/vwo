import { paymentById } from "@vwo/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refresh } from "@/lib/payments";
import { callbackTokenOk } from "@/lib/xendit";

export const dynamic = "force-dynamic";

/**
 * Xendit tells us an invoice changed. The token proves it is Xendit; even then the body is only a
 * hint: the invoice is fetched again from Xendit before anything is marked paid.
 */
export async function POST(req: Request) {
  if (!callbackTokenOk(req.headers.get("x-callback-token"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { external_id?: unknown } | null;
  const id = typeof body?.external_id === "string" ? body.external_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: true, ignored: true });
  const p = await paymentById(db, id);
  if (!p) return NextResponse.json({ ok: true, ignored: true });
  try {
    const now = await refresh(p);
    return NextResponse.json({ ok: true, status: now.status });
  } catch (e) {
    console.error("xendit webhook", e);
    // Xendit retries on errors.
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
