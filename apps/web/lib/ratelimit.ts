import "server-only";

// Fixed-window counters kept in this process. Enough for one instance; with several instances
// behind the load balancer this moves to Redis (see the go-live checklist).
const windows = new Map<string, { count: number; resetAt: number }>();

/** True when `key` may do one more action: at most `limit` per `windowMs`. */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 50_000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}
