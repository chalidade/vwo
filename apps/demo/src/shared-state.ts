// Live site: the event setup (organiser's changes, every company's booth) is kept on the server,
// so the panitia, the companies and the job seekers all see the same event on every device.
// Everyone pulls it; event admins push what they change here, and company accounts their own booth.
// The public setup is the same for everyone and kept by the CDN; an event admin pulls the whole of it
// from /state/mine instead, and a company account lays its own booth (with its invoices) from there
// over the public one. Nothing is pulled while the tab is hidden.
import { cleanPrices, type Prices, priceTable, type PublicConsultant, type StandPlacements } from "@vwo/shared";
import type { BookedBooth, CompanyState, OrgState, RentedStall } from "./jobfair-engine";
import { pollVisible } from "./poll";
import { runtimeConfig } from "./runtime-config";
import { fair } from "./useFair";

type Shared = {
  org: OrgState | null;
  companies: Record<string, CompanyState>;
  bookings?: BookedBooth[];
  stalls?: RentedStall[];
  placements?: StandPlacements;
  consultants?: PublicConsultant[];
  consultBotsOff?: string[];
  prices?: Prices;
  version: number;
};

/** What /state/mine adds for a booth account: its own booths' documents. */
type Mine = { companies?: Record<string, CompanyState>; version?: number };

/** One setup from the public pull and this account's own part: its booths' full documents win. */
export function mergeShared(pub: Shared, mine: Mine | null): Shared & { key: string } {
  return { ...pub, companies: { ...pub.companies, ...(mine?.companies ?? {}) }, key: `${pub.version}:${mine?.version ?? 0}` };
}

let started = false;
let admin = false;
/** Company booths this account runs: their `company:<id>` documents are pushed too. */
const mine = new Set<string>();
let pushing: (() => void) | null = null;
let pushNow: (() => Promise<void>) | null = null;
let pullNow: (() => Promise<void>) | null = null;

/** Send this browser's unsent changes now (e.g. a new bill, before paying it). */
export async function flushShared() {
  for (let i = 0; i < 20 && pushNow; i++) {
    await pushNow();
    if (!pending()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Pull now (the lounge consultants are taken on every pull, whatever the version). */
export function pullShared() {
  void pullNow?.();
}

/** Take the server's setup on the next pull, whatever this browser last applied; past the CDN, as something just changed. */
export function refreshShared() {
  version = "";
  fresh = true;
  void pullNow?.();
}

let pending = () => false;
/** The server setup's version this browser has applied; "" takes the next pull whatever it says. */
let version = "";
/** The next public pull skips the CDN's copy. */
let fresh = false;
const mayPush = (key: string) => admin || (key.startsWith("company:") && mine.has(key.slice("company:".length)));

/** Start pulling the setup; event admins and company accounts also push their changes. Safe to call again. */
export function startSharedSync(asAdmin: boolean, booths: string[] = []) {
  const more = booths.some((b) => !mine.has(b));
  booths.forEach((b) => mine.add(b));
  if ((asAdmin && !admin) || more) {
    admin ||= asAdmin;
    // What the server shows this account just widened (booth invoices, PINs): take it now. Nothing
    // goes up until it has come, so a copy pulled for the public is never saved over the full one.
    version = "";
    pushing?.();
    void pullNow?.();
  }
  if (started) return;
  started = true;
  // What the server has, as this browser last saw or sent it, per key.
  const synced = new Map<string, string>();
  let busy = false;

  const local = () => {
    const s = fair.sharedState();
    // Announcements have their own API; the server ignores them in the setup, so they never count as a change to push.
    const { announcement: _a, announcements: _b, ...org } = s.org;
    const m = new Map<string, string>([["org", JSON.stringify(org)]]);
    for (const [id, c] of Object.entries(s.companies)) m.set(`company:${id}`, JSON.stringify(c));
    return m;
  };
  const unsent = () => version !== "" && [...local()].some(([k, v]) => mayPush(k) && synced.get(k) !== v);
  pending = () => [...local()].some(([k, v]) => mayPush(k) && synced.get(k) !== v);

  const pull = async () => {
    if (busy) return;
    busy = true;
    try {
      // An event admin sees everything from their own pull; everyone else starts from the public setup.
      let d: Shared & { key: string };
      if (admin) {
        const r = await fetch("/api/jobfair/state/mine", { credentials: "same-origin", cache: "no-store" });
        if (!r.ok) return;
        const m = (await r.json()) as Shared;
        d = { ...m, key: `a:${m.version}` };
      } else {
        const skip = fresh;
        fresh = false;
        const [r, own] = await Promise.all([
          fetch(skip ? "/api/jobfair/state?fresh=1" : "/api/jobfair/state", { credentials: "same-origin", cache: skip ? "no-store" : "no-cache" }),
          mine.size ? fetch("/api/jobfair/state/mine", { credentials: "same-origin", cache: "no-store" }) : null,
        ]);
        if (!r.ok || (own && !own.ok)) return;
        d = mergeShared((await r.json()) as Shared, own ? ((await own.json()) as Mine) : null);
      }
      // Who sits at the lounge desks, and whose desk is open: outside the version, it changes by the minute.
      fair.setConsultants(d.consultants ?? [], d.consultBotsOff ?? []);
      // The price list comes with the setup (the price table's own poll is gone).
      if (d.prices && JSON.stringify(cleanPrices(d.prices)) !== JSON.stringify(priceTable())) fair.applyPrices(cleanPrices(d.prices));
      // After the first pull, an admin's unsent edits win; they go up on the next push.
      if (d.key === version || unsent()) return;
      version = d.key;
      fair.applyShared(d.org, d.companies, d.bookings ?? [], d.stalls ?? [], d.placements ?? {});
      const now = local();
      if (d.org) synced.set("org", now.get("org")!);
      for (const id of Object.keys(d.companies)) {
        const k = `company:${id}`;
        if (now.has(k)) synced.set(k, now.get(k)!);
      }
    } catch {
      // Offline: try again next round.
    } finally {
      busy = false;
    }
  };

  const push = async () => {
    // Not before this account's own view has been pulled (see startSharedSync).
    if (busy || version === "") return;
    busy = true;
    try {
      for (const [key, json] of local()) {
        if (!mayPush(key) || synced.get(key) === json) continue;
        const r = await fetch("/api/jobfair/state", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: `{"key":${JSON.stringify(key)},"data":${json}}`,
        });
        if (r.ok) synced.set(key, json);
        else break;
      }
    } catch {
      // Offline: the change stays unsent and goes on the next round.
    } finally {
      busy = false;
    }
  };

  pushNow = push;
  pullNow = pull;
  let pushTimer: ReturnType<typeof setInterval> | null = null;
  pushing = () => {
    pushTimer ??= setInterval(() => void push(), 3_000);
  };
  void pull().then(() => (admin || mine.size > 0) && pushing?.());
  pollVisible(
    () => void pull(),
    () => runtimeConfig().statePollSec,
    { now: false },
  );
}
