// Live site: the event setup (organiser's changes, every company's booth) is kept on the server,
// so the panitia, the companies and the job seekers all see the same event on every device.
// Everyone pulls it; event admins push what they change here, and company accounts their own booth.
import type { BookedBooth, CompanyState, OrgState, RentedStall } from "./jobfair-engine";
import { fair } from "./useFair";

type Shared = { org: OrgState | null; companies: Record<string, CompanyState>; bookings?: BookedBooth[]; stalls?: RentedStall[]; version: number };

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

/** Take the server's setup on the next pull, whatever this browser last applied. */
export function refreshShared() {
  version = -1;
  void pullNow?.();
}

let pending = () => false;
/** The server setup's version this browser has applied; -1 takes the next pull whatever it says. */
let version = -1;
const mayPush = (key: string) => admin || (key.startsWith("company:") && mine.has(key.slice("company:".length)));

/** Start pulling the setup; event admins and company accounts also push their changes. Safe to call again. */
export function startSharedSync(asAdmin: boolean, booths: string[] = []) {
  const more = booths.some((b) => !mine.has(b));
  booths.forEach((b) => mine.add(b));
  if ((asAdmin && !admin) || more) {
    admin ||= asAdmin;
    // What the server shows this account just widened (booth invoices, PINs): take it on the next pull.
    version = -1;
    pushing?.();
  }
  if (started) return;
  started = true;
  // What the server has, as this browser last saw or sent it, per key.
  const synced = new Map<string, string>();
  let busy = false;

  const local = () => {
    const s = fair.sharedState();
    const m = new Map<string, string>([["org", JSON.stringify(s.org)]]);
    for (const [id, c] of Object.entries(s.companies)) m.set(`company:${id}`, JSON.stringify(c));
    return m;
  };
  const unsent = () => version >= 0 && [...local()].some(([k, v]) => mayPush(k) && synced.get(k) !== v);
  pending = () => [...local()].some(([k, v]) => mayPush(k) && synced.get(k) !== v);

  const pull = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await fetch("/api/jobfair/state", { credentials: "same-origin" });
      if (!r.ok) return;
      const d = (await r.json()) as Shared;
      // After the first pull, an admin's unsent edits win; they go up on the next push.
      if (d.version === version || unsent()) return;
      version = d.version;
      fair.applyShared(d.org, d.companies, d.bookings ?? [], d.stalls ?? []);
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
    if (busy) return;
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
  setInterval(() => void pull(), 30_000);
}
