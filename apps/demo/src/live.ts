// Meeting real people on other devices. How the messages travel is a swappable network: a public
// MQTT broker for the GitHub Pages demo, Supabase Realtime for the live site, and our own server
// once the event moves to DigitalOcean. Only a nickname, the character's look, where they stand
// and walk, and a short speech bubble are ever sent, and every message is checked.
//
// Built to stay inside a small realtime plan (Supabase Free: 200 connections, 100 messages a
// second, each broadcast counted once per receiver):
// - only the floor the player is on is joined, and a busy floor is split into channels ("shards")
//   of at most `floorCap` people, so one message never fans out to the whole fair;
// - who is on a channel comes from presence: one message when someone joins or leaves, no heartbeats;
// - walking is sent as intents (the route and the speed, once), and every device walks the
//   player along it by itself; channels share one message allowance (see live-budget.ts);
// - a newcomer gets everyone's whereabouts in one message from one peer, not a reply from each;
// - quick messages go to the receiver's own inbox, not past everyone else;
// - friends hear which floor each other is on through their inboxes, a few messages per visit.
import type { MqttClient } from "mqtt";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "./mode";
import { closeChannel, hasRealtime, openChannel, realtimeClient } from "./realtime";
import { listenForCalls, onInbox, toInbox } from "./fair/call";
import { ChatLimit, nextShard, ShardBudget, shardRate } from "./live-budget";
import { decodeMove, encodeMove, type Motion, type MoveIntent, motionAt, type Pt, startMotion } from "./live-motion";
import { DEFAULT_CONFIG, type LiveConfig } from "./runtime-config";
import type { Facing } from "@vwo/shared";
import type { Look } from "@vwo/ui";
import type { RemotePlayer } from "./jobfair-engine";

const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];
const TOPIC = "vwo-demo/v2";
/** How long to wait for a channel's member list before treating it as empty. */
const ROSTER_WAIT_MS = 2500;
/** Friends tell each other where they are this often, and are forgotten after this long without word. */
const BEACON_MS = 4 * 60_000;
const FRIEND_STALE_MS = 9 * 60_000;
const MAX_BEACON_FRIENDS = 10;

/**
 * - connecting / online / offline: the network's state;
 * - solo: the organiser switched players-online off (LIVE_ENABLED=0);
 * - full: more people online than LIVE_MAX_CONNECTIONS, so this visit is played solo.
 */
export type LiveStatus = "connecting" | "online" | "offline" | "solo" | "full";

export interface LiveSelf {
  name: string;
  look: Look;
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
  seatId: string | null;
  say: string | null;
  /** Bought the blue check. A demo badge: on a public broker anyone could claim it. */
  verified?: boolean;
  /** The account's public fair tag, so others can add them as a friend. */
  tag?: string | null;
  /** The rest of a clicked route, when walking one. */
  route?: Pt[] | null;
  /** The seat at the end of that route. */
  routeSeat?: string | null;
  /** Steering with the keys: tiles per second on each axis. */
  vel?: Pt | null;
  /** Walking speed along a route, tiles per second. */
  speed?: number;
}

interface Wire {
  v: 1;
  id: string;
  name: string;
  look: Look;
  floorId: string;
  x: number;
  y: number;
  facing: Facing;
  seatId: string | null;
  say: string | null;
  verified?: boolean;
  tag?: string | null;
  /** When they joined this channel (their clock): the longest-standing member greets newcomers. */
  j?: number;
  /** How many people they heard were online, so everyone's share of the budget follows the crowd. */
  n?: number;
}

const FACINGS = new Set<Facing>(["front", "back", "left", "right"]);
const SAFE = /^[#\w-]{1,24}$/;
const TAG = /^[0-9a-f]{12}$/;
const clean = (s: string, n: number) => s.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, n);

/** Accept only well-formed messages: anyone can publish on a public broker. */
export function parseWire(raw: string, knownFloor: (id: string) => boolean): (RemotePlayer & { look: Look }) | null {
  let m: Partial<Wire>;
  try {
    m = JSON.parse(raw) as Partial<Wire>;
  } catch {
    return null;
  }
  if (!m || m.v !== 1 || typeof m.id !== "string" || !SAFE.test(m.id)) return null;
  if (typeof m.name !== "string" || typeof m.floorId !== "string" || !knownFloor(m.floorId)) return null;
  if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || !FACINGS.has(m.facing as Facing)) return null;
  if (!m.look || typeof m.look !== "object") return null;
  const look: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(m.look)) {
    if (!/^[a-zA-Z]{1,16}$/.test(k)) continue;
    if (typeof v === "boolean" || (typeof v === "string" && SAFE.test(v))) look[k] = v;
  }
  return {
    id: m.id,
    name: clean(m.name, 200).replace(/\s+/g, " ").trim().slice(0, 20) || "Tamu",
    floorId: m.floorId,
    x: Math.min(200, Math.max(0, m.x!)),
    y: Math.min(200, Math.max(0, m.y!)),
    facing: m.facing as Facing,
    seatId: typeof m.seatId === "string" && /^[\w-]{1,80}$/.test(m.seatId) ? m.seatId : null,
    say: typeof m.say === "string" ? clean(m.say, 60) : null,
    verified: m.verified === true,
    tag: typeof m.tag === "string" && TAG.test(m.tag) ? m.tag : null,
    look: look as unknown as Look,
  };
}

