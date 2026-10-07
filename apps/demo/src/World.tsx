import { useEffect, useRef, useState } from "react";
import { type AvatarState, type Emote, type Facing, DEMO_MENU, EMOTES, findPath, menuPages, portalAt, slide } from "@vwo/shared";
import { CafeScene, type DialogChoice, DialogBox, type Look, MenuBook, counterFront, lookFor } from "@vwo/ui";
import { WAITER_LOOK } from "./staff";
import { CharacterCreator, type Character } from "./CharacterCreator";
import { cafe, onFrame, useCafe } from "./useCafe";

interface Session {
  visitId: string;
  memberId: string;
  groupCode: string;
  companionIds: string[];
  look: Look;
}

interface Talk {
  speaker: string;
  pages: string[];
  choices?: DialogChoice[];
}

const WALK = 3.2; // tiles per second
const RUN = 5.2;
const REACH = 1.1;
const EMOTE_ICON: Record<Emote, string> = { wave: "👋", cheers: "🥂", laugh: "😄", heart: "❤️" };
const EMOTE_NAME: Record<Emote, string> = { wave: "Lambai", cheers: "Cheers", laugh: "Tertawa", heart: "Suka" };
const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

const MENU_PAGES = menuPages(DEMO_MENU);

let savedSession: Session | null = null; // survives switching to the admin view and back

function facingOf(dx: number, dy: number, prev: Facing): Facing {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return prev;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "back" : "front";
  return dx < 0 ? "left" : "right";
}

