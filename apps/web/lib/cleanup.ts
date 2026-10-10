import "server-only";
import { cleanupJunk } from "@vwo/db";
import { after } from "next/server";
import { db } from "./db";
import { allow } from "./ratelimit";

/** Now and then (at most every six hours across all servers), clear out expired sessions, old
 *  feed events and other leftovers, after the response has gone so nobody waits for it. */
export function maybeCleanup() {
  if (Math.random() > 0.02) return;
  after(async () => {
    try {
      if (!(await allow("cleanup:all", 1, 6 * 3_600_000))) return;
      const gone = await cleanupJunk(db);
      console.info("cleanup", gone);
    } catch (e) {
      console.warn("cleanup failed", (e as Error).message);
    }
  });
}
