// Live site: the event setup (organiser's changes, every company's booth) is kept on the server,
// so the panitia, the companies and the job seekers all see the same event on every device.
// Everyone pulls it; event admins also push what they change here.
import type { CompanyState, OrgState } from "./jobfair-engine";
import { fair } from "./useFair";

type Shared = { org: OrgState | null; companies: Record<string, CompanyState>; version: number };

let started = false;
let admin = false;
let pushing: (() => void) | null = null;

/** Start pulling the setup; with `asAdmin`, also push this browser's changes. Safe to call again. */
export function startSharedSync(asAdmin: boolean) {
  if (asAdmin && !admin) {
    admin = true;
    pushing?.();
  }
  if (started) return;
  started = true;
  // What the server has, as this browser last saw or sent it, per key.
  const synced = new Map<string, string>();
  let version = -1;
  let busy = false;

  const local = () => {
    const s = fair.sharedState();
    const m = new Map<string, string>([["org", JSON.stringify(s.org)]]);
    for (const [id, c] of Object.entries(s.companies)) m.set(`company:${id}`, JSON.stringify(c));
    return m;
  };
  const unsent = () => admin && version >= 0 && [...local()].some(([k, v]) => synced.get(k) !== v);

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
      fair.applyShared(d.org, d.companies);
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
        if (synced.get(key) === json) continue;
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

  let pushTimer: ReturnType<typeof setInterval> | null = null;
  pushing = () => {
    pushTimer ??= setInterval(() => void push(), 3_000);
  };
  void pull().then(() => admin && pushing?.());
  setInterval(() => void pull(), 30_000);
}