export function World() {
  useCafe();
  const [session, setSession] = useState<Session | null>(() => (savedSession && cafe.members.has(savedSession.memberId) ? savedSession : null));
  const [viewFloorId, setViewFloorId] = useState(cafe.floors[0]!.id);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  savedSession = session;

  const keys = useRef(new Set<string>());
  const route = useRef<{ path: { x: number; y: number }[]; seatId: string | null } | null>(null);
  const talkRef = useRef<Talk | boolean | null>(talk);
  talkRef.current = talk ?? (menuOpen || null);

  const self = session ? cafe.members.get(session.memberId) : undefined;
  const floor = cafe.floor(self?.floorId ?? viewFloorId);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // --- What is within reach: a free chair, the barista, or another customer.
  const reach = (() => {
    if (!self || self.seatId) return null;
    const free = floor.seats
      .filter((s) => !cafe.seatOwner.has(s.id))
      .map((s) => ({ s, d: Math.hypot(s.x - self.x, s.y - self.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (free && free.d < REACH) return { kind: "seat" as const, seatId: free.s.id, label: free.s.label };
    const counter = counterFront(floor);
    if (counter && Math.hypot(counter.x - self.x, counter.y - self.y) < REACH + 0.4) return { kind: "barista" as const };
    const other = [...cafe.members.values()]
      .filter((m) => m.floorId === floor.id && m.memberId !== self.memberId && m.followsMemberId !== self.memberId)
      .map((m) => ({ m, d: Math.hypot(m.x - self.x, m.y - self.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (other && other.d < REACH + 0.3) return { kind: "person" as const, memberId: other.m.memberId, name: other.m.displayName };
    return null;
  })();
  const reachRef = useRef(reach);
  reachRef.current = reach;

  // --- Movement, every frame: keys first, otherwise follow a clicked route.
  useEffect(() => {
    if (!session) return;
    return onFrame((dt) => {
      const me = cafe.members.get(session.memberId);
      if (!me || me.seatId || talkRef.current) return;
      const f = cafe.floor(me.floorId);
      let ix = 0;
      let iy = 0;
      for (const k of keys.current) {
        const d = KEY_DIRS[k];
        if (d) {
          ix += d[0];
          iy += d[1];
        }
      }
      let speed = keys.current.has("ShiftLeft") || keys.current.has("ShiftRight") ? RUN : WALK;
      if (ix || iy) route.current = null;
      else if (route.current) {
        const r = route.current;
        let next = r.path[0];
        while (next && Math.hypot(next.x - me.x, next.y - me.y) < 0.08) {
          r.path.shift();
          next = r.path[0];
        }
        if (!next) {
          route.current = null;
          if (r.seatId) sit(r.seatId);
          return;
        }
        ix = next.x - me.x;
        iy = next.y - me.y;
        const left = Math.hypot(ix, iy);
        speed = Math.min(speed, (left * 1000) / dt);
      }
      const len = Math.hypot(ix, iy);
      if (!len) return;
      const stepLen = (speed * dt) / 1000;
      const dx = (ix / len) * stepLen;
      const dy = (iy / len) * stepLen;
      // A clicked route already avoids furniture and may end on a chair; keys slide along things.
      const to = route.current ? { x: me.x + dx, y: me.y + dy } : slide(f, me.x, me.y, dx, dy);
      cafe.move(me.memberId, to.x, to.y, facingOf(dx, dy, me.facing));
      const portal = portalAt(f, to.x, to.y);
      if (portal?.targetFloorId) {
        route.current = null;
        cafe.changeFloor(me.memberId, portal.targetFloorId, portal.targetX ?? 1, portal.targetY ?? 1);
        setToast(`Naik ke ${cafe.floor(portal.targetFloorId).name}`);
      }
    });
  }, [session]);

  // --- Keyboard.
  useEffect(() => {
    if (!session) return;
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (KEY_DIRS[e.code] || e.code.startsWith("Shift")) {
        keys.current.add(e.code);
        e.preventDefault();
      } else if ((e.code === "KeyE" || e.key === "Enter" || e.code === "Space") && !e.repeat) {
        e.preventDefault();
        interact();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [session]);

  const checkIn = (c: Character, companions: number) => {
    const v = cafe.checkIn(c.name, companions);
    setSession({ ...v, look: c.look });
    setViewFloorId(cafe.floors[0]!.id);
    setTalk({
      speaker: "Barista",
      pages: [
        `Halo, ${c.name}! Selamat datang di Cafe A.`,
        companions ? `Kamu datang bersama ${companions} orang. Mereka akan mengikutimu dan ikut duduk di meja yang sama.` : "Silakan cari tempat duduk yang kosong.",
        "Jalan dengan WASD atau panah (Shift untuk lari), atau klik lantai. Dekati kursi lalu tekan E untuk duduk.",
        "Mau pesan? Klik papan menu di dinding atau tombol Menu. Pelayan akan mengantar pesanan ke mejamu.",
      ],
    });
  };

  function sit(seatId: string) {
    const s = savedSession;
    if (!s || cafe.seatOwner.has(seatId)) return;
    const found = cafe.seat(seatId);
    if (!found) return;
    const { seat, floor: f } = found;
    const free = f.seats
      .filter((x) => x.id !== seatId && !cafe.seatOwner.has(x.id))
      .sort(
        (a, b) =>
          Number(a.tableId !== seat.tableId) - Number(b.tableId !== seat.tableId) ||
          Math.hypot(a.x - seat.x, a.y - seat.y) - Math.hypot(b.x - seat.x, b.y - seat.y),
      );
    const res = cafe.claimSeats(s.visitId, [
      { memberId: s.memberId, seatId },
      ...s.companionIds.slice(0, free.length).map((memberId, i) => ({ memberId, seatId: free[i]!.id })),
    ]);
    setToast(res.ok ? `Duduk di ${seat.label}` : "Kursi sudah terisi, pilih yang lain.");
  }

  const standUp = () => {
    const s = savedSession;
    if (s) [s.memberId, ...s.companionIds].forEach((id) => cafe.releaseSeat(id));
  };

  function interact() {
    const s = savedSession;
    if (!s || talkRef.current) return;
    const me = cafe.members.get(s.memberId);
    if (me?.seatId) return standUp();
    const r = reachRef.current;
    if (!r) return;
    if (r.kind === "seat") sit(r.seatId);
    else if (r.kind === "barista") talkToBarista();
    else talkTo(r.memberId);
  }

  const talkToBarista = () =>
    setTalk({
      speaker: "Barista",
      pages: ["Mau pesan apa hari ini? ☕ Pilih dari menu, nanti pelayan kami antar ke mejamu."],
      choices: [
        {
          label: "Lihat menu",
          onPick: () => {
            setTalk(null);
            setMenuOpen(true);
          },
        },
        { label: "Nanti saja", onPick: () => setTalk(null) },
      ],
    });

  const talkTo = (memberId: string) => {
    const s = savedSession;
    const m = cafe.members.get(memberId);
    if (!m) return;
    const group = [...cafe.members.values()].filter((x) => x.visitId === m.visitId);
    const seat = m.seatId ? cafe.seat(m.seatId)?.seat.label : null;
    const mine = s && m.visitId === s.visitId;
    if (mine && m.memberType === "companion") {
      setTalk({ speaker: m.displayName, pages: [`Aku ikut rombonganmu (NPC). ${seat ? `Aku duduk di ${seat}.` : "Aku jalan di belakangmu."}`] });
      return;
    }
    if (mine) return;
    const host = group.find((x) => x.memberType === "host");
    setTalk({
      speaker: m.displayName,
      pages: [
        m.memberType === "companion"
          ? `Aku datang bersama ${host?.displayName ?? "rombongan"}.`
          : `Hai! Aku ${m.displayName}${group.length > 1 ? `, datang bersama ${group.length - 1} orang` : ""}. ${seat ? `Kami duduk di ${seat}.` : "Lagi cari tempat duduk."}`,
      ],
      choices: s
        ? [
            ...EMOTES.slice(0, 2).map((e) => ({
              label: `${EMOTE_ICON[e]} ${EMOTE_NAME[e]}`,
              onPick: () => {
                cafe.emote(s.memberId, e);
                setTalk(null);
              },
            })),
            { label: "Tutup", onPick: () => setTalk(null) },
          ]
        : undefined,
    });
  };

  const walkTo = (x: number, y: number, seatId: string | null = null) => {
    const me = session && cafe.members.get(session.memberId);
    if (!me || talk) return;
    if (me.seatId) {
      if (!seatId) return;
      standUp();
    }
    const path = findPath(cafe.floor(me.floorId), me, { x, y });
    route.current = path ? { path, seatId } : null;
  };

  const leave = () => {
    if (!session) return;
    cafe.checkOut(session.visitId);
    setSession(null);
    setTalk(null);
  };

  const order = (name: string) => {
    if (!session) return;
    const o = cafe.placeOrder(session.visitId, [name], 3500);
    setToast(o ? `${name} masuk ke kasir, diantar ke meja ${o.tableLabel}` : "Duduk dulu supaya pelayan tahu mejamu.");
  };

  const counts = cafe.snapshot();
  const bubbles = Object.fromEntries([...cafe.bubbles].map(([id, b]) => [id, b.text]));
  const npcs = cafe.staff.map((w) => ({ ...w, look: WAITER_LOOK }));
  const avatars: AvatarState[] = [...cafe.members.values()];
  const emotes = Object.fromEntries([...cafe.emotes].map(([id, e]) => [id, EMOTE_ICON[e.emote]]));
  const occupied = new Set(cafe.seatOwner.keys());
  const lookOf = (a: AvatarState) => (session && a.memberId === session.memberId ? session.look : lookFor(`${a.displayName}:${a.memberId}`));
  const freeHere = floor.seats.filter((s) => !occupied.has(s.id)).length;

  const prompt = !self
    ? null
    : self.seatId
      ? `Berdiri dari ${cafe.seat(self.seatId)?.seat.label}`
      : reach?.kind === "seat"
        ? `Duduk di ${reach.label}`
        : reach?.kind === "barista"
          ? "Ngobrol dengan barista"
          : reach?.kind === "person"
            ? `Sapa ${reach.name}`
            : null;

  const press = (code: string, on: boolean) => (on ? keys.current.add(code) : keys.current.delete(code));

  return (
    <div className="game">
      <CafeScene
        className="game-scene"
        floor={floor}
        floorName={(id) => cafe.floor(id).name}
        occupiedSeatIds={occupied}
        avatars={avatars}
        lookOf={lookOf}
        selfMemberId={session?.memberId}
        emotes={emotes}
        npcs={npcs}
        bubbles={bubbles}
        servedSeatIds={cafe.served}
        onMenuClick={() => setMenuOpen(true)}
        follow={self ? { x: self.x, y: self.y } : null}
        showFreeSeats={!!session}
        highlightSeatId={reach?.kind === "seat" ? reach.seatId : null}
        onSeatClick={session ? (id) => { const s = cafe.seat(id)?.seat; if (s) walkTo(s.x, s.y, id); } : undefined}
        onTileClick={session ? (x, y) => walkTo(x, y) : undefined}
        onAvatarClick={session ? talkTo : undefined}
        onBaristaClick={session ? talkToBarista : undefined}
      >
        {/* Place plate. */}
        <div className="hud hud-tl rpg-box">
          <div className="hud-title">☕ Cafe A · {floor.name}</div>
          <div className="hud-stats">
            <span>👥 {counts.peopleInside} orang</span>
            <span>🪑 {counts.seatsFree}/{counts.seatsTotal} kosong</span>
          </div>
          {!session && (
            <div className="hud-floors">
              {cafe.floors.map((f) => (
                <button key={f.id} type="button" data-active={f.id === floor.id ? "" : undefined} onClick={() => setViewFloorId(f.id)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Minimap. */}
        <div className="hud hud-tr rpg-box" aria-hidden>
          <svg viewBox={`-0.5 -0.5 ${floor.width + 1} ${floor.height + 1}`} className="minimap">
            <rect x={0} y={0} width={floor.width} height={floor.height} rx={0.6} fill={floor.theme === "rooftop" ? "#b98d5f" : "#d9b383"} />
            {(floor.objects ?? [])
              .filter((o) => o.type === "counter" || o.type === "stairs")
              .map((o) => (
                <rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} rx={0.2} fill={o.type === "stairs" ? "#facc15" : "#7b4a2c"} />
              ))}
            {floor.tables.map((t) => (
              <rect key={t.id} x={t.x} y={t.y} width={t.width} height={t.height} rx={t.shape === "round" ? 1 : 0.3} fill="#8f5a2e" />
            ))}
            {floor.seats.map((s) => (
              <circle key={s.id} cx={s.x} cy={s.y} r={0.28} fill={occupied.has(s.id) ? "#ef4444" : "#22c55e"} />
            ))}
            {avatars
              .filter((a) => a.floorId === floor.id && !a.seatId)
              .map((a) => (
                <circle key={a.memberId} cx={a.x} cy={a.y} r={a.memberId === session?.memberId ? 0.45 : 0.3} fill={a.memberId === session?.memberId ? "#f97316" : "#fff"} stroke="#2b1e19" strokeWidth={0.12} />
              ))}
          </svg>
          <div className="minimap-legend">{freeHere} kursi kosong di sini</div>
        </div>

        {/* Bottom: dialog, what's in reach, or how to play. */}
        <div className="hud-bottom">
          {talk ? (
            <DialogBox key={talk.speaker + talk.pages[0]} speaker={talk.speaker} pages={talk.pages} choices={talk.choices} onClose={() => setTalk(null)} />
          ) : prompt ? (
            <button type="button" className="rpg-box prompt" onClick={interact} onPointerDown={(e) => e.stopPropagation()}>
              <span className="rpg-kbd">E</span> {prompt}
            </button>
          ) : session ? (
            <div className="rpg-box hint">
              <span className="rpg-kbd">W</span><span className="rpg-kbd">A</span><span className="rpg-kbd">S</span><span className="rpg-kbd">D</span> jalan · <span className="rpg-kbd">Shift</span> lari · <span className="rpg-kbd">E</span> duduk / bicara · klik lantai untuk berjalan
            </div>
          ) : null}
        </div>

        {toast && <div className="toast rpg-box">{toast}</div>}

        {session && (
          <div className="hud hud-bl" onPointerDown={(e) => e.stopPropagation()}>
            <div className="rpg-box actions">
              {EMOTES.map((e) => (
                <button key={e} type="button" title={EMOTE_NAME[e]} onClick={() => cafe.emote(session.memberId, e)}>
                  {EMOTE_ICON[e]}
                </button>
              ))}
              <button type="button" className="menu-btn" onClick={() => setMenuOpen(true)} title="Lihat menu">
                📖 Menu
              </button>
              <button type="button" className="leave" onClick={leave} title="Check-out">
                🚪 Keluar
              </button>
            </div>
            <div className="group-code">Kode rombongan {session.groupCode}</div>
          </div>
        )}

        {session && (
          <div className="pad" onPointerDown={(e) => e.stopPropagation()}>
            {(
              [
                ["KeyW", "▲", "up"],
                ["KeyA", "◀", "left"],
                ["KeyS", "▼", "down"],
                ["KeyD", "▶", "right"],
              ] as const
            ).map(([code, label, area]) => (
              <button
                key={code}
                type="button"
                style={{ gridArea: area }}
                onPointerDown={() => press(code, true)}
                onPointerUp={() => press(code, false)}
                onPointerLeave={() => press(code, false)}
                onPointerCancel={() => press(code, false)}
              >
                {label}
              </button>
            ))}
            <button type="button" className="pad-a" style={{ gridArea: "a" }} onClick={interact}>
              A
            </button>
          </div>
        )}

        {menuOpen && (
          <MenuBook
            title="Cafe A"
            pages={MENU_PAGES}
            onClose={() => setMenuOpen(false)}
            onOrder={self?.seatId ? (item) => order(item.name) : undefined}
            note={!session ? undefined : self?.seatId ? "Pesanan masuk ke kasir, lalu pelayan mengantar ke mejamu." : "Duduk dulu untuk memesan: pelayan mengantar ke meja."}
          />
        )}

        {!session && (
          <div className="title-screen" onPointerDown={(e) => e.stopPropagation()}>
            <CharacterCreator onCheckIn={checkIn} />
          </div>
        )}
      </CafeScene>
    </div>
  );
}
