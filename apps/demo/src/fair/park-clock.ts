// The park's clock: the real time (the park follows Jakarta's day and night). The offline demo can
// be set to another hour to see the night: localStorage "vwo:park-hour" = 0–23. The live site always
// uses the real time, as the server does for the park's anomalies.
import { wibMinute } from "@vwo/shared";
import { LIVE } from "../mode";

function demoOffset() {
  if (LIVE) return 0;
  try {
    const raw = localStorage.getItem("vwo:park-hour");
    if (raw === null || !/^\d{1,2}$/.test(raw) || Number(raw) > 23) return 0;
    const now = Date.now();
    const want = Number(raw) * 60;
    return ((((want - wibMinute(now)) % 1440) + 1440) % 1440) * 60_000;
  } catch {
    return 0;
  }
}

const offset = demoOffset();

/** Now, by the park's clock. */
export const parkNow = () => Date.now() + offset;
