import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for Supabase Realtime: channels by name, and every broadcast this client sends.
const sent: { channel: string; payload: unknown }[] = [];
const handlers = new Map<string, (m: { payload: unknown }) => void>();
vi.mock("../src/realtime", () => ({
  hasRealtime: () => true,
  realtimeClient: async () => ({
    channel(name: string) {
      const ch = {
        on(_t: string, _f: unknown, fn: (m: { payload: unknown }) => void) {
          handlers.set(name, fn);
          return ch;
        },
        subscribe(cb: (s: string) => void) {
          cb("SUBSCRIBED");
          return ch;
        },
        async send(m: { payload: unknown }) {
          sent.push({ channel: name, payload: m.payload });
        },
        async unsubscribe() {
          handlers.delete(name);
        },
      };
      return ch;
    },
    async removeChannel(ch: { unsubscribe(): Promise<void> }) {
      await ch.unsubscribe();
    },
  }),
  openChannel: async (sb: { channel(n: string): unknown }, name: string) => sb.channel(name),
  closeChannel: (sb: { removeChannel(c: unknown): Promise<void> }, _name: string, ch: unknown) => void sb.removeChannel(ch),
}));

const { listenForCalls, newCallId, onSignal, sendSignal } = await import("../src/fair/call");
const flush = () => new Promise((r) => setTimeout(r, 0));
const ring = (to: string, callId = newCallId()) =>
  ({ type: "ring", callId, to, appId: "a1", company: "Nusantara Tech", logo: "", color: "#000", recruiter: "Bima", jobTitle: "QA", kind: "voice" }) as const;

describe("calls between devices", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("rings the callee's inbox and sends the rest of the call on the call's own channel", async () => {
    const r = ring("user:b");
    sendSignal(r);
    await flush();
    expect(sent).toEqual([{ channel: "jobfair:inbox:user:b", payload: r }]);
    expect(handlers.has(`jobfair:call:${r.callId}`)).toBe(true);
    sendSignal({ type: "accept", callId: r.callId });
    await flush();
    expect(sent.at(-1)).toEqual({ channel: `jobfair:call:${r.callId}`, payload: { type: "accept", callId: r.callId } });
  });

  it("hears rings only on its own inbox, then follows that call", async () => {
    const got: unknown[] = [];
    const off = onSignal((s) => got.push(s));
    const stop = listenForCalls(["user:me"]);
    await flush();
    const r = ring("user:me");
    handlers.get("jobfair:inbox:user:me")!({ payload: r });
    handlers.get("jobfair:inbox:user:me")!({ payload: ring("user:someone-else") });
    handlers.get("jobfair:inbox:user:me")!({ payload: { type: "ring", callId: "../../etc" } });
    await flush();
    expect(got).toEqual([r]);
    handlers.get(`jobfair:call:${r.callId}`)!({ payload: { type: "hangup", callId: r.callId } });
    expect(got.at(-1)).toEqual({ type: "hangup", callId: r.callId });
    stop();
    off();
  });

  it("makes call ids nobody can guess", () => {
    expect(newCallId()).toMatch(/^call-[0-9a-f-]{36}$/);
    expect(newCallId()).not.toBe(newCallId());
  });
});