/** The join time and crowd size a member put in their presence. */
function wireExtras(raw: string): { j: number; n: number } {
  try {
    const m = JSON.parse(raw) as { j?: unknown; n?: unknown };
    return { j: Number.isFinite(m.j) ? (m.j as number) : Infinity, n: Number.isFinite(m.n) ? Math.min(100_000, Math.max(0, m.n as number)) : 0 };
  } catch {
    return { j: Infinity, n: 0 };
  }
}

function json(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function peerId() {
  try {
    const saved = sessionStorage.getItem("vwo:peer");
    if (saved && SAFE.test(saved)) return saved;
    const id = Math.random().toString(36).slice(2, 12);
    sessionStorage.setItem("vwo:peer", id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

// --- The network.

export interface RoomEvents {
  status(s: "connecting" | "online" | "offline"): void;
  /** A broadcast from another member. */
  message(from: string, text: string): void;
  /** Everyone in the room (peer id → what they tracked, us included), after every change. Presence rooms only. */
  roster?(members: Map<string, string>): void;
}

/** One channel: broadcasts to its members, and presence (who is in it, gone when their connection drops). */
export interface Room {
  readonly connected: boolean;
  send(text: string): void;
  /** Be listed in the room with this text, until the room is closed. */
  track(text: string): void;
  close(): void;
}

export interface Net {
  /** Join a room. Without `presence` we can still be listed (track) but hear nobody's comings and goings. */
  join(room: string, selfId: string, on: RoomEvents, presence: boolean): Room;
  /** Messages sent to this address only. Returns a function that stops listening. */
  inbox(address: string, on: (from: string, text: string) => void): () => void;
  direct(address: string, from: string, text: string): void;
}

/** A test or a private broker can be picked with ?live=ws://host:port in the page URL. */
function brokers() {
  try {
    const custom = new URLSearchParams(location.search).get("live");
    if (custom && /^wss?:\/\//.test(custom)) return [custom];
  } catch {
    // Default brokers.
  }
  return BROKERS;
}

/** One MQTT connection, moving on to the next public broker if one refuses us. */
function mqttConnect(
  selfId: string,
  will: { topic: string; payload: string; retain: boolean } | undefined,
  on: { connect(c: MqttClient): void; message(topic: string, text: string): void; offline(): void },
) {
  let client: MqttClient | null = null;
  let stopped = false;
  let index = 0;
  const open = async () => {
    // Loaded on demand: the MQTT client is as big as the rest of the demo.
    const { default: mqtt } = await import("mqtt");
    if (stopped) return;
    const list = brokers();
    const c = mqtt.connect(list[index % list.length]!, {
      clientId: `vwo_${selfId}_${Math.random().toString(36).slice(2, 6)}`,
      clean: true,
      keepalive: 30,
      connectTimeout: 8000,
      reconnectPeriod: 4000,
      will: will && { ...will, qos: 0 },
    });
    client = c;
    c.on("connect", () => on.connect(c));
    c.on("message", (topic, payload) => on.message(topic, new TextDecoder().decode(payload)));
    c.on("offline", on.offline);
    c.on("error", () => {
      if (!c.connected && list.length > 1) {
        c.end(true);
        index++;
        void open();
      }
    });
  };
  void open();
  return {
    get client() {
      return client;
    },
    end(last?: { topic: string; payload: string; retain: boolean }) {
      stopped = true;
      const c = client;
      client = null;
      if (c?.connected && last) c.publish(last.topic, last.payload, { qos: 0, retain: last.retain }, () => c.end());
      else c?.end(true);
    },
  };
}

/** The demo's room: broadcasts on a topic per sender, presence as retained messages cleared by the broker's last will. */
class MqttRoom implements Room {
  private readonly base: string;
  private readonly conn: ReturnType<typeof mqttConnect>;
  private members = new Map<string, string>();
  private settled = false;
  private tracked: string | null = null;
  private refresh: ReturnType<typeof setInterval> | null = null;
  constructor(
    room: string,
    private readonly selfId: string,
    private readonly on: RoomEvents,
    private readonly presence: boolean,
  ) {
    this.base = `${TOPIC}/${room}`;
    const mine = `${this.base}/m/${selfId}`;
    this.conn = mqttConnect(
      selfId,
      { topic: mine, payload: "", retain: true },
      {
        connect: (c) => {
          c.subscribe(`${this.base}/b/+`, { qos: 0 });
          if (presence) c.subscribe(`${this.base}/m/+`, { qos: 0 });
          this.publishTracked();
          on.status("online");
          // Retained members arrive straight after subscribing; then the list is complete.
          if (presence && !this.settled)
            setTimeout(() => {
              this.settled = true;
              this.emit();
            }, 700);
        },
        message: (topic, text) => {
          const id = topic.slice(topic.lastIndexOf("/") + 1);
          if (!SAFE.test(id)) return;
          if (topic.startsWith(`${this.base}/b/`)) {
            if (id !== this.selfId && text) on.message(id, text);
            return;
          }
          if (!topic.startsWith(`${this.base}/m/`)) return;
          // A member's retained line, refreshed every minute; one left behind by a vanished client goes stale.
          const m = text ? json(text) : null;
          if (m && typeof m.s === "string" && typeof m.at === "number" && Date.now() - m.at < 180_000) this.members.set(id, m.s);
          else this.members.delete(id);
          if (this.settled) this.emit();
        },
        offline: () => on.status("offline"),
      },
    );
  }

  private emit() {
    this.on.roster?.(new Map(this.members));
  }

  private publishTracked() {
    const c = this.conn.client;
    if (c?.connected && this.tracked !== null) c.publish(`${this.base}/m/${this.selfId}`, JSON.stringify({ at: Date.now(), s: this.tracked }), { qos: 0, retain: true });
  }

  get connected() {
    return !!this.conn.client?.connected;
  }

  send(text: string) {
    this.conn.client?.publish(`${this.base}/b/${this.selfId}`, text, { qos: 0 });
  }

  track(text: string) {
    this.tracked = text;
    this.publishTracked();
    this.refresh ??= setInterval(() => this.publishTracked(), 60_000);
  }

  close() {
    if (this.refresh) clearInterval(this.refresh);
    this.conn.end(this.tracked !== null ? { topic: `${this.base}/m/${this.selfId}`, payload: "", retain: true } : undefined);
  }
}

/** The demo's network: a public MQTT broker. */
class MqttNet implements Net {
  private hub: ReturnType<typeof mqttConnect> | null = null;
  private boxes = new Map<string, (from: string, text: string) => void>();

  private connectHub() {
    this.hub ??= mqttConnect(Math.random().toString(36).slice(2, 10), undefined, {
      connect: (c) => {
        for (const a of this.boxes.keys()) c.subscribe(`${TOPIC}/i/${a}`, { qos: 0 });
      },
      message: (topic, text) => {
        const fn = this.boxes.get(topic.slice(`${TOPIC}/i/`.length));
        const m = json(text);
        if (fn && m && typeof m.from === "string" && typeof m.t === "string" && m.t.length < 8000) fn(m.from, m.t);
      },
      offline: () => {},
    });
    return this.hub;
  }

  join(room: string, selfId: string, on: RoomEvents, presence: boolean): Room {
    return new MqttRoom(room, selfId, on, presence);
  }

  inbox(address: string, on: (from: string, text: string) => void) {
    this.boxes.set(address, on);
    const hub = this.connectHub();
    hub.client?.subscribe(`${TOPIC}/i/${address}`, { qos: 0 });
    return () => {
      this.boxes.delete(address);
      hub.client?.unsubscribe(`${TOPIC}/i/${address}`);
    };
  }

  direct(address: string, from: string, text: string) {
    const c = this.connectHub().client;
    if (c?.connected) c.publish(`${TOPIC}/i/${address}`, JSON.stringify({ from, t: text }), { qos: 0 });
  }
}

/** Members of a Supabase presence channel, by key, with the text each one tracked. */
function rosterOf(state: Record<string, unknown[]>) {
  const out = new Map<string, string>();
  for (const [key, metas] of Object.entries(state)) {
    const s = (metas[0] as { s?: unknown } | undefined)?.s;
    if (SAFE.test(key) && typeof s === "string" && s.length < 4000) out.set(key, s);
  }
  return out;
}

/** The live site's room: one Supabase Realtime channel with broadcast and presence. */
class SupabaseRoom implements Room {
  private ch: RealtimeChannel | null = null;
  private sb: SupabaseClient | null = null;
  private ready = false;
  private closed = false;
  private tracked: string | null = null;
  private readonly topic: string;
  constructor(
    room: string,
    private readonly selfId: string,
    private readonly on: RoomEvents,
    private readonly presence: boolean,
  ) {
    this.topic = `jobfair:${room}`;
    void this.open();
  }

  private async open() {
    const sb = await realtimeClient();
    if (this.closed) return;
    if (!sb) return this.on.status("offline");
    this.sb = sb;
    const ch = await openChannel(sb, this.topic, { config: { broadcast: { self: false }, presence: { key: this.selfId, enabled: this.presence } } });
    if (this.closed) return closeChannel(sb, this.topic, ch);
    ch.on("broadcast", { event: "p" }, (m: { payload?: { id?: unknown; t?: unknown } }) => {
      const { id, t } = m.payload ?? {};
      if (typeof id === "string" && SAFE.test(id) && typeof t === "string" && t.length < 4000) this.on.message(id, t);
    });
    if (this.presence) ch.on("presence", { event: "sync" }, () => this.on.roster?.(rosterOf(ch.presenceState() as Record<string, unknown[]>)));
    ch.subscribe((status: string) => {
      this.ready = status === "SUBSCRIBED";
      if (this.ready && this.tracked !== null) void ch.track({ s: this.tracked });
      this.on.status(this.ready ? "online" : status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "offline" : "connecting");
    });
    this.ch = ch;
  }

  get connected() {
    return this.ready;
  }

  send(text: string) {
    if (this.ready) void this.ch?.send({ type: "broadcast", event: "p", payload: { id: this.selfId, t: text } });
  }

  track(text: string) {
    this.tracked = text;
    if (this.ready) void this.ch?.track({ s: text });
  }

  close() {
    this.closed = true;
    this.ready = false;
    // Removed, not just left: walking back onto this floor later joins the same topic afresh.
    if (this.ch && this.sb) closeChannel(this.sb, this.topic, this.ch);
    this.ch = null;
  }
}

/** The live site's network: Supabase Realtime, with each address's inbox shared with incoming calls (fair/call.ts). */
class SupabaseNet implements Net {
  join(room: string, selfId: string, on: RoomEvents, presence: boolean): Room {
    return new SupabaseRoom(room, selfId, on, presence);
  }

  inbox(address: string, on: (from: string, text: string) => void) {
    const off = onInbox((to, from, text) => to === address && on(from, text));
    const stop = listenForCalls([address]);
    return () => {
      off();
      stop();
    };
  }

  direct(address: string, from: string, text: string) {
    void toInbox(address, "d", { from, t: text });
  }
}

/** Picks the network for this build: Supabase on the live site, the public broker in the demo. */
export function pickNet(): Net | null {
  if (!LIVE) return new MqttNet();
  return hasRealtime() ? new SupabaseNet() : null;
}

// --- The fair's presence.

interface Peer {
  id: string;
  meta: RemotePlayer & { look: Look };
  /** On our floor channel, or a friend elsewhere we only hear about now and then. */
  via: "shard" | "friend";
  floorId: string;
  /** Where they are drawn. */
  x: number;
  y: number;
  facing: Facing;
  seatId: string | null;
  motion: Motion | null;
  /** A friend's floor channel, and when we last heard from them. */
  shard?: number;
  heard?: number;
}

interface Shard {
  floorId: string;
  index: number;
  room: Room;
  members: Map<string, string>;
  /** Our first member list on this channel has come in (everyone in it is new to us, not to them). */
  synced: boolean;
  joinedAt: number;
}

export interface LiveOptions {
  room: string;
  self: () => LiveSelf | null;
  onPeer: (p: RemotePlayer & { look: Look }) => void;
  onGone: (id: string) => void;
  knownFloor: (id: string) => boolean;
  onStatus: (s: LiveStatus, peers: number) => void;
  /** A quick message from a peer we can see (anything from strangers is dropped). */
  onDirect?: (from: string, data: unknown) => void;
  /** Tags of mutual friends, to tell them which floor we are on. */
  friends?: () => string[];
  net?: Net | null;
  config?: LiveConfig;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export class LiveChannel {
  readonly id = peerId();
  status: LiveStatus = "connecting";
  private readonly net: Net | null;
  private readonly cfg: LiveConfig;
  private active = false;
  private stopped = false;
  private gen = 0;
  private floor: string | null = null;
  private shard: Shard | null = null;
  private probes = new Map<number, Room>();
  /** The latest member list of each channel we are looking at. */
  private probeRosters = new Map<Room, Map<string, string>>();
  private peers = new Map<string, Peer>();
  private budget = new ShardBudget();
  private chat: ChatLimit;
  /** People online when we arrived (the counter channel), for our share of the budget. */
  private online = 0;
  private counter: Room | null = null;
  private stopInbox: (() => void) | null = null;
  private tagBox: { tag: string; stop: () => void } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** What we last told our channel (a signature of it), and when. */
  private sentSig = "";
  private sent: MoveIntent | null = null;
  private sentAt = 0;
  private wantMove = false;
  private lastSay = "";
  private wantSay: string | null = null;
  private trackedSig = "";
  private beaconAt = 0;
  private beaconed = false;
  private replied = new Map<string, number>();

  constructor(private readonly o: LiveOptions) {
    this.net = o.net === undefined ? pickNet() : o.net;
    this.cfg = o.config ?? DEFAULT_CONFIG.live;
    this.chat = new ChatLimit(this.cfg.chatPerMin);
  }

  /** Peers we know about right now. */
  get peerCount() {
    return this.peers.size;
  }

  start() {
    if (!this.net) return this.setStatus("offline");
    if (!this.cfg.enabled) return this.setStatus("solo");
    void this.begin(this.net);
  }

  private async begin(net: Net) {
    if (this.cfg.maxConnections > 0) {
      const n = await this.countOnline(net);
      if (this.stopped) return;
      if (n !== null && n >= this.cfg.maxConnections) return this.setStatus("full");
      this.online = (n ?? 0) + 1;
      // Be counted, without hearing every arrival and departure at the fair.
      this.counter = net.join(`${this.o.room}:online`, this.id, { status: () => {}, message: () => {} }, false);
      this.counter.track("1");
    }
    this.active = true;
    this.stopInbox = net.inbox(`peer:${this.id}`, (from, text) => this.direct(from, text));
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  /** How many are online, from a look at the counter channel's member list (null: could not tell). */
  private countOnline(net: Net) {
    return new Promise<number | null>((resolve) => {
      let done = false;
      let room: Room | null = null;
      const finish = (n: number | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        // Leave before being counted ourselves: hearing every arrival and departure would cost a message each.
        room?.close();
        resolve(n);
      };
      const timer = setTimeout(() => finish(null), ROSTER_WAIT_MS + 500);
      room = net.join(`${this.o.room}:online`, this.id, { status: (s) => s === "offline" && finish(null), message: () => {}, roster: (m) => finish(m.size) }, true);
      if (done) room.close();
    });
  }

  private setStatus(s: LiveStatus) {
    this.status = s;
    this.o.onStatus(s, this.peers.size);
  }

  // --- Floors and their channels.

  private topic(floorId: string, index: number) {
    return `${this.o.room}~${floorId}~s${index}`;
  }

  /** Leave the old floor's channel and find a channel with room on the new one. */
  private goToFloor(floorId: string) {
    this.floor = floorId;
    const gen = ++this.gen;
    this.leaveShard();
    this.closeProbes();
    if (!this.active || !this.net) return;
    const counts = new Map<number, number>();
    const step = () => {
      if (gen !== this.gen) return;
      const friend = [...this.peers.values()].find((p) => p.via === "friend" && p.floorId === floorId && p.shard !== undefined);
      const next = nextShard(counts, this.cfg.floorCap, friend?.shard ?? -1);
      if ("pick" in next) return this.joinShard(floorId, next.pick);
      const i = next.probe;
      let answered = false;
      const answer = (m: Map<string, string> | null) => {
        if (answered || gen !== this.gen) return;
        answered = true;
        counts.set(i, m ? [...m.keys()].filter((k) => k !== this.id).length : 0);
        step();
      };
      setTimeout(() => answer(null), ROSTER_WAIT_MS);
      this.probes.set(i, this.openShardRoom(floorId, i, answer));
    };
    step();
  }

  /** A floor channel; until it becomes ours, its first member list answers a look (`probe`). */
  private openShardRoom(floorId: string, index: number, probe: (m: Map<string, string> | null) => void) {
    const room: Room = this.net!.join(
      this.topic(floorId, index),
      this.id,
      {
        status: (s) => {
          // The room tracks us again by itself after a reconnect.
          if (this.shard?.room === room) this.setStatus(s);
          else if (s === "offline") probe(null);
        },
        message: (from, text) => this.shard?.room === room && this.receive(from, text),
        roster: (m) => {
          if (this.shard?.room === room) return this.setRoster(m);
          this.probeRosters.set(room, m);
          probe(m);
        },
      },
      true,
    );
    return room;
  }

  private joinShard(floorId: string, index: number) {
    let room = this.probes.get(index);
    this.probes.delete(index);
    const roster = room && this.probeRosters.get(room);
    this.closeProbes();
    room ??= this.openShardRoom(floorId, index, () => {});
    this.shard = { floorId, index, room, members: new Map(), synced: false, joinedAt: Date.now() };
    this.budget.clear();
    // Standing still, our line in the member list already says where we are.
    const me = this.o.self();
    this.sentSig = me && !me.route?.length && !me.vel ? this.sigOf(me) : "";
    this.sent = null;
    // Who was there while we looked; the list with us on it follows the track.
    if (roster) this.setRoster(roster);
    this.retrack(true);
    if (room.connected) this.setStatus("online");
    this.beacon(!this.beaconed);
  }

  private leaveShard() {
    const s = this.shard;
    if (!s) return;
    this.shard = null;
    s.room.close();
    // Friends stay where we last saw them until they tell us otherwise; everyone else on that floor is gone from view.
    const friends = new Set(this.o.friends?.() ?? []);
    const now = Date.now();
    for (const p of [...this.peers.values()]) {
      if (p.via !== "shard") continue;
      if (!p.meta.tag || !friends.has(p.meta.tag)) {
        this.drop(p.id);
        continue;
      }
      if (p.motion) {
        const r = motionAt(p.motion, now + 60_000);
        Object.assign(p, { x: r.x, y: r.y, facing: r.facing, seatId: r.seatId });
      }
      Object.assign(p, { via: "friend", motion: null, heard: now, shard: s.index });
      this.show(p);
    }
  }

  private closeProbes() {
    for (const r of this.probes.values()) r.close();
    this.probes.clear();
    this.probeRosters.clear();
  }

  /** Our line in the channel's member list: who we are and where we stand. Sent again only when that changes. */
  private retrack(force = false) {
    const me = this.o.self();
    const s = this.shard;
    if (!me || !s) return;
    const sig = JSON.stringify([me.name, me.look, me.tag ?? null, !!me.verified]);
    if (!force && sig === this.trackedSig) return;
    this.trackedSig = sig;
    s.room.track(this.wire(me, { j: s.joinedAt, n: this.crowd() }));
  }

  private wire(me: LiveSelf, extra: Partial<Wire> = {}) {
    const w: Wire = {
      v: 1,
      id: this.id,
      name: me.name,
      look: me.look,
      floorId: me.floorId,
      x: Math.round(me.x * 100) / 100,
      y: Math.round(me.y * 100) / 100,
      facing: me.facing,
      seatId: me.seatId,
      say: null,
      verified: !!me.verified,
      tag: me.tag ?? null,
      ...extra,
    };
    return JSON.stringify(w);
  }

  /** People we believe are online: what we counted on arrival, or what newer arrivals heard. */
  private crowd() {
    let n = this.online;
    const s = this.shard;
    if (s) {
      n = Math.max(n, s.members.size);
      for (const [id, text] of s.members) if (id !== this.id) n = Math.max(n, wireExtras(text).n);
    }
    return n;
  }

  private setRoster(m: Map<string, string>) {
    const s = this.shard;
    if (!s) return;
    const prev = s.members;
    const first = !s.synced;
    s.members = m;
    s.synced = true;
    const fresh: string[] = [];
    for (const [id, text] of m) {
      if (id === this.id) continue;
      const p = parseWire(text, this.o.knownFloor);
      if (!p || p.id !== id) continue;
      const known = this.peers.get(id);
      if (known?.via === "shard") {
        // Name or look changed: keep where we draw them.
        known.meta = p;
        this.show(known);
        continue;
      }
      const peer: Peer = { id, meta: p, via: "shard", floorId: s.floorId, x: p.x, y: p.y, facing: p.facing, seatId: p.seatId, motion: null };
      this.peers.set(id, peer);
      this.show(peer);
      if (!prev.has(id)) fresh.push(id);
    }
    for (const p of [...this.peers.values()]) if (p.via === "shard" && !m.has(p.id)) this.drop(p.id);
    // The longest-standing member brings newcomers up to date: one message to each, from one peer.
    if (!first && fresh.length) {
      let oldest: { id: string; j: number } | null = null;
      for (const [id, text] of m) {
        if (fresh.includes(id)) continue;
        const j = id === this.id ? s.joinedAt : wireExtras(text).j;
        if (!oldest || j < oldest.j || (j === oldest.j && id < oldest.id)) oldest = { id, j };
      }
      if (oldest?.id === this.id) for (const id of fresh) this.snapshotTo(id);
    }
    this.o.onStatus(this.status, this.peers.size);
  }

  /** Everyone on our channel who is walking (us included), as they are now, to a newcomer's inbox. */
  private snapshotTo(id: string) {
    const me = this.o.self();
    if (!me || !this.net) return;
    const now = Date.now();
    const ps: unknown[] = [{ id: this.id, m: encodeMove(this.intentOf(me)), e: 0 }];
    for (const p of this.peers.values()) {
      if (p.via !== "shard" || p.id === id || !p.motion) continue;
      ps.push({ id: p.id, m: encodeMove(p.motion.intent), e: now - p.motion.at, fx: Math.round(p.motion.from.x * 100) / 100, fy: Math.round(p.motion.from.y * 100) / 100 });
    }
    this.net.direct(`peer:${id}`, this.id, JSON.stringify({ k: "snap", ps }));
  }

  private applySnapshot(from: string, ps: unknown) {
    if (!Array.isArray(ps) || ps.length > 250) return;
    const now = Date.now();
    for (const raw of ps) {
      const e = raw as { id?: unknown; m?: unknown; e?: unknown; fx?: unknown; fy?: unknown };
      const peer = typeof e.id === "string" ? this.peers.get(e.id) : undefined;
      const intent = decodeMove(e.m);
      if (!peer || peer.via !== "shard" || !intent) continue;
      // Only the sender speaks for itself without a starting point; for others, where the sender saw them start.
      const from_ = e.id === from || !Number.isFinite(e.fx) || !Number.isFinite(e.fy) ? { x: intent.x, y: intent.y } : { x: e.fx as number, y: e.fy as number };
      const ago = Number.isFinite(e.e) ? Math.min(60_000, Math.max(0, e.e as number)) : 0;
      peer.motion = { from: from_, intent, at: now - ago };
      peer.seatId = null;
    }
  }

  // --- Messages.

  private receive(from: string, text: string) {
    const now = Date.now();
    this.budget.heard(from, now);
    const peer = this.peers.get(from);
    if (!peer || peer.via !== "shard") return;
    const m = json(text);
    if (!m) return;
    if (m.k === "m") {
      const intent = decodeMove(m);
      if (!intent) return;
      peer.motion = startMotion({ x: peer.x, y: peer.y }, intent, now);
      if (peer.seatId && (intent.path.length || intent.vel || intent.seatId !== peer.seatId)) peer.seatId = null;
    } else if (m.k === "say" && typeof m.t === "string") {
      const say = clean(m.t, 60).trim();
      if (say) this.show(peer, say);
    }
  }

  /** A message to our inbox: a quick message from a peer we can see, or a newcomer's snapshot. */
  private direct(from: string, text: string) {
    if (from === this.id || !SAFE.test(from) || !this.peers.has(from)) return;
    const m = json(text);
    if (!m) return;
    if (m.k === "dm") this.o.onDirect?.(from, m.d);
    else if (m.k === "snap" && this.peers.get(from)?.via === "shard") this.applySnapshot(from, m.ps);
  }

  /** Send a small JSON message to one peer. False when we are not connected or they are gone. */
  sendTo(peer: string, data: unknown) {
    if (!this.active || !this.net || !this.peers.has(peer)) return false;
    this.net.direct(`peer:${peer}`, this.id, JSON.stringify({ k: "dm", d: data }));
    return true;
  }

  // --- Friends on other floors.

  /** Tell mutual friends where we are (and ask them back, the first time). */
  private beacon(ask: boolean) {
    const me = this.o.self();
    const s = this.shard;
    if (!me || !s || !this.net || !me.tag) return;
    this.beaconAt = Date.now();
    this.beaconed = true;
    const w = this.wire(me);
    for (const tag of (this.o.friends?.() ?? []).slice(0, MAX_BEACON_FRIENDS))
      if (TAG.test(tag)) this.net.direct(`tag:${tag}`, this.id, JSON.stringify({ k: "hey", w, sh: s.index, r: ask ? 1 : 0 }));
  }

  private heardFriend(from: string, text: string) {
    const m = json(text);
    if (!m || m.k !== "hey" || typeof m.w !== "string" || !SAFE.test(from) || from === this.id) return;
    const p = parseWire(m.w, this.o.knownFloor);
    if (!p || p.id !== from || !p.tag || !(this.o.friends?.() ?? []).includes(p.tag)) return;
    const now = Date.now();
    if (m.r === 1 && now - (this.replied.get(from) ?? 0) > 60_000) {
      this.replied.set(from, now);
      const me = this.o.self();
      if (me && this.shard && this.net) this.net.direct(`tag:${p.tag}`, this.id, JSON.stringify({ k: "hey", w: this.wire(me), sh: this.shard.index, r: 0 }));
    }
    if (this.peers.get(from)?.via === "shard") return;
    const sh = typeof m.sh === "number" && Number.isInteger(m.sh) && m.sh >= 0 && m.sh < 64 ? m.sh : undefined;
    const peer: Peer = { id: from, meta: p, via: "friend", floorId: p.floorId, x: p.x, y: p.y, facing: p.facing, seatId: p.seatId, motion: null, shard: sh, heard: now };
    this.peers.set(from, peer);
    this.show(peer);
    this.o.onStatus(this.status, this.peers.size);
  }

  // --- Every second and every frame.

  private tick() {
    const me = this.o.self();
    if (!me || !this.active || !this.net) return;
    const now = Date.now();
    // Our tag's inbox, for friends telling us where they are.
    const tag = me.tag && TAG.test(me.tag) ? me.tag : null;
    if (this.tagBox?.tag !== tag) {
      this.tagBox?.stop();
      this.tagBox = tag ? { tag, stop: this.net.inbox(`tag:${tag}`, (from, text) => this.heardFriend(from, text)) } : null;
    }
    if (this.shard && now - this.beaconAt > BEACON_MS) this.beacon(!this.beaconed);
    for (const p of [...this.peers.values()]) if (p.via === "friend" && now - (p.heard ?? 0) > FRIEND_STALE_MS) this.drop(p.id);
    this.retrack();
    const hb = this.cfg.heartbeatSec * 1000;
    if (hb > 0 && now - this.sentAt > hb) this.wantMove = true;
  }

  /** Call every frame: walks the others along their routes and tells our channel when we set off or stop. */
  frame() {
    const me = this.o.self();
    if (!me || !this.active) return;
    if (me.floorId !== this.floor) this.goToFloor(me.floorId);
    const now = Date.now();
    for (const p of this.peers.values()) {
      if (!p.motion) continue;
      const r = motionAt(p.motion, now);
      if (r.done) {
        p.motion = null;
        if (r.seatId) p.seatId = r.seatId;
      }
      if (r.x === p.x && r.y === p.y && r.facing === p.facing && !r.done) continue;
      p.x = r.x;
      p.y = r.y;
      p.facing = r.facing;
      this.show(p);
    }
    this.send(me, now);
  }

  /** Tell the channel what we are doing, within our share of its allowance. */
  private send(me: LiveSelf, now: number) {
    const s = this.shard;
    if (!s?.room.connected) return;
    if (me.say && me.say !== this.lastSay) {
      this.lastSay = me.say;
      // Over the chat limit, a bubble shows on this screen only.
      if (this.chat.allow(now)) this.wantSay = me.say;
    } else if (!me.say) this.lastSay = "";
    const sig = this.sigOf(me);
    if (sig !== this.sentSig) {
      // Arriving where our route said we would: everyone already walks us there.
      const end = this.sent?.path.at(-1);
      if (end && !me.route?.length && !me.vel && Math.hypot(end.x - me.x, end.y - me.y) < 0.35 && (me.seatId ?? null) === (this.sent!.seatId ?? null)) this.sentSig = sig;
      else this.wantMove = true;
    }
    // Steering with the keys: others carry us on for a moment, so say again before they stop.
    if (me.vel && now - this.sentAt > 1500) this.wantMove = true;
    if (!this.wantMove && this.wantSay === null) return;
    if (!this.budget.allow(this.id, now, shardRate(this.cfg.msgBudget, this.crowd(), this.cfg.maxConnections))) return;
    if (this.wantSay !== null) {
      s.room.send(JSON.stringify({ k: "say", t: this.wantSay }));
      this.wantSay = null;
    } else {
      const intent = this.intentOf(me);
      s.room.send(JSON.stringify(encodeMove(intent)));
      this.sent = intent;
      this.sentSig = sig;
      this.sentAt = now;
      this.wantMove = false;
    }
    this.budget.heard(this.id, now);
  }

  private intentOf(me: LiveSelf): MoveIntent {
    // A copy: the game shifts waypoints off its route as the player passes them.
    const path = me.route?.length ? me.route.slice(0, 24).map((p) => ({ x: p.x, y: p.y })) : [];
    return {
      x: me.x,
      y: me.y,
      facing: me.facing,
      path,
      speed: me.speed ?? 3,
      vel: path.length ? null : (me.vel ?? null),
      seatId: path.length ? (me.routeSeat ?? null) : me.seatId,
    };
  }

  /** What others need to hear about again when it changes: the route's end, the keys' direction, or where we stand. */
  private sigOf(me: LiveSelf) {
    const end = me.route?.length ? me.route[me.route.length - 1]! : null;
    if (end) return `r:${round1(end.x)},${round1(end.y)},${me.routeSeat ?? ""}`;
    if (me.vel && (me.vel.x || me.vel.y)) return `v:${Math.round(me.vel.x * 2)},${Math.round(me.vel.y * 2)}`;
    return `s:${round1(me.x)},${round1(me.y)},${me.facing},${me.seatId ?? ""}`;
  }

  private show(p: Peer, say: string | null = null) {
    this.o.onPeer({ ...p.meta, floorId: p.floorId, x: p.x, y: p.y, facing: p.facing, seatId: p.motion ? null : p.seatId, say });
  }

  private drop(id: string) {
    if (!this.peers.delete(id)) return;
    this.o.onGone(id);
    this.o.onStatus(this.status, this.peers.size);
  }

  stop() {
    this.stopped = true;
    this.active = false;
    this.gen++;
    if (this.timer) clearInterval(this.timer);
    this.leaveShard();
    this.closeProbes();
    this.counter?.close();
    this.counter = null;
    this.stopInbox?.();
    this.tagBox?.stop();
    this.tagBox = null;
    for (const id of [...this.peers.keys()]) this.drop(id);
  }
}
