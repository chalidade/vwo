import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";

/** JSON error with a stable code the client can show in its own words. */
export const fail = (status: number, error: string, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });

/**
 * Reject cross-site form posts (CSRF): a state-changing request must come from our own origin.
 * Browsers always send Origin on POST, so a missing one is treated as foreign too.
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Most characters a JSON body without a file may have; every form fits in a small part of it. */
export const BODY_MAX = 1_000_000;

/**
 * The body as text, or null when it has more than `max` characters. It is read in pieces and dropped
 * as soon as it is too long, so a huge body can't fill the server's memory (a UTF-8 character is at
 * most 3 bytes per UTF-16 unit, hence the byte bound).
 */
export async function readCapped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max * 3) return null;
  const reader = req.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let out = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    out += dec.decode(value, { stream: true });
    if (out.length > max || bytes > max * 3) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
  }
  out += dec.decode();
  return out.length > max ? null : out;
}

/** Parse and validate a JSON body. Returns the data, or a 400 (413 when over `max` characters) response to send back. */
export async function readBody<T extends z.ZodTypeAny>(req: Request, schema: T, max = BODY_MAX): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  return readSizedBody(req, schema, max);
}

/** Like readBody, for bodies that may carry a file: anything over `max` characters is refused before parsing. */
export async function readSizedBody<T extends z.ZodTypeAny>(req: Request, schema: T, max: number): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const text = await readCapped(req, max).catch(() => "");
  if (text === null) return { error: fail(413, "too_large") };
  let raw: unknown;
  try {
    raw = text === "" ? undefined : JSON.parse(text);
  } catch {
    return { error: fail(400, "invalid_input") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: fail(400, "invalid_input", { fields: parsed.error.flatten().fieldErrors }) };
  return { data: parsed.data };
}

/**
 * The client's address as our proxy saw it. Vercel and Caddy both set X-Forwarded-For themselves;
 * if anything in front ever appends instead, the last entry is the one our proxy added, while the
 * first could be typed by the client to dodge rate limits.
 */
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
