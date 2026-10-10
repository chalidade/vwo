// Meeting real people on other devices: every open job fair publishes its player's position and
// mirrors everyone else who does the same. How the messages travel is a swappable transport:
// a public MQTT broker for the GitHub Pages demo, Supabase Realtime for the live trial, and our
// own Socket.IO server once the event moves to DigitalOcean. Only a nickname, the character's
// look, where they stand and a short speech bubble are ever sent, and every message is checked.
import type { MqttClient } from "mqtt";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { LIVE } from "./mode";
import { closeChannel, hasRealtime, openChannel, realtimeClient } from "./realtime";
import type { Facing } from "@vwo/shared";
import type { Look } from "@vwo/ui";
import type { RemotePlayer } from "./jobfair-engine";

const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];
const TOPIC = "vwo-demo/v1";
/** Peers that go quiet for this long have closed the tab or lost their connection. */
const STALE_MS = 12_000;
const HEARTBEAT_MS = 4_000;
/** The whole-fair lobby hears from each peer this often (and on every floor change). */
const LOBBY_HEARTBEAT_MS = 25_000;
const LOBBY_STALE_MS = 70_000;
/** Supabase counts every message, so the live trial sends position updates less often. */
const MIN_GAP_MS = LIVE ? 250 : 120;

export type LiveStatus = "connecting" | "online" | "offline";

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
}

interface Wire extends LiveSelf {
  v: 1;
  id: string;
}

const FACINGS = new Set<Facing>(["front", "back", "left", "right"]);
const SAFE = /^[#\w-]{1,24}$/;
const TAG = /^[0-9a-f]{12}$/;

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
    name: m.name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 20) || "Tamu",
    floorId: m.floorId,
    x: Math.min(200, Math.max(0, m.x!)),
    y: Math.min(200, Math.max(0, m.y!)),
    facing: m.facing as Facing,
    seatId: typeof m.seatId === "string" && /^[\w-]{1,80}$/.test(m.seatId) ? m.seatId : null,
    say: typeof m.say === "string" ? m.say.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 60) : null,
    verified: m.verified === true,
    tag: typeof m.tag === "string" && TAG.test(m.tag) ? m.tag : null,
    look: look as unknown as Look,
  };
}

