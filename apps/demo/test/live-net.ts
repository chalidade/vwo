// An in-memory realtime service for tests, counting messages the way Supabase bills them:
// a broadcast once when sent and once per receiver, a presence change once per member who
// listens to presence (plus once for the track itself), the member list once to a joiner.
import type { Net, Room, RoomEvents } from "../src/live";

interface Member {
  client: number;
  selfId: string;
  on: RoomEvents;
  presence: boolean;
  tracked: string | null;
  open: boolean;
  closed: boolean;
}

export interface NetStats {
  total: number;
  broadcast: number;
  presence: number;
  direct: number;
  /** Messages by whole second of the (fake) clock. */
  perSecond: Map<number, number>;
  /** Clients connected right now, and the most at once. */
  connections: number;
  peakConnections: number;
}

export function memNet() {
  const rooms = new Map<string, Set<Member>>();
  const boxes = new Map<string, Set<{ client: number; fn: (from: string, text: string) => void }>>();
  const stats: NetStats = { total: 0, broadcast: 0, presence: 0, direct: 0, perSecond: new Map(), connections: 0, peakConnections: 0 };
  const uses = new Map<number, number>();
  let clients = 0;

  const count = (kind: "broadcast" | "presence" | "direct", n: number) => {
    if (n <= 0) return;
    stats[kind] += n;
    stats.total += n;
    const sec = Math.floor(Date.now() / 1000);
    stats.perSecond.set(sec, (stats.perSecond.get(sec) ?? 0) + n);
  };
  const use = (client: number, d: number) => {
    const n = (uses.get(client) ?? 0) + d;
    uses.set(client, n);
    stats.connections = [...uses.values()].filter((x) => x > 0).length;
    stats.peakConnections = Math.max(stats.peakConnections, stats.connections);
  };
  const members = (room: string) => rooms.get(room) ?? rooms.set(room, new Set()).get(room)!;
  const roster = (room: string) => {
    const out = new Map<string, string>();
    for (const m of members(room)) if (m.tracked !== null) out.set(m.selfId, m.tracked);
    return out;
  };
  /** Someone's line in the member list changed: everyone listening to presence hears it. */
  const presenceChanged = (room: string, sent: boolean) => {
    const listeners = [...members(room)].filter((m) => m.presence);
    count("presence", (sent ? 1 : 0) + listeners.length);
    const list = roster(room);
    for (const m of listeners) m.on.roster?.(new Map(list));
  };

  /** One device: its own connection (counted while any room or inbox is open on it). */
  function client(): Net {
    const id = ++clients;
    return {
      join(room: string, selfId: string, on: RoomEvents, presence: boolean): Room {
        const me: Member = { client: id, selfId, on, presence, tracked: null, open: false, closed: false };
        use(id, 1);
        setTimeout(() => {
          if (me.closed) return;
          me.open = true;
          members(room).add(me);
          on.status("online");
          if (presence) {
            count("presence", 1);
            on.roster?.(roster(room));
          }
          if (me.tracked !== null) presenceChanged(room, true);
        }, 0);
        return {
          get connected() {
            return me.open;
          },
          send(text: string) {
            if (!me.open) return;
            const others = [...members(room)].filter((m) => m !== me);
            count("broadcast", 1 + others.length);
            for (const m of others) m.on.message(selfId, text);
          },
          track(text: string) {
            me.tracked = text;
            if (me.open) presenceChanged(room, true);
          },
          close() {
            if (me.closed) return;
            me.closed = true;
            use(id, -1);
            if (!me.open) return;
            me.open = false;
            members(room).delete(me);
            if (me.tracked !== null) presenceChanged(room, false);
          },
        };
      },
      inbox(address: string, fn: (from: string, text: string) => void) {
        const entry = { client: id, fn };
        const set = boxes.get(address) ?? boxes.set(address, new Set()).get(address)!;
        set.add(entry);
        use(id, 1);
        return () => {
          if (set.delete(entry)) use(id, -1);
        };
      },
      direct(address: string, from: string, text: string) {
        const set = [...(boxes.get(address) ?? [])];
        count("direct", 1 + set.length);
        for (const b of set) b.fn(from, text);
      },
    };
  }

  return { client, stats };
}
