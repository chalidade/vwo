import "server-only";
import { type BoothHookRow, type FairApplicationRow, boothHook, checkHookUrl, isPublicAddress, recordBoothHookDelivery, signBoothHook } from "@vwo/db";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { randomUUID } from "node:crypto";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { after } from "next/server";
import { db } from "./db";

/** A delivery gets this long to connect and answer; a slow ATS must not hold anything up. */
const TIMEOUT_MS = 5_000;

export type HookEvent = "application.created" | "application.status_changed" | "test";

class BlockedAddress extends Error {
  code = "EBLOCKED";
}

/**
 * Resolve a webhook's host, and refuse it unless every address is public. The connection then uses
 * exactly the address checked here, so DNS can't answer "public" to the check and "private" to the
 * connect (DNS rebinding).
 */
const safeLookup: LookupFunction = (hostname, options, cb) => {
  dnsLookup(hostname, { all: true, family: options.family as 0 | 4 | 6 | undefined }, (err, addresses: LookupAddress[]) => {
    if (err) return cb(err, "", 0);
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) return cb(new BlockedAddress(`blocked address for ${hostname}`), "", 0);
    if (options.all) return (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    cb(null, addresses[0]!.address, addresses[0]!.family);
  });
};

/** Whether a host resolves only to public addresses, for a quick answer when the company saves the URL. */
export function resolvesPublic(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return Promise.resolve(isPublicAddress(host));
  return new Promise<boolean>((resolve) => safeLookup(host, { all: true }, (err) => resolve(!err)));
}

/** POST one signed event. Returns the HTTP status, or 0 with why nothing answered. Never throws. */
export function postHook(
  hook: Pick<BoothHookRow, "url" | "secret">,
  event: HookEvent,
  data: Record<string, unknown>,
): Promise<{ status: number; error?: "blocked" | "timeout" | "network" }> {
  const checked = checkHookUrl(hook.url);
  if ("error" in checked) return Promise.resolve({ status: 0, error: "blocked" });
  const ip = checked.url.hostname.replace(/^\[|\]$/g, "");
  // An IP literal never goes through lookup, so it is checked here.
  if (isIP(ip) && !isPublicAddress(ip)) return Promise.resolve({ status: 0, error: "blocked" });
  const body = JSON.stringify({ id: randomUUID(), event, sentAt: new Date().toISOString(), ...data });
  const ts = Math.floor(Date.now() / 1000);
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: { status: number; error?: "blocked" | "timeout" | "network" }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    const req = request(
      checked.url,
      {
        method: "POST",
        lookup: safeLookup,
        agent: false,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "jobfair.co.id-webhook/1",
          "X-Jobfair-Event": event,
          "X-Jobfair-Timestamp": String(ts),
          "X-Jobfair-Signature": signBoothHook(hook.secret, ts, body),
        },
      },
      (res) => {
        // Only the status matters; redirects are not followed (they could point anywhere).
        res.resume();
        finish({ status: res.statusCode ?? 0 });
        res.destroy();
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish({ status: 0, error: "timeout" });
    }, TIMEOUT_MS);
    req.on("error", (e) => finish({ status: 0, error: (e as { code?: string }).code === "EBLOCKED" ? "blocked" : "network" }));
    req.end(body);
  });
}

/** What an ATS gets about one application: the form, where it stands, and the interview if any. */
export function hookApplication(row: FairApplicationRow) {
  const d = row.data as Record<string, unknown>;
  const s = row.shared as { interview?: { at: number; mode: string; place?: string; reply?: string }; rating?: number; statusAt?: number };
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  return {
    id: row.id,
    boothId: row.boothKey,
    jobId: row.jobKey,
    jobTitle: str("jobTitle"),
    company: str("company"),
    status: row.status,
    appliedAt: row.createdAt.toISOString(),
    statusAt: s.statusAt ? new Date(s.statusAt).toISOString() : undefined,
    candidate: {
      name: str("name"),
      email: str("email"),
      phone: str("phone"),
      city: str("city"),
      education: str("education"),
      headline: str("headline"),
      skills: str("skills"),
      cvUrl: str("cvUrl"),
      message: str("message"),
      verified: d.verified === true,
    },
    psikotes: typeof d.psych === "number" ? d.psych : undefined,
    rating: s.rating,
    interview: s.interview ? { at: new Date(s.interview.at).toISOString(), mode: s.interview.mode, place: s.interview.place, reply: s.interview.reply } : undefined,
  };
}

/** After the response is sent: tell the booth's ATS, if it has one, and note how it answered. */
export function notifyBoothHook(boothKey: string, event: HookEvent, row: FairApplicationRow, extra?: Record<string, unknown>) {
  after(async () => {
    const hook = await boothHook(db, boothKey);
    if (!hook?.enabled) return;
    const r = await postHook(hook, event, { booth: boothKey, application: hookApplication(row), ...extra });
    await recordBoothHookDelivery(db, boothKey, r.status);
  });
}
