import { useEffect, useRef, useState } from "react";
import { type AvatarState, type CompanyBooth, EMOTES, type Emote, SPONSOR_H, SPONSOR_W, type SponsorView, boothSpot, fairFloorIndex, findPath, portalAt, slide } from "@vwo/shared";
import {
  type ApplicationInput,
  ApplyForm,
  CafeScene,
  type DialogChoice,
  DialogBox,
  JobBoard,
  type Look,
  SponsorCard,
  type NpcView,
  boothExtras,
  infoDeskExtras,
  lookFor,
  sponsorExtras,
} from "@vwo/ui";
import { CharacterCreator, type Character } from "./CharacterCreator";
import { KEY_DIRS, RUN, WALK, facingOf, useHud } from "./controls";
import { PLAYER_ID, recruiterId } from "./jobfair-engine";
import { type SeekerProfile, clearProfile, loadProfile, saveProfile } from "./profile";
import { SeekerPanel, type SeekerTab } from "./SeekerPanel";
import { onFrame } from "./useCafe";
import { fair, useFair } from "./useFair";

interface Session {
  visitorId: string;
  name: string;
  look: Look;
}

interface Talk {
  speaker: string;
  pages: string[];
  choices?: DialogChoice[];
}

type Reach =
  | { kind: "recruiter"; booth: CompanyBooth }
  | { kind: "banner"; booth: CompanyBooth }
  | { kind: "info" }
  | { kind: "sponsor"; sponsor: SponsorView }
  | { kind: "person"; memberId: string; name: string };

const EMOTE_ICON: Record<Emote, string> = { wave: "👋", cheers: "🥂", laugh: "😄", heart: "❤️" };

/** Recruiters wear a jacket in their company's colour; the organisers wear navy. */
export function staffLook(name: string, color: string): Look {
  return { ...lookFor(`staff:${name}`), outfit: "jacket", shirt: color, hat: undefined };
}

let savedSession: Session | null = null; // survives switching to the organiser view and back

