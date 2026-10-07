// Meeting real people on other devices without a server of our own: every open job fair
// publishes its player's position to a public MQTT broker over a websocket, and mirrors
// everyone else who does the same. Public brokers have no login, so only a nickname, the
// character's look, where they stand and a short speech bubble are ever sent.
import type { MqttClient } from "mqtt";
import type { Facing } from "@vwo/shared";
import type { Look } from "@vwo/ui";
import type { RemotePlayer } from "./jobfair-engine";

const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];
const TOPIC = "vwo-demo/v1";
/** Peers that go quiet for this long have closed the tab or lost their connection. */
const STALE_MS = 12_000;
const HEARTBEAT_MS = 4_000;
const MIN_GAP_MS = 120;

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
}

interface Wire extends LiveSelf {
  v: 1;
  id: string;
}

const FACINGS = new Set<Facing>(["front", "back", "left", "right"]);
const SAFE = /^[#\w-]{1,24}$/;

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
    look: look as unknown as Look,
  };
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

export class LiveChannel {
  readonly id = peerId();
  status: LiveStatus = "connecting";
  private client: MqttClient | null = null;
  private brokerIndex = 0;
  private seen = new Map<string, number>();
  private last = "";
  private lastAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly room: string,
    private readonly self: () => LiveSelf | null,
    private readonly onPeer: (p: RemotePlayer & { look: Look }) => void,
    private readonly onGone: (id: string) => void,
    private readonly knownFloor: (id: string) => boolean,
    private readonly onStatus: (s: LiveStatus, peers: number) => void,
  ) {}

  private topic(id = this.id) {
    return `${TOPIC}/${this.room}/p/${id}`;
  }

  start() {
    void this.connect();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private stopped = false;

  private async connect() {
    // Loaded on demand: the MQTT client is as big as the rest of the demo.
    const { default: mqtt } = await import("mqtt");
    if (this.stopped) return;
    const list = brokers();
    const url = list[this.brokerIndex % list.length]!;
    const client = mqtt.connect(url, {
      clientId: `vwo_${this.id}_${Math.random().toString(36).slice(2, 6)}`,
      clean: true,
      keepalive: 30,
      connectTimeout: 8000,
      reconnectPeriod: 4000,
      will: { topic: this.topic(), payload: "", qos: 0, retain: false },
    });
    this.client = client;
    client.on("connect", () => {
      client.subscribe(`${TOPIC}/${this.room}/p/+`, { qos: 0 });
      this.setStatus("online");
      this.last = "";
      this.publish(true);
    });
    client.on("message", (topic, payload) => {
      const id = topic.slice(topic.lastIndexOf("/") + 1);
      if (id === this.id) return;
      if (!payload.length) {
        this.drop(id);
        return;
      }
      const p = parseWire(new TextDecoder().decode(payload), this.knownFloor);
      if (!p || p.id !== id) return;
      const isNew = !this.seen.has(id);
      this.seen.set(id, Date.now());
      this.onPeer(p);
      // Say hello back so the newcomer sees us without waiting for our next heartbeat.
      if (isNew) this.publish(true);
      this.setStatus("online");
    });
    client.on("offline", () => this.setStatus("offline"));
    client.on("error", () => {
      // Try the next public broker if this one refuses us.
      if (this.status !== "online" && list.length > 1) {
        client.end(true);
        this.brokerIndex++;
        void this.connect();
      }
    });
  }

  private setStatus(s: LiveStatus) {
    this.status = s;
    this.onStatus(s, this.seen.size);
  }

  private drop(id: string) {
    if (!this.seen.delete(id)) return;
    this.onGone(id);
    this.onStatus(this.status, this.seen.size);
  }

  private tick() {
    const now = Date.now();
    for (const [id, at] of this.seen) if (now - at > STALE_MS) this.drop(id);
    if (now - this.lastAt > HEARTBEAT_MS) this.publish(true);
  }

  /** Send our player's state; cheap to call every frame, it only sends on change. */
  publish(force = false) {
    const c = this.client;
    const me = this.self();
    if (!c?.connected || !me) return;
    const now = Date.now();
    const wire: Wire = { v: 1, id: this.id, ...me, x: Math.round(me.x * 100) / 100, y: Math.round(me.y * 100) / 100 };
    const text = JSON.stringify(wire);
    if (!force && (text === this.last || now - this.lastAt < MIN_GAP_MS)) return;
    this.last = text;
    this.lastAt = now;
    c.publish(this.topic(), text, { qos: 0 });
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    const c = this.client;
    this.client = null;
    if (c?.connected) c.publish(this.topic(), "", { qos: 0 }, () => c.end());
    else c?.end(true);
    for (const id of [...this.seen.keys()]) this.drop(id);
  }
}
