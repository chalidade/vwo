import { NextResponse } from "next/server";
import { clientIp } from "@/lib/http";
import { allow } from "@/lib/ratelimit";

/** Errors the game hit in someone's browser, written to the server log so they can be fixed. */
export async function POST(req: Request) {
  if (!(await allow(`client-error:${clientIp(req)}`, 20, 600_000))) return new NextResponse(null, { status: 204 });
  const raw = (await req.text().catch(() => "")).slice(0, 4000);
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const str = (k: string, n: number) => (typeof data[k] === "string" ? (data[k] as string).slice(0, n) : "");
  console.error("[client-error]", JSON.stringify({ kind: str("kind", 20), message: str("message", 300), stack: str("stack", 1500), url: str("url", 120), ua: str("ua", 200) }));
  return new NextResponse(null, { status: 204 });
}