export function JobFair() {
  useFair();
  const [session, setSession] = useState<Session | null>(() => (savedSession && fair.visitors.has(savedSession.visitorId) ? savedSession : null));
  const [talk, setTalk] = useState<Talk | null>(null);
  const [board, setBoard] = useState<{ boothId: string; jobId?: string; about?: boolean } | null>(null);
  const [applying, setApplying] = useState<{ boothId: string; jobId?: string } | null>(null);
  const [panel, setPanel] = useState<SeekerTab | null>(null);
  const [sponsor, setSponsor] = useState<SponsorView | null>(null);
  const [profile, setProfile] = useState<SeekerProfile>(loadProfile);
  const [toast, setToast] = useState<string | null>(null);
  const hud = useHud();
  savedSession = session;

  const keys = useRef(new Set<string>());
  const route = useRef<{ x: number; y: number }[] | null>(null);
  /** Where a clicked walk ends, possibly on another floor: the route then leads to the stairs first. */
  const goal = useRef<{ floorId: string; x: number; y: number } | null>(null);
  const busy = useRef(false);
  busy.current = !!(talk || board || applying || panel || sponsor);
  const counted = useRef(new Set<string>());

  const self = session ? fair.visitors.get(session.visitorId) : undefined;
  const floor = fair.floor(self?.floorId ?? fair.floors[0]!.id);
  const level = fairFloorIndex(floor.id);
  const floorInfo = fair.fair.floors[level];
  const booths = fair.fair.booths.filter((b) => b.floor === level);
  const sponsors = fair.fair.sponsors.filter((sp) => sp.floor === level);
  const mine = session ? fair.applications.filter((a) => a.visitorId === session.visitorId) : [];
  const appliedIds = new Set(mine.map((a) => a.jobId));

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  // --- What is within reach: a recruiter across the desk, a hiring banner, the info desk, a person.
  const reach: Reach | null = (() => {
    if (!self) return null;
    for (const b of booths) {
      const talkAt = boothSpot(b, "talk");
      if (Math.abs(self.x - talkAt.x) < 1.9 && self.y > b.y + 2.6 && self.y < b.y + 4.4) return { kind: "recruiter", booth: b };
      const bannerAt = boothSpot(b, "banner");
      if (Math.hypot(self.x - bannerAt.x, self.y - bannerAt.y) < 0.9) return { kind: "banner", booth: b };
    }
    for (const sp of sponsors) {
      if (Math.abs(self.x - (sp.x + SPONSOR_W / 2)) < 0.9 && self.y > sp.y + SPONSOR_H && self.y < sp.y + SPONSOR_H + 1.2) return { kind: "sponsor", sponsor: sp };
    }
    const d = fair.fair.infoDesk;
    if (level === 0 && self.x > d.x - 0.4 && self.x < d.x + d.width + 0.4 && self.y > d.y + d.height && self.y < d.y + d.height + 1.3) return { kind: "info" };
    const other = [...fair.visitors.values()]
      .filter((v) => v.memberId !== self.memberId && v.floorId === self.floorId)
      .map((v) => ({ v, d: Math.hypot(v.x - self.x, v.y - self.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (other && other.d < 1.3) return { kind: "person", memberId: other.v.memberId, name: other.v.displayName };
    return null;
  })();
  const reachRef = useRef(reach);
  reachRef.current = reach;

  // Count a booth visit the first time the player stops by it.
  const boothHere = reach && (reach.kind === "recruiter" || reach.kind === "banner") ? reach.booth.id : null;
  useEffect(() => {
    if (!session || !boothHere || counted.current.has(boothHere)) return;
    counted.current.add(boothHere);
    fair.visit(session.visitorId, boothHere);
  }, [session, boothHere]);

  // --- Movement, every frame: keys first, otherwise follow a clicked route.
  useEffect(() => {
    if (!session) return;
    return onFrame((dt) => {
      const me = fair.visitors.get(session.visitorId);
      if (!me || busy.current) return;
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
      if (ix || iy) {
        route.current = null;
        goal.current = null;
      }
      else if (route.current) {
        const path = route.current;
        let next = path[0];
        while (next && Math.hypot(next.x - me.x, next.y - me.y) < 0.08) {
          path.shift();
          next = path[0];
        }
        if (!next) {
          route.current = null;
          goal.current = null;
          return;
        }
        ix = next.x - me.x;
        iy = next.y - me.y;
        speed = Math.min(speed, (Math.hypot(ix, iy) * 1000) / dt);
      }
      const len = Math.hypot(ix, iy);
      if (!len) return;
      const stepLen = (speed * dt) / 1000;
      const dx = (ix / len) * stepLen;
      const dy = (iy / len) * stepLen;
      const f = fair.floor(me.floorId);
      const to = route.current ? { x: me.x + dx, y: me.y + dy } : slide(f, me.x, me.y, dx, dy);
      fair.move(me.memberId, to.x, to.y, facingOf(dx, dy, me.facing));
      // Stairs take you up or down when you walk onto them yourself or are headed for another
      // floor; a route that only passes over them on its way across this floor stays here.
      const stairs = portalAt(f, to.x, to.y);
      if (stairs?.targetFloorId && (!goal.current || goal.current.floorId !== me.floorId)) {
        const up = fairFloorIndex(stairs.targetFloorId) > fairFloorIndex(f.id);
        fair.changeFloor(me.memberId, stairs.targetFloorId, stairs.targetX ?? 1, stairs.targetY ?? 1);
        setToast(`${up ? "Naik" : "Turun"} ke ${fair.floor(stairs.targetFloorId).name}`);
        route.current = null;
        if (goal.current) planRoute();
      }
    });
  }, [session]);

  // --- Keyboard.
  useEffect(() => {
    if (!session) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
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

  const enter = (c: Character) => {
    const v = fair.join(c.name, false, PLAYER_ID);
    if (!profile.name) updateProfile({ ...profile, name: c.name });
    counted.current.clear();
    setSession({ visitorId: v.memberId, name: c.name, look: c.look });
    setTalk({
      speaker: fair.fair.infoDesk.staff,
      pages: [
        `Halo, ${c.name}! Selamat datang di ${fair.fair.name}.`,
        `Ada ${fair.fair.booths.length} perusahaan dengan ${fair.fair.booths.reduce((n, b) => n + b.jobs.length, 0)} lowongan di ${fair.fair.floors.length} lantai: ${fair.fair.floors.map((f) => `${f.name} ${f.theme}`).join(", ")}.`,
        "Tangga naik dan turun ada di pojok kanan bawah tiap lantai. Kalau bingung, tanya aku saja, nanti aku antar ke stand mana pun.",
        "Berdiri di depan meja stand untuk ngobrol dengan recruiter, atau dekati banner di samping meja untuk lihat lowongan. Tekan E untuk bicara.",
      ],
    });
  };

  function interact() {
    if (!savedSession || busy.current) return;
    const r = reachRef.current;
    if (!r) return;
    if (r.kind === "recruiter") talkToRecruiter(r.booth);
    else if (r.kind === "banner") setBoard({ boothId: r.booth.id });
    else if (r.kind === "info") talkToInfo();
    else if (r.kind === "sponsor") openSponsor(r.sponsor);
    else talkToVisitor(r.memberId);
  }

  /** Route toward the goal: straight there on this floor, or to the stairs that lead toward its floor. */
  function planRoute() {
    const me = savedSession && fair.visitors.get(savedSession.visitorId);
    const g = goal.current;
    if (!me || !g) return;
    const f = fair.floor(me.floorId);
    if (g.floorId === me.floorId) {
      route.current = findPath(f, me, g);
      return;
    }
    const stairs = fair.stairsToward(f, g.floorId);
    route.current = stairs ? findPath(f, me, { x: stairs.x + stairs.width / 2, y: stairs.y + stairs.height / 2 }) : null;
  }

  const walkTo = (x: number, y: number) => {
    const me = session && fair.visitors.get(session.visitorId);
    if (!me || busy.current) return;
    const stairs = portalAt(fair.floor(me.floorId), x, y);
    goal.current = stairs?.targetFloorId ? { floorId: stairs.targetFloorId, x: stairs.targetX ?? 1, y: stairs.targetY ?? 1 } : { floorId: me.floorId, x, y };
    planRoute();
  };

  /** Walk to a booth's desk, on whatever floor. Called from menus that are still closing, so no busy check. */
  const goToBooth = (b: CompanyBooth) => {
    const me = session && fair.visitors.get(session.visitorId);
    if (!me) return;
    goal.current = { floorId: fair.floorIdOf(b), ...boothSpot(b, "talk") };
    planRoute();
  };

  /** "Lantai 2" for a floor id, for stair signs. */
  const shortName = (floorId: string) => fair.fair.floors[fairFloorIndex(floorId)]?.name ?? "Tangga";

  function talkToRecruiter(b: CompanyBooth) {
    const me = session && fair.visitors.get(session.visitorId);
    if (me) fair.move(me.memberId, me.x, me.y, "back");
    const open = b.jobs.filter((j) => !appliedIdsNow().has(j.id)).length;
    const main = (pages: string[]): Talk => ({
      speaker: `${b.recruiter} · ${b.company}`,
      pages,
      choices: [
        { label: "Tanya-tanya", onPick: () => setTalk(faq()) },
        { label: "Lihat lowongan", onPick: () => { setTalk(null); setBoard({ boothId: b.id }); } },
        { label: "Info perusahaan", onPick: () => { setTalk(null); setBoard({ boothId: b.id, about: true }); } },
        { label: open ? "Lamar kerja" : "Lamaranku", onPick: () => { setTalk(null); if (open) setApplying({ boothId: b.id }); else setPanel("applications"); } },
        { label: "Tutup", onPick: () => setTalk(null) },
      ],
    });
    const faq = (): Talk => ({
      speaker: `${b.recruiter} · ${b.company}`,
      pages: ["Silakan, mau tanya apa?"],
      choices: [
        ...b.faq.map((f) => ({ label: f.q, onPick: () => setTalk(main([f.a, "Ada lagi yang mau ditanyakan?"])) })),
        { label: "Kembali", onPick: () => setTalk(main(["Ada yang bisa aku bantu lagi?"])) },
      ],
    });
    setTalk(main([`Halo, ${session?.name ?? ""}! Aku ${b.recruiter} dari ${b.company}.`, `${b.about} Saat ini kami buka ${b.jobs.length} posisi.`]));
  }

  function updateProfile(p: SeekerProfile) {
    setProfile(p);
    saveProfile(p);
  }

  function openSponsor(sp: SponsorView) {
    setSponsor(sp);
    if (session) fair.viewSponsor(session.visitorId, sp.id);
  }

  function talkToInfo() {
    const staff = fair.fair.infoDesk.staff;
    const floorChoice = (i: number): Talk => ({
      speaker: `${staff} · Panitia`,
      pages: [`${fair.fair.floors[i]!.name} isinya ${fair.fair.floors[i]!.theme}. Mau ke stand mana?`],
      choices: [
        ...fair.fair.booths
          .filter((b) => b.floor === i)
          .map((b) => ({
            label: `${b.company} · ${b.jobs.length} lowongan`,
            onPick: () => {
              setTalk(null);
              goToBooth(b);
              setToast(i === level ? `Menuju stand ${b.company}` : `Menuju stand ${b.company} di ${fair.fair.floors[i]!.name}`);
            },
          })),
        { label: "Kembali", onPick: () => setTalk(main) },
      ],
    });
    const main: Talk = {
      speaker: `${staff} · Panitia`,
      pages: ["Ada yang bisa dibantu? Pilih lantainya, nanti aku antar ke stand perusahaan mana saja."],
      choices: [
        ...fair.fair.floors.map((f, i) => ({
          label: `${f.name} · ${f.theme} (${fair.fair.booths.filter((b) => b.floor === i).length} stand)`,
          onPick: () => setTalk(floorChoice(i)),
        })),
        { label: "Tutup", onPick: () => setTalk(null) },
      ],
    };
    setTalk(main);
  }

  function talkToVisitor(memberId: string) {
    const v = fair.visitors.get(memberId);
    if (!v || !session) return;
    const sent = fair.applications.filter((a) => a.visitorId === memberId);
    setTalk({
      speaker: v.displayName,
      pages: [
        sent.length
          ? `Hai! Aku barusan melamar ${sent[0]!.jobTitle} di ${sent[0]!.company}. Semoga lolos!`
          : `Hai! Aku ${v.displayName}, lagi keliling cari lowongan yang cocok.`,
      ],
      choices: [
        ...EMOTES.slice(0, 2).map((e) => ({
          label: `${EMOTE_ICON[e]} ${e === "wave" ? "Lambai" : "Semangat"}`,
          onPick: () => {
            fair.say(session.visitorId, e === "wave" ? "👋 Hai!" : "Semangat ya! 💪", 1800);
            setTalk(null);
          },
        })),
        { label: "Tutup", onPick: () => setTalk(null) },
      ],
    });
  }

  function appliedIdsNow() {
    const s = savedSession;
    return new Set(s ? fair.applications.filter((a) => a.visitorId === s.visitorId).map((a) => a.jobId) : []);
  }

  const submit = (boothId: string, input: ApplicationInput) => {
    if (!session) return;
    const a = fair.apply(session.visitorId, { boothId, ...input });
    updateProfile({ ...profile, name: input.name || profile.name, email: input.email, phone: input.phone, cvUrl: input.cvUrl });
    setApplying(null);
    if (a) setToast(`Lamaran ${a.jobTitle} terkirim ke ${a.company}`);
  };

  const leave = () => {
    if (!session) return;
    fair.leave(session.visitorId);
    setSession(null);
    setTalk(null);
    setPanel(null);
  };

  // --- Scene.
  const extras = [
    ...booths.flatMap((b) =>
      boothExtras(b, {
        onBanner: () => setBoard({ boothId: b.id }),
        onDesk: session ? () => goToBooth(b) : undefined,
      }),
    ),
    ...(level === 0 ? infoDeskExtras(fair.fair.infoDesk) : []),
    ...sponsors.map((sp) => sponsorExtras(sp, () => openSponsor(sp))),
  ];
  const npcs: NpcView[] = fair.staff.map((s) => {
    const b = s.boothId ? fair.booth(s.boothId) : undefined;
    return { id: s.id, name: s.name, floorId: s.floorId, x: s.x, y: s.y, facing: s.facing, look: staffLook(s.name, b?.color ?? "#1e3a8a") };
  });
  const avatars: AvatarState[] = [...fair.visitors.values()];
  const bubbles = Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]));
  const lookOf = (a: AvatarState) => (session && a.memberId === session.visitorId ? session.look : lookFor(`${a.displayName}:${a.memberId}`));

  const prompt =
    reach?.kind === "recruiter"
      ? `Ngobrol dengan ${reach.booth.recruiter} (${reach.booth.company})`
      : reach?.kind === "banner"
        ? `Lihat lowongan ${reach.booth.company}`
        : reach?.kind === "info"
          ? "Tanya panitia"
          : reach?.kind === "sponsor"
            ? `Lihat sponsor ${reach.sponsor.name}`
          : reach?.kind === "person"
            ? `Sapa ${reach.name}`
            : null;

  const boardBooth = board ? fair.booth(board.boothId) : undefined;
  const applyBooth = applying ? fair.booth(applying.boothId) : undefined;
  const totalJobs = fair.fair.booths.reduce((n, b) => n + b.jobs.length, 0);

  return (
    <div className="game">
      <CafeScene
        className="game-scene"
        floor={floor}
        floorName={shortName}
        hallTitle={fair.fair.name}
        occupiedSeatIds={new Set()}
        avatars={avatars}
        lookOf={lookOf}
        selfMemberId={session?.visitorId}
        npcs={npcs}
        bubbles={bubbles}
        extras={extras}
        hallSponsors={fair.fair.sponsors}
        follow={self ? { x: self.x, y: self.y } : null}
        onTileClick={session ? walkTo : undefined}
        onAvatarClick={session ? (id) => id !== session.visitorId && talkToVisitor(id) : undefined}
        onNpcClick={
          session
            ? (id) => {
                const b = fair.fair.booths.find((x) => recruiterId(x.id) === id);
                if (b) goToBooth(b);
                else {
                  const d = fair.fair.infoDesk;
                  walkTo(d.x + d.width / 2, d.y + d.height + 0.6);
                }
              }
            : undefined
        }
      >
        <div className="hud hud-tl rpg-box" data-collapsed={hud.info ? undefined : ""} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="hud-title hud-toggle" onClick={hud.toggleInfo} aria-expanded={hud.info} title={hud.info ? "Sembunyikan info" : "Tampilkan info"}>
            🎪 {fair.fair.name} <span className="hud-caret">{hud.info ? "▴" : "▾"}</span>
          </button>
          <div className="hud-floor">
            📍 {floorInfo?.name} · {floorInfo?.theme}
          </div>
          {hud.info && (
            <div className="hud-stats">
              <span>🏬 {fair.fair.floors.length} lantai</span>
              <span>🏢 {fair.fair.booths.length} perusahaan</span>
              <span>⭐ {fair.fair.sponsors.length} sponsor</span>
              <span>💼 {totalJobs} lowongan</span>
              <span>👥 {fair.visitors.size} pengunjung</span>
            </div>
          )}
        </div>

        {hud.map ? (
        <div className="hud hud-tr rpg-box" onPointerDown={(e) => e.stopPropagation()} onClick={hud.toggleMap} title="Sembunyikan denah" role="button">
          <svg aria-hidden viewBox={`-0.5 -0.5 ${floor.width + 1} ${floor.height + 1}`} className="minimap">
            <rect x={0} y={0} width={floor.width} height={floor.height} rx={0.6} fill="#cfd6df" />
            {booths.map((b) => (
              <g key={b.id}>
                <rect x={b.x} y={b.y} width={6} height={3.6} rx={0.3} fill={b.color} opacity={0.35} />
                <rect x={b.x} y={b.y} width={6} height={0.6} fill={b.color} />
              </g>
            ))}
            {sponsors.map((sp) => (
              <rect key={sp.id} x={sp.x} y={sp.y} width={0.9} height={0.9} fill={sp.color} />
            ))}
            {level === 0 && <rect x={fair.fair.infoDesk.x} y={fair.fair.infoDesk.y} width={fair.fair.infoDesk.width} height={0.7} fill="#1e3a8a" />}
            {(floor.objects ?? [])
              .filter((o) => o.type === "stairs")
              .map((o) => (
                <rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} rx={0.2} fill="#facc15" />
              ))}
            {avatars.filter((a) => a.floorId === floor.id).map((a) => (
              <circle key={a.memberId} cx={a.x} cy={a.y} r={a.memberId === session?.visitorId ? 0.55 : 0.32} fill={a.memberId === session?.visitorId ? "#f97316" : "#fff"} stroke="#2b1e19" strokeWidth={0.12} />
            ))}
          </svg>
          <div className="minimap-legend">Denah {floorInfo?.name ?? "aula"}</div>
        </div>
        ) : (
          <button type="button" className="hud hud-tr-btn rpg-box" onPointerDown={(e) => e.stopPropagation()} onClick={hud.toggleMap} title="Tampilkan denah">
            🗺️
          </button>
        )}

        <div className="hud-bottom">
          {talk ? (
            <DialogBox key={talk.speaker + talk.pages[0]} speaker={talk.speaker} pages={talk.pages} choices={talk.choices} onClose={() => setTalk(null)} />
          ) : prompt ? (
            <button type="button" className="rpg-box prompt" onClick={interact} onPointerDown={(e) => e.stopPropagation()}>
              <span className="rpg-kbd">E</span> {prompt}
            </button>
          ) : session ? (
            <div className="rpg-box hint">
              <span className="hint-keys">
                <span className="rpg-kbd">W</span><span className="rpg-kbd">A</span><span className="rpg-kbd">S</span><span className="rpg-kbd">D</span> jalan · <span className="rpg-kbd">E</span> bicara · klik meja stand untuk berjalan ke sana · klik banner untuk lihat lowongan
              </span>
              <span className="hint-touch">Tap lantai untuk berjalan · tap meja stand untuk ke sana · tap banner untuk lihat lowongan</span>
            </div>
          ) : null}
        </div>

        {toast && <div className="toast rpg-box">{toast}</div>}

        {session && (
          <div className="hud hud-bl" onPointerDown={(e) => e.stopPropagation()}>
            <div className="rpg-box actions">
              <button type="button" className="menu-btn" onClick={() => setPanel("profile")} title="Profil, lamaran, dan stempel stand">
                🎒 Profil
              </button>
              <button type="button" className="menu-btn" onClick={() => setPanel("applications")} title="Lamaran yang sudah kamu kirim">
                📋 Lamaran ({mine.length})
              </button>
              <button type="button" className="leave" onClick={leave} title="Keluar dari job fair">
                🚪 Keluar
              </button>
            </div>
          </div>
        )}

        {session && panel && (
          <SeekerPanel
            tab={panel}
            look={session.look}
            profile={profile}
            applications={mine}
            booths={fair.fair.booths}
            floors={fair.fair.floors}
            visited={fair.visitedBy.get(session.visitorId) ?? new Set()}
            onSaveProfile={updateProfile}
            onOpenJob={(boothId, jobId) => {
              setPanel(null);
              setBoard({ boothId, jobId });
            }}
            onOpenCompany={(boothId) => {
              setPanel(null);
              setBoard({ boothId, about: true });
            }}
            onGoTo={(boothId) => {
              const b = fair.booth(boothId);
              setPanel(null);
              if (b) {
                goToBooth(b);
                setToast(`Menuju stand ${b.company}`);
              }
            }}
            onReset={() => {
              fair.reset();
              clearProfile();
              setProfile(loadProfile());
              counted.current.clear();
              setPanel(null);
              setToast("Data demo dihapus");
            }}
            onClose={() => setPanel(null)}
          />
        )}

        {sponsor && <SponsorCard sponsor={sponsor} onClose={() => setSponsor(null)} />}

        {boardBooth && (
          <JobBoard
            booth={boardBooth}
            startJobId={board?.jobId}
            startAbout={board?.about}
            appliedJobIds={appliedIds}
            onClose={() => setBoard(null)}
            onApply={
              session
                ? (job) => {
                    setBoard(null);
                    setApplying({ boothId: boardBooth.id, jobId: job.id });
                  }
                : undefined
            }
          />
        )}

        {applyBooth && session && (
          <ApplyForm
            booth={applyBooth}
            jobId={applying?.jobId}
            defaultName={session.name}
            defaults={profile}
            appliedJobIds={appliedIds}
            onClose={() => setApplying(null)}
            onSubmit={(input) => submit(applyBooth.id, input)}
          />
        )}

        {!session && (
          <div className="title-screen" onPointerDown={(e) => e.stopPropagation()}>
            <CharacterCreator onCheckIn={enter} withCompanions={false} cta="Masuk job fair ▶" note="Di acara sungguhan, pengunjung registrasi lewat scan QR di pintu masuk." />
          </div>
        )}
      </CafeScene>
    </div>
  );
}
