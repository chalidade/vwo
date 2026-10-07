import { useEffect, useMemo, useState } from "react";
import { EMOTES, type Facing } from "@vwo/shared";
import { FloorMap } from "@vwo/ui";
import { useCafe } from "./useCafe";

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
const EMOTE_ICON = { wave: "👋", cheers: "🥂", laugh: "😄", heart: "❤️" } as const;

let savedSession: Session | null = null; // survives switching to the admin view and back

export function World() {
  const cafe = useCafe();
  const [session, setSession] = useState<Session | null>(() => (savedSession && cafe.members.has(savedSession.memberId) ? savedSession : null));
  const [name, setName] = useState("");
  const [companions, setCompanions] = useState(0);
  const [floorId, setFloorId] = useState(cafe.floors[0]!.id);
  const [message, setMessage] = useState<string | null>(null);
  savedSession = session;

  const self = session ? cafe.members.get(session.memberId) : undefined;

  const step = (k: [number, number, Facing]) => {
    if (!self || self.seatId) return;
    cafe.move(self.memberId, self.x + k[0], self.y + k[1], k[2]);
  };

  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      const k = KEYS[e.key];
      if (!k || (e.target as HTMLElement)?.tagName === "INPUT") return;
      e.preventDefault();
      const me = cafe.members.get(session.memberId);
      if (me && !me.seatId) cafe.move(me.memberId, me.x + k[0], me.y + k[1], k[2]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, cafe]);

  const checkIn = () => {
    const s = cafe.checkIn(name.trim().slice(0, 24) || "Kamu", Math.min(Math.max(companions, 0), 5));
    setSession(s);
    setFloorId(cafe.floors[0]!.id);
    setMessage(null);
  };

  const sit = (seatId: string) => {
    if (!session || cafe.seatOwner.has(seatId)) return;
    const found = cafe.seat(seatId);
    if (!found) return;
    const { seat, floor } = found;
    const free = floor.seats
      .filter((s) => s.id !== seatId && !cafe.seatOwner.has(s.id))
      .sort(
        (a, b) =>
          Number(a.tableId !== seat.tableId) - Number(b.tableId !== seat.tableId) ||
          Math.hypot(a.x - seat.x, a.y - seat.y) - Math.hypot(b.x - seat.x, b.y - seat.y),
      );
    const res = cafe.claimSeats(session.visitId, [
      { memberId: session.memberId, seatId },
      ...session.companionIds.slice(0, free.length).map((memberId, i) => ({ memberId, seatId: free[i]!.id })),
    ]);
    setMessage(res.ok ? null : "Kursi sudah terisi, pilih yang lain.");
  };

  const standUp = () => session && [session.memberId, ...session.companionIds].forEach((id) => cafe.releaseSeat(id));
  const leave = () => {
    if (!session) return;
    cafe.checkOut(session.visitId);
    setSession(null);
  };

  const floor = cafe.floors.find((f) => f.id === floorId)!;
  const counts = cafe.snapshot();
  const avatars = [...cafe.members.values()].filter((m) => m.floorId === floor.id);
  const occupied = useMemo(() => new Set(cafe.seatOwner.keys()), [cafe, counts.seatsOccupied, cafe.events.length]);
  const emotes = Object.fromEntries([...cafe.emotes].map(([id, e]) => [id, e.emote]));

  return (
    <main style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0 }}>Cafe A</h1>
      <div className="row">
        <span>
          <strong>{counts.peopleInside}</strong> orang di dalam
        </span>
        <span>
          <strong>
            {counts.seatsFree}/{counts.seatsTotal}
          </strong>{" "}
          kursi kosong
        </span>
        {cafe.floors.map((f) => (
          <button key={f.id} className={f.id === floor.id ? "" : "ghost"} onClick={() => setFloorId(f.id)}>
            {f.name}
          </button>
        ))}
      </div>

      {!session ? (
        <div className="card row">
          <input placeholder="Nickname" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="row">
            Datang bersama
            <input type="number" min={0} max={5} value={companions} onChange={(e) => setCompanions(Number(e.target.value))} style={{ width: 64 }} />
            orang
          </label>
          <button onClick={checkIn}>Check-in</button>
          <span className="muted">Di cafe sungguhan, check-in lewat scan QR di pintu.</span>
        </div>
      ) : (
        <div className="card row">
          <span className="muted">
            Kode rombongan <strong>{session.groupCode}</strong> · WASD / panah untuk jalan · klik kursi hijau untuk duduk
          </span>
          {self?.seatId && (
            <button className="ghost" onClick={standUp}>
              Berdiri
            </button>
          )}
          {EMOTES.map((e) => (
            <button key={e} className="ghost" onClick={() => cafe.emote(session.memberId, e)} aria-label={e}>
              {EMOTE_ICON[e]}
            </button>
          ))}
          <button className="ghost" onClick={leave}>
            Keluar
          </button>
          <div className="pad" aria-label="Kontrol gerak">
            <span />
            <button onClick={() => step(KEYS.ArrowUp!)}>▲</button>
            <span />
            <button onClick={() => step(KEYS.ArrowLeft!)}>◀</button>
            <button onClick={() => step(KEYS.ArrowDown!)}>▼</button>
            <button onClick={() => step(KEYS.ArrowRight!)}>▶</button>
          </div>
        </div>
      )}

      {message && (
        <div className="card" role="status">
          {message}
        </div>
      )}
      <FloorMap
        floor={floor}
        occupiedSeatIds={occupied}
        avatars={avatars}
        selfMemberId={session?.memberId}
        onSeatClick={session ? sit : undefined}
        emotes={emotes}
      />
    </main>
  );
}
