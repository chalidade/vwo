// Polling that respects a hidden tab, limits from the server, and the public setup laid under a booth
// account's own documents.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners = new Set<() => void>();
const page = { visibilityState: "visible" as "visible" | "hidden" };
(globalThis as { document?: unknown }).document = {
  get visibilityState() {
    return page.visibilityState;
  },
  addEventListener: (_: string, fn: () => void) => listeners.add(fn),
  removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
};
const show = (v: "visible" | "hidden") => {
  page.visibilityState = v;
  listeners.forEach((fn) => fn());
};

// The game itself isn't needed here.
vi.mock("../src/useFair", () => ({ fair: {} }));

const { pollVisible } = await import("../src/poll");
const { DEFAULT_CONFIG, mergeConfig } = await import("../src/runtime-config");
const { mergeShared } = await import("../src/shared-state");

describe("polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    page.visibilityState = "visible";
  });
  afterEach(() => {
    vi.useRealTimers();
    listeners.clear();
  });

  it("runs every interval while visible, not at all while hidden, and catches up on coming back", () => {
    const fn = vi.fn();
    const stop = pollVisible(fn, () => 60);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
    show("hidden");
    vi.advanceTimersByTime(10 * 60_000);
    expect(fn).toHaveBeenCalledTimes(2);
    show("visible");
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(10 * 60_000);
    show("hidden");
    show("visible");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("a tab flicked away and back within seconds doesn't ask again", () => {
    const fn = vi.fn();
    pollVisible(fn, () => 60);
    vi.advanceTimersByTime(3_000);
    show("hidden");
    show("visible");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("takes a new interval from the server on the next wait", () => {
    const fn = vi.fn();
    let sec = 60;
    pollVisible(fn, () => sec, { now: false });
    sec = 120;
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("one client asks for much less per minute than before", () => {
    // Before: setup 30 s, applications 15 s, stats 30 s (+ send 15 s), progress 45 s, prices 60 s, reviews 60 s, friends 90 s.
    const before = 60 / 30 + 60 / 15 + 60 / 30 + 60 / 15 + 60 / 45 + 60 / 60 + 60 / 60 + 60 / 90;
    const c = DEFAULT_CONFIG;
    // After: prices ride on the setup.
    const after =
      60 / c.statePollSec + 60 / c.applicationsPollSec + 60 / c.statsPollSec + 60 / c.statsSendSec + 60 / c.progressPollSec + 60 / c.reviewsPollSec + 60 / c.friendsPollSec;
    expect(before).toBeCloseTo(16, 0);
    expect(after).toBeLessThan(before / 2);
  });
});

describe("limits from the server", () => {
  it("takes known positive numbers only", () => {
    const c = mergeConfig(DEFAULT_CONFIG, { statePollSec: 30, portalPollSec: -1, friendsPollSec: "5", other: 1 });
    expect(c.statePollSec).toBe(30);
    expect(c.portalPollSec).toBe(DEFAULT_CONFIG.portalPollSec);
    expect(c.friendsPollSec).toBe(DEFAULT_CONFIG.friendsPollSec);
    expect(c).not.toHaveProperty("other");
    expect(mergeConfig(DEFAULT_CONFIG, null)).toEqual(DEFAULT_CONFIG);
  });
});

describe("the shared setup", () => {
  it("lays a booth account's own documents over the public ones, and versions both", () => {
    const pub = { org: null, companies: { a: { invoices: [] }, b: { invoices: [] } }, version: 5 } as never;
    const merged = mergeShared(pub, { companies: { a: { invoices: [{ id: "x" }] } } as never, version: 9 });
    expect((merged.companies as Record<string, { invoices: unknown[] }>).a!.invoices).toHaveLength(1);
    expect((merged.companies as Record<string, { invoices: unknown[] }>).b!.invoices).toHaveLength(0);
    expect(merged.key).toBe("5:9");
    expect(mergeShared(pub, null).key).toBe("5:0");
  });
});
