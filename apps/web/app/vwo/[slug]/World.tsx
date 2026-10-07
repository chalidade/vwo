"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { type AvatarState, type ClientToServerEvents, EMOTES, type Emote, type Facing, type ServerToClientEvents } from "@vwo/shared";
import { CafeScene } from "@vwo/ui";
import type { VenueLayout } from "@/lib/types";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
interface Session {
  visitId: string;
  memberId: string;
  groupCode: string;
  companionIds: string[];
}

const STEP = 0.25;
const KEYS: Record<string, [number, number, Facing]> = {
  ArrowUp: [0, -STEP, "back"], w: [0, -STEP, "back"],
  ArrowDown: [0, STEP, "front"], s: [0, STEP, "front"],
  ArrowLeft: [-STEP, 0, "left"], a: [-STEP, 0, "left"],
  ArrowRight: [STEP, 0, "right"], d: [STEP, 0, "right"],
};

export function World({ slug, floors, realtimeUrl, devCheckin }: { slug: string; floors: VenueLayout; realtimeUrl: string; devCheckin: boolean }) {
  const [floorId, setFloorId] = useState<string | undefined>(floors[0]?.id);
  const [avatars, setAvatars] = useState<Map<string, AvatarState>>(new Map());
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<{ peopleInside: number; seatsFree: number; seatsTotal: number } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [emotes, setEmotes] = useState<Record<string, Emote>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [companions, setCompanions] = useState(0);
  const socketRef = useRef<Client | null>(null);

  // (Re)connect whenever the player identity changes; spectators join without a session.
  useEffect(() => {
    const socket: Client = io(realtimeUrl, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("world:snapshot", (s) => {
      setFloorId(s.floorId);
      setAvatars(new Map(s.avatars.map((a) => [a.memberId, a])));
      setOccupied(new Set(s.occupiedSeatIds));
    });
    socket.on("avatar:joined", (a) => setAvatars((m) => new Map(m).set(a.memberId, a)));
    socket.on("avatar:left", ({ memberId }) =>
      setAvatars((m) => {
        const next = new Map(m);
        next.delete(memberId);
        return next;
      }),
    );
    socket.on("avatar:moved", ({ memberId, x, y, facing }) =>
      setAvatars((m) => {
        const a = m.get(memberId);
        return a ? new Map(m).set(memberId, { ...a, x, y, facing }) : m;
      }),
    );
    socket.on("seat:updated", ({ seatId, memberId }) =>
      setOccupied((s) => {
        const next = new Set(s);
        if (memberId) next.add(seatId);
        else next.delete(seatId);
        return next;
      }),
    );
    socket.on("venue:counts", setCounts);
    socket.on("avatar:emoted", ({ memberId, emote }) => {
      setEmotes((e) => ({ ...e, [memberId]: emote }));
      setTimeout(() => setEmotes((e) => {
        const { [memberId]: _, ...rest } = e;
        return rest;
      }), 2000);
    });
    socket.emit(
      "world:join",
      { venueSlug: slug, visitId: session?.visitId, memberId: session?.memberId, displayName: name || "Tamu" },
      (res) => {
        if (!res.ok) setMessage("Gagal masuk ke cafe.");
      },
    );
    return () => {
      socket.disconnect();
    };
    // name is only read at join time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeUrl, slug, session]);

  const self = session ? avatars.get(session.memberId) : undefined;
  const selfRef = useRef(self);
  selfRef.current = self;

  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
      const me = selfRef.current;
      if (!k || !me || me.seatId || (e.target as HTMLElement)?.tagName === "INPUT") return;
      e.preventDefault();
      socketRef.current?.emit("avatar:move", { x: me.x + k[0], y: me.y + k[1], facing: k[2] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  const checkIn = async () => {
    const res = await fetch(`/api/venues/${slug}/dev-checkin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, companions }),
    });
    if (!res.ok) return setMessage("Check-in gagal.");
    setSession(await res.json());
    setMessage(null);
  };

  const sit = useCallback(
    async (seatId: string) => {
      if (!session || occupied.has(seatId)) return;
      // Seat the player, plus companions on the nearest free seats of the same floor.
      const floor = floors.find((f) => f.id === floorId);
      const target = floor?.seats.find((s) => s.id === seatId);
      if (!floor || !target) return;
      const free = floor.seats
        .filter((s) => s.id !== seatId && !occupied.has(s.id) && s.isActive)
        // Same table first, then the closest seats around it.
        .sort(
          (a, b) =>
            Number(a.tableId !== target.tableId) - Number(b.tableId !== target.tableId) ||
            Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y),
        );
      const assignments = [
        { memberId: session.memberId, seatId },
        ...session.companionIds.slice(0, free.length).map((memberId, i) => ({ memberId, seatId: free[i]!.id })),
      ];
      const res = await socketRef.current?.timeout(5000).emitWithAck("seat:claim", { assignments });
      setMessage(res?.ok ? null : res?.error === "seat_taken" ? "Kursi sudah terisi, pilih yang lain." : "Tidak bisa duduk di sini.");
    },
    [session, occupied, floors, floorId],
  );

  const standUp = async () => {
    if (!session) return;
    for (const memberId of [session.memberId, ...session.companionIds]) {
      await socketRef.current?.timeout(5000).emitWithAck("seat:release", { memberId });
    }
  };

  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  const avatarList = useMemo(() => [...avatars.values()].filter((a) => a.floorId === floor?.id), [avatars, floor]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="row">
        <span>
          <strong>{counts?.peopleInside ?? "-"}</strong> orang di dalam
        </span>
        <span>
          <strong>{counts ? `${counts.seatsFree}/${counts.seatsTotal}` : "-"}</strong> kursi kosong
        </span>
      </div>

      {!session && (
        <div className="card row">
          <input placeholder="Nickname" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="row">
            Datang bersama
            <input type="number" min={0} max={9} value={companions} onChange={(e) => setCompanions(Number(e.target.value))} style={{ width: 64 }} />
            orang
          </label>
          {devCheckin ? <button onClick={checkIn}>Check-in (demo)</button> : <span className="muted">Scan QR di pintu cafe untuk check-in.</span>}
        </div>
      )}

      {session && (
        <div className="card row">
          <span className="muted">
            Kode rombongan <strong>{session.groupCode}</strong> · gerak dengan WASD / panah · klik kursi hijau untuk duduk
          </span>
          {self?.seatId && <button className="ghost" onClick={standUp}>Berdiri</button>}
          {EMOTES.map((e) => (
            <button key={e} className="ghost" onClick={() => socketRef.current?.emit("avatar:emote", { emote: e })}>
              {{ wave: "👋", cheers: "🥂", laugh: "😄", heart: "❤️" }[e]}
            </button>
          ))}
        </div>
      )}

      {message && <div className="card" role="status">{message}</div>}
      {floor && (
        <CafeScene
          floor={floor}
          floorName={(id) => floors.find((f) => f.id === id)?.name ?? ""}
          occupiedSeatIds={occupied}
          avatars={avatarList}
          selfMemberId={session?.memberId}
          onSeatClick={session ? sit : undefined}
          emotes={emotes}
          follow={self ? { x: self.x, y: self.y } : null}
          showFreeSeats={!!session}
          style={{ height: "min(70vh, 640px)", borderRadius: 12 }}
        />
      )}
    </div>
  );
}
