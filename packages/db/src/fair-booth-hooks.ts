// A booth's ATS webhook: where new applications and status changes are POSTed, and the secret
// they are signed with. The secret is made here, shown to the company once, and never sent again.
import { eq } from "drizzle-orm";
import { BlockList, isIP } from "node:net";
import { createHmac, randomBytes } from "node:crypto";
import type { Db } from "./client";
import { fairBoothHooks } from "./jobfair-schema";

export type BoothHookRow = typeof fairBoothHooks.$inferSelect;

const newSecret = () => `whsec_${randomBytes(32).toString("base64url")}`;

export async function boothHook(db: Db, boothKey: string) {
  const [row] = await db.select().from(fairBoothHooks).where(eq(fairBoothHooks.boothKey, boothKey));
  return row ?? null;
}

/**
 * Set where a booth's events go. The first save makes the secret and returns it; later saves keep
 * it (and return none), so changing the URL doesn't break the company's signature check.
 */
export async function setBoothHook(db: Db, input: { boothKey: string; url: string; enabled: boolean; userId: string }): Promise<{ row: BoothHookRow; secret?: string }> {
  const secret = newSecret();
  const [made] = await db
    .insert(fairBoothHooks)
    .values({ boothKey: input.boothKey, url: input.url, enabled: input.enabled, secret, updatedBy: input.userId })
    .onConflictDoNothing()
    .returning();
  if (made) return { row: made, secret };
  const [row] = await db
    .update(fairBoothHooks)
    .set({ url: input.url, enabled: input.enabled, updatedBy: input.userId, updatedAt: new Date() })
    .where(eq(fairBoothHooks.boothKey, input.boothKey))
    .returning();
  return { row: row! };
}

/** A fresh secret, returned once; null when the booth has no webhook. */
export async function rotateBoothHookSecret(db: Db, boothKey: string, userId: string) {
  const secret = newSecret();
  const rows = await db
    .update(fairBoothHooks)
    .set({ secret, updatedBy: userId, updatedAt: new Date() })
    .where(eq(fairBoothHooks.boothKey, boothKey))
    .returning({ boothKey: fairBoothHooks.boothKey });
  return rows.length ? secret : null;
}

export async function deleteBoothHook(db: Db, boothKey: string) {
  const rows = await db.delete(fairBoothHooks).where(eq(fairBoothHooks.boothKey, boothKey)).returning({ boothKey: fairBoothHooks.boothKey });
  return rows.length > 0;
}

/** The HTTP status of the last delivery; 0 when nothing answered (refused address, timeout, network). */
export async function recordBoothHookDelivery(db: Db, boothKey: string, status: number) {
  await db.update(fairBoothHooks).set({ lastStatus: status, lastAt: new Date() }).where(eq(fairBoothHooks.boothKey, boothKey));
}

/**
 * The signature header a receiver checks: HMAC-SHA256 over "<timestamp>.<raw body>" with the
 * booth's secret, hex encoded. Signing the timestamp too stops an old delivery being replayed.
 */
export const signBoothHook = (secret: string, timestamp: number, body: string) => `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

// Everything a webhook must never reach: this machine, private networks, link-local (where cloud
// metadata lives, 169.254.169.254), carrier NAT (Alibaba's 100.100.100.200), multicast, reserved.
const blockedV4 = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedV4.addSubnet(net, bits, "ipv4");

// IPv6: only global unicast (2000::/3), minus documentation, Teredo, 6to4 and ORCHID-style blocks that
// can tunnel to IPv4. That also rules out ::1, fc00::/7 (incl. fd00:ec2::254), fe80::/10 and mapped IPv4.
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new BlockList();
for (const [net, bits] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blockedV6.addSubnet(net, bits, "ipv6");

/** True for an address on the public internet that a webhook may be sent to. */
export function isPublicAddress(ip: string) {
  const v = isIP(ip);
  if (v === 4) return !blockedV4.check(ip, "ipv4");
  if (v === 6) return globalV6.check(ip, "ipv6") && !blockedV6.check(ip, "ipv6");
  return false;
}

/**
 * A webhook URL the company may save, or why not. DNS is checked separately (when saving and again
 * at each delivery, against the address actually connected to).
 */
export function checkHookUrl(raw: string): { url: URL } | { error: "invalid_url" | "https_only" | "url_not_allowed" } {
  if (raw.length > 500) return { error: "invalid_url" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "invalid_url" };
  }
  if (url.protocol !== "https:") return { error: "https_only" };
  if (url.username || url.password) return { error: "invalid_url" };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) return isPublicAddress(host) ? { url } : { error: "url_not_allowed" };
  // A bare name ("intranet") or a local suffix can only mean somewhere inside a network.
  if (!host.includes(".") || /\.(localhost|local|internal|lan|home|arpa)$/.test(host) || host === "localhost") return { error: "url_not_allowed" };
  return { url };
}
