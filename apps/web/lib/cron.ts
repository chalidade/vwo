import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron (or any scheduler the organiser points at us) calls with `Authorization: Bearer $CRON_SECRET`.
 * Without the secret the jobs only run in development, so nobody else can make the server send email or pushes.
 */
export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
