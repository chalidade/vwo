import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveChannel, type LiveSelf, type Transport } from "../src/live";

/** An in-memory realtime service: rooms of peers, counting what each receiver is handed. */
function bus() {
  const rooms = new Map<string, Set<{ id: string; on: Parameters<Transport["connect"]>[0] }>>();
  const delivered = new Map<string, number>();
  const make = (room: string, selfId: string): Transport => {
    let me: { id: string; on: Parameters<Transport["connect"]>[0] } | null = null;
    const members = () => rooms.get(room) ?? rooms.set(room, new Set()).get(room)!;
    return {
      get connected() {
        return !!me;
      },
      async connect(on) {
        me = { id: selfId, on };
        members().add(me);
        on.status("online");
      },
      send(id, text) {
        for (const m of members()) if (m !== me) {
          delivered.set(room, (delivered.get(room) ?? 0) + 1);
          m.on.message(id, text);
        }
      },
      direct(from, to, text) {
        for (const m of members()) if (m.id === to) m.on.direct?.(from, text);
      },
      close(id) {
        this.send(id, "");
        if (me) members().delete(me);
        me = null;
      },
    };
  };
  return { make, delivered };
}

const look = { skin: "#f1c27d" } as never;
const floors = new Set(["f1", "f2"]);

function player(b: ReturnType<typeof bus>, name: string, at: LiveSelf) {
  const seen = new Map<string, { floorId: string; x: number }>();
  const pings: unknown[] = [];
  const self = { ...at };
  const ch = new LiveChannel(
    "jobfair",
    () => self,
    (p) => seen.set(p.id, { floorId: p.floorId, x: p.x }),
    (id) => seen.delete(id),
    (id) => floors.has(id),
    () => {},
    b.make,
    (from, data) => pings.push({ from, data }),
  );
  Object.defineProperty(ch, "id", { value: name });
  ch.start();
  return { ch, self, seen, pings };
}

const at = (floorId: string, x = 5): LiveSelf => ({ name: "x", look, floorId, x, y: 5, facing: "front", seatId: null, say: null });

describe("presence lanes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends steps only to the same floor, while everyone still knows who is where", async () => {
    const b = bus();
    const a = player(b, "aaa", at("f1"));
    const c = player(b, "ccc", at("f1"));
    const d = player(b, "ddd", at("f2"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(a.seen.get("ccc")?.floorId).toBe("f1");
    expect(a.seen.get("ddd")?.floorId).toBe("f2");
    // Walking on floor 1 reaches floor 1 only.
    const before = b.delivered.get("jobfair~f2") ?? 0;
    for (let i = 0; i < 10; i++) {
      a.self.x = 6 + i;
      a.ch.publish();
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(c.seen.get("aaa")?.x).toBe(15);
    expect(d.seen.get("aaa")?.x).toBe(5);
    expect(b.delivered.get("jobfair~f2") ?? 0).toBe(before);
    // Quick messages cross floors through the lobby.
    expect(d.ch.sendTo("aaa", { key: "hi" })).toBe(true);
    expect(a.pings).toEqual([{ from: "ddd", data: { key: "hi" } }]);
  });

  it("follows a peer to another floor and drops one who closes the tab", async () => {
    const b = bus();
    const a = player(b, "aaa", at("f1"));
    const d = player(b, "ddd", at("f2"));
    await vi.advanceTimersByTimeAsync(1500);
    d.self.floorId = "f1";
    d.self.x = 9;
    await vi.advanceTimersByTimeAsync(1200);
    expect(a.seen.get("ddd")).toEqual({ floorId: "f1", x: 9 });
    // Still there well past the floor's stale time: it keeps heartbeating on the floor lane.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(a.seen.has("ddd")).toBe(true);
    d.ch.stop();
    expect(a.seen.has("ddd")).toBe(false);
  });
});
