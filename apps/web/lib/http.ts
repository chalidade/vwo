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

/** Parse and validate a JSON body. Returns the data, or a 400 response to send back. */
export async function readBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const raw = await req.json().catch(() => undefined);
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
