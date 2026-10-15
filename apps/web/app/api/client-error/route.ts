import { ipBucket } from "@vwo/shared";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/http";
import { allow } from "@/lib/ratelimit";

const MAX_BODY = 8_000;

/** At most `max` characters of the body: a huge one is never read whole. */
async function readCapped(req: Request, max: number) {
  if (Number(req.headers.get("content-length") ?? 0) > max) return "";
  const reader = req.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += dec.decode(value, { stream: true });
      if (out.length > max) {
        await reader.cancel();
        return "";
      }
    }
  } catch {
    return "";
  }
  return out;
}

/**
 * Errors the game hit in someone's browser, written to the server log so they can be fixed. Anyone
 * can post here, so it is capped: per address, per network, and for everyone together (a flood of
 * one bug needs only a sample), and a body larger than a report is dropped unread.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!(await allow(`client-error:${ip}`, 20, 600_000))) return new NextResponse(null, { status: 204 });
  if (!(await allow(`client-error:net:${ipBucket(ip)}`, 60, 600_000))) return new NextResponse(null, { status: 204 });
  if (!(await allow("client-error:all", 300, 60_000))) return new NextResponse(null, { status: 204 });
  const raw = (await readCapped(req, MAX_BODY)).slice(0, 4000);
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