function readDirect(text: string): { from: string; t: string } | null {
  try {
    const m = JSON.parse(text) as { from?: unknown; t?: unknown };
    return typeof m.from === "string" && typeof m.t === "string" && m.t.length < 400 ? { from: m.from, t: m.t } : null;
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

interface TransportEvents {
  message: (id: string, text: string) => void;
  status: (s: LiveStatus) => void;
  /** A message meant for this peer only (a quick message from another job seeker). */
  direct?: (from: string, text: string) => void;
}

/** Carries one peer's latest state (a JSON string, or "" when leaving) to everyone in the room. */
export interface Transport {
  connect(on: TransportEvents): Promise<void>;
  send(id: string, text: string): void;
  /** Send `text` from peer `from` to peer `to` only. */
  direct?(from: string, to: string, text: string): void;
  readonly connected: boolean;
  close(id: string): void;
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

/** The demo's transport: a public MQTT broker, one retained-free topic per peer. */
class MqttTransport implements Transport {
  private client: MqttClient | null = null;
  private brokerIndex = 0;
  private stopped = false;
  constructor(
    private readonly room: string,
    private readonly selfId: string,
  ) {}

  private topic(id: string) {
    return `${TOPIC}/${this.room}/p/${id}`;
  }

  get connected() {
    return !!this.client?.connected;
  }

  async connect(on: TransportEvents) {
    // Loaded on demand: the MQTT client is as big as the rest of the demo.
    const { default: mqtt } = await import("mqtt");
    if (this.stopped) return;
    const list = brokers();
    const url = list[this.brokerIndex % list.length]!;
    const client = mqtt.connect(url, {
      clientId: `vwo_${this.selfId}_${Math.random().toString(36).slice(2, 6)}`,
      clean: true,
      keepalive: 30,
      connectTimeout: 8000,
      reconnectPeriod: 4000,
      will: { topic: this.topic(this.selfId), payload: "", qos: 0, retain: false },
    });
    this.client = client;
    client.on("connect", () => {
      client.subscribe(`${TOPIC}/${this.room}/p/+`, { qos: 0 });
      client.subscribe(`${TOPIC}/${this.room}/d/${this.selfId}`, { qos: 0 });
      on.status("online");
    });
    client.on("message", (topic, payload) => {
      const text = new TextDecoder().decode(payload);
      if (topic.startsWith(`${TOPIC}/${this.room}/d/`)) {
        const m = readDirect(text);
        if (m) on.direct?.(m.from, m.t);
      } else on.message(topic.slice(topic.lastIndexOf("/") + 1), text);
    });
    client.on("offline", () => on.status("offline"));
    client.on("error", () => {
      // Try the next public broker if this one refuses us.
      if (!client.connected && list.length > 1) {
        client.end(true);
        this.brokerIndex++;
        void this.connect(on);
      }
    });
  }

  send(id: string, text: string) {
    this.client?.publish(this.topic(id), text, { qos: 0 });
  }

  direct(from: string, to: string, text: string) {
    this.client?.publish(`${TOPIC}/${this.room}/d/${to}`, JSON.stringify({ from, t: text }), { qos: 0 });
  }

  close(id: string) {
    this.stopped = true;
    const c = this.client;
    this.client = null;
    if (c?.connected) c.publish(this.topic(id), "", { qos: 0 }, () => c.end());
    else c?.end(true);
  }
}

/** The live trial's transport: a Supabase Realtime broadcast channel per room. */
class SupabaseTransport implements Transport {
  private channel: RealtimeChannel | null = null;
  private sb: SupabaseClient | null = null;
  private ready = false;
  private stopped = false;
  constructor(
    private readonly room: string,
    private readonly selfId: string,
  ) {}

  get connected() {
    return this.ready;
  }

  async connect(on: TransportEvents) {
    const sb = await realtimeClient();
    if (this.stopped || !sb) return;
    this.sb = sb;
    const ch = await openChannel(sb, `jobfair:${this.room}`, { config: { broadcast: { self: false } } });
    if (this.stopped) return;
    ch.on("broadcast", { event: "p" }, (m: { payload?: { id?: unknown; t?: unknown } }) => {
      const { id, t } = m.payload ?? {};
      if (typeof id === "string" && typeof t === "string" && t.length < 4000) on.message(id, t);
    });
    // Everyone in the room gets every direct message; each keeps only those addressed to it.
    ch.on("broadcast", { event: "d" }, (m: { payload?: { to?: unknown; from?: unknown; t?: unknown } }) => {
      const { to, from, t } = m.payload ?? {};
      if (to === this.selfId && typeof from === "string" && typeof t === "string" && t.length < 400) on.direct?.(from, t);
    });
    ch.subscribe((status: string) => {
      this.ready = status === "SUBSCRIBED";
      on.status(this.ready ? "online" : status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "offline" : "connecting");
    });
    this.channel = ch;
  }

  send(id: string, text: string) {
    if (this.ready) void this.channel?.send({ type: "broadcast", event: "p", payload: { id, t: text } });
  }

  direct(from: string, to: string, text: string) {
    if (this.ready) void this.channel?.send({ type: "broadcast", event: "d", payload: { from, to, t: text } });
  }

  close(id: string) {
    this.stopped = true;
    this.send(id, "");
    this.ready = false;
    // Removed, not just left: walking back onto this floor later joins the same topic afresh.
    if (this.channel && this.sb) closeChannel(this.sb, `jobfair:${this.room}`, this.channel);
    this.channel = null;
  }
}

/** Picks the transport for this build: Supabase on the live trial, the public broker in the demo. */
export function pickTransport(room: string, selfId: string): Transport | null {
  if (!LIVE) return new MqttTransport(room, selfId);
  return hasRealtime() ? new SupabaseTransport(room, selfId) : null;
}

/**
 * The fair's presence, in two lanes so a busy event doesn't send every step to everyone:
 * - the lobby (the whole fair): who is here and on which floor, a slow heartbeat, a message on
 *   every floor change, and the quick messages between job seekers;
 * - the floor the player is on: every step, speech bubble and seat, to the people on that floor only.
 * Realtime services bill each message once per receiver, so this keeps the cost close to
 * "people per floor" instead of "everyone at the fair".
 */
export class LiveChannel {
  readonly id = peerId();
  status: LiveStatus = "connecting";
  private lobby: Transport | null = null;
  private lane: Transport | null = null;
  private laneFloor: string | null = null;
  /** When we joined the current floor lane: peers there get a moment to say hello. */
  private laneSince = 0;
  /** Last time we heard from each peer on any lane, and on our floor lane. */
  private seen = new Map<string, number>();
  private seenOnFloor = new Map<string, number>();
  private peerFloor = new Map<string, { floorId: string; since: number }>();
  private last = "";
  private lastAt = 0;
  private lobbyFloor: string | null = null;
  private lobbyAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly room: string,
    private readonly self: () => LiveSelf | null,
    private readonly onPeer: (p: RemotePlayer & { look: Look }) => void,
    private readonly onGone: (id: string) => void,
    private readonly knownFloor: (id: string) => boolean,
    private readonly onStatus: (s: LiveStatus, peers: number) => void,
    private readonly makeTransport: (room: string, selfId: string) => Transport | null = pickTransport,
    /** A direct message from a peer we can see (anything from strangers is dropped). */
    private readonly onDirect?: (from: string, data: unknown) => void,
  ) {}

  start() {
    this.lobby = this.makeTransport(this.room, this.id);
    if (!this.lobby) {
      this.setStatus("offline");
      return;
    }
    void this.lobby.connect({
      status: (s) => {
        if (s === "online" && this.status !== "online") {
          this.status = s;
          this.publishLobby();
        }
        this.setStatus(s);
      },
      message: (id, text) => this.receive(id, text, false),
      direct: (from, text) => {
        if (from === this.id || !SAFE.test(from) || !this.seen.has(from)) return;
        try {
          this.onDirect?.(from, JSON.parse(text));
        } catch {
          // Not JSON: ignore.
        }
      },
    });
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  /** Join the lane of the floor we are on, leaving the old one. */
  private joinFloor(floorId: string) {
    if (this.laneFloor === floorId) return;
    this.lane?.close(this.id);
    this.laneFloor = floorId;
    this.laneSince = Date.now();
    this.seenOnFloor.clear();
    const lane = this.makeTransport(`${this.room}~${floorId}`, this.id);
    this.lane = lane;
    if (!lane) return;
    void lane.connect({
      status: (s) => {
        if (s === "online" && lane === this.lane) {
          this.last = "";
          this.publish(true);
        }
      },
      message: (id, text) => lane === this.lane && this.receive(id, text, true),
    });
  }

  private receive(id: string, text: string, onFloor: boolean) {
    if (id === this.id || !SAFE.test(id)) return;
    if (!text) {
      // Leaving a floor lane only means they went to another floor; the lobby says when they leave.
      if (onFloor) this.seenOnFloor.delete(id);
      else this.drop(id);
      return;
    }
    const p = parseWire(text, this.knownFloor);
    if (!p || p.id !== id) return;
    const now = Date.now();
    const isNew = !this.seen.has(id);
    const newOnFloor = onFloor && !this.seenOnFloor.has(id);
    this.seen.set(id, now);
    if (onFloor) this.seenOnFloor.set(id, now);
    if (this.peerFloor.get(id)?.floorId !== p.floorId) this.peerFloor.set(id, { floorId: p.floorId, since: now });
    this.onPeer(p);
    // Say hello back so the newcomer sees us without waiting for our next heartbeat.
    if (newOnFloor) this.publish(true);
    else if (isNew && !onFloor) this.publishLobby();
    this.setStatus("online");
  }

  private setStatus(s: LiveStatus) {
    this.status = s;
    this.onStatus(s, this.seen.size);
  }

  private drop(id: string) {
    this.seenOnFloor.delete(id);
    this.peerFloor.delete(id);
    if (!this.seen.delete(id)) return;
    this.onGone(id);
    this.onStatus(this.status, this.seen.size);
  }

  private tick() {
    const now = Date.now();
    const me = this.self();
    if (me && this.lobby) this.joinFloor(me.floorId);
    for (const [id, at] of this.seen) {
      // Someone on our floor heartbeats there often; someone elsewhere only in the lobby.
      const pf = this.peerFloor.get(id);
      const here = pf?.floorId === this.laneFloor;
      const floorAt = Math.max(this.seenOnFloor.get(id) ?? 0, this.laneSince, pf?.since ?? 0);
      if (now - at > LOBBY_STALE_MS || (here && now - floorAt > STALE_MS)) this.drop(id);
    }
    if (now - this.lastAt > HEARTBEAT_MS) this.publish(true);
    if (me && (me.floorId !== this.lobbyFloor || now - this.lobbyAt > LOBBY_HEARTBEAT_MS)) this.publishLobby();
  }

  private wire(me: LiveSelf) {
    const wire: Wire = { v: 1, id: this.id, ...me, x: Math.round(me.x * 100) / 100, y: Math.round(me.y * 100) / 100 };
    return JSON.stringify(wire);
  }

  /** Tell the whole fair we are here and on which floor. */
  private publishLobby() {
    const t = this.lobby;
    const me = this.self();
    if (!t?.connected || !me) return;
    this.lobbyFloor = me.floorId;
    this.lobbyAt = Date.now();
    t.send(this.id, this.wire({ ...me, say: null }));
  }

  /** Send our player's state to our floor; cheap to call every frame, it only sends on change. */
  publish(force = false) {
    const me = this.self();
    if (!me) return;
    if (me.floorId !== this.laneFloor && this.lobby) {
      this.joinFloor(me.floorId);
      this.publishLobby();
    }
    const t = this.lane;
    if (!t?.connected) return;
    const now = Date.now();
    const text = this.wire(me);
    if (!force && (text === this.last || now - this.lastAt < MIN_GAP_MS)) return;
    this.last = text;
    this.lastAt = now;
    t.send(this.id, text);
  }

  /** Send a small JSON message to one peer. False when we are not connected or they are gone. */
  sendTo(peer: string, data: unknown) {
    const t = this.lobby;
    if (!t?.connected || !t.direct || !this.seen.has(peer)) return false;
    t.direct(this.id, peer, JSON.stringify(data));
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.lane?.close(this.id);
    this.lobby?.close(this.id);
    this.lane = null;
    this.lobby = null;
    this.laneFloor = null;
    for (const id of [...this.seen.keys()]) this.drop(id);
  }
}
