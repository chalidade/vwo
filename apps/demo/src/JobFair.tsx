import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  type AvatarState,
  COIN_STAND_SPOTS,
  type CompanyBooth,
  EMOTES,
  type Emote,
  type FairRoom,
  type Promoter,
  SPONSOR_H,
  SPONSOR_W,
  type SponsorView,
  boothSpot,
  fairFloorId,
  infoDeskOn,
  fairFloorIndex,
  LIFT_FRONT,
  findPath,
  openJobs,
  hasStand,
  isFeatured,
  UMKM_CORNER,
  slide,
  isBlocked,
  price,
  stallSlot,
  stallSpot,
  aulaSpot,
  LOUNGE,
  loungeBoardSpot,
  atLibraryBooks,
  atLibraryDoor,
  atLibraryExit,
  LIBRARY_FRONT,
  librarySpot,
  loungeSpot,
  consultAddress,
  consultantDesk,
  safeImage,
  vipSeatBooth,
  anomalyRewardText,
  ANOMALY_INFO,
  type ParkBuilding,
  type ParkNpc,
  PHONE_FRONT,
  atPhoneBox,
  darkness,
  parkNpcHello,
  libraryNpcHello,
  libraryNpcSeats,
  libraryNpcsAt,
  librarySeatId,
  type LibraryNpc,
  parkNpcSeats,
  parkNpcsAt,
  scaredFlocks,
  PARK,
  atLobbyDoor,
  atParkDoor,
  lobbyDoorFront,
  parkPlots,
  plotAt,
  plotFront,
} from "@vwo/shared";
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
  emptyBoothExtras,
  coinStandExtras,
  foodStallExtras,
  emptyStallExtras,
  infoDeskExtras,
  liftExtras,
  liftSignExtras,
  psikotesExtras,
  promoterExtras,
  seminarStageExtras,
  aulaExtras,
  loungeExtras,
  libraryNpcExtras,
  libraryRoomExtras,
  type StageScreen,
  lookFor,
  sponsorExtras,
  anomalyExtras,
  parkDoorExtras,
  parkExtras,
  parkLights,
} from "@vwo/ui";
import { InstallButton } from "./install";
import { CharacterCreator, ReturningCard, loadCharacter, type Character } from "./CharacterCreator";
import { AccountGate } from "./AccountGate";
import { type Account, checkSession, currentAccount, logout, resendVerification } from "./account";
import { applyErrorText, myApplications, sendApplication as sendToServer } from "./server-fair";
import { LIVE } from "./mode";
import { claimPaidCoins, pay } from "./payments";
import { KEY_DIRS, RUN, WALK, facingOf, useHud } from "./controls";
import {
  type FloorPass,
  MAX_BOTS,
  PLAYER_ID,
  loungePlans,
  consultantId,
  LIBRARIAN_ID,
  promoterId,
  recruiterId,
  remoteId,
  roomStaffId,
  spgId,
  spgName,
  stallStaffId,
} from "./jobfair-engine";
import { LiveChannel, type LiveStatus } from "./live";
import { PING_REPLIES, PING_STARTERS, PING_TEXT, type Ping, PingLimiter, parsePing } from "./fair/social";
import { FollowBar, type PingCardView, PingCards } from "./fair/Pings";
import { playPing } from "./fair/ringtone";
import { COMPANY_TITLES, SEEKER_TITLES, levelOf, liveSeminar } from "./fair/content";
import { FoodMenu } from "./fair/FoodMenu";
import { CallScreen } from "./fair/Call";
import { type RingSignal, canCallOtherTabs, listenForCalls, loadRelay, newCallId, onSignal, sendSignal } from "./fair/call";
import { LiftPanel } from "./fair/Lift";
import { ParkCard, libraryNpcLook, parkNpcLook } from "./fair/Park";
import { PhoneBox } from "./fair/PhoneBox";
import { phoneBook } from "./fair/phone-book";
import { parkNow } from "./fair/park-clock";
import { LevelBar } from "./fair/Modal";
import { InviteCard, VisitCard } from "./fair/Invite";
import { type GuidePlace, GuidePanel, PlaceIntro, markPlaceSeen, placeSeen, reachHint } from "./fair/Guide";
import { NotifList } from "./fair/Notifs";
import { PushCard } from "./fair/PushCard";
import { Modal } from "./fair/Modal";
import { SofaGames } from "./fair/Games";
import { Library } from "./fair/Library";
import { FriendsPanel, type FriendOnline } from "./fair/Friends";
import { addFriend, friendOf, loadFriends, myTag, removeFriend, useFriends } from "./fair/friends";
import { MissionsPanel } from "./fair/Missions";
import { type MapPlace, MapPanel } from "./fair/Map";
import { PromoCard } from "./fair/Promo";
import { BoothMediaPanel, mediaOf } from "./fair/BoothMedia";
import { useStageFeed } from "./fair/stage";
import { streamFor, useStageNow } from "./fair/stage-now";
import { StageFeedPanel } from "./fair/StageFeed";
import { LoungeDesk, type LoungeCallStart, type LoungeView, PEER_LINES } from "./fair/Lounge";
import { PsychTest } from "./fair/PsychTest";
import { SeminarView } from "./fair/Seminar";
import { VerifyPanel } from "./fair/Verify";
import { WalletPanel } from "./fair/Wallet";
import { staffLook } from "./fair/staff-look";
import { BookStand } from "./fair/BookStand";
import { RentStall } from "./fair/RentStall";
import { type CoinAsk, CoinConfirmModal } from "./fair/CoinConfirm";
import { AulaBoard, type AulaTab } from "./fair/Aula";
import { useReminderAlerts } from "./fair/reminders";
import { PROFILE_EVENT, type SeekerProfile, clearProfile, loadProfile, saveProfile } from "./profile";
import { SeekerPanel, type SeekerTab } from "./SeekerPanel";
import { onFrame } from "./loop";
import { loadSpot, saveSpot, setInside, wasInside } from "./fair/last-spot";
import { fair, useFair } from "./useFair";
import { claimAnomaly, startAnomalies, useAnomaly, useAnomalyCollection } from "./anomaly-sync";
import { pollVisible } from "./poll";
import { loadRuntimeConfig, runtimeConfig } from "./runtime-config";

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
  | { kind: "person"; memberId: string; name: string }
  | { kind: "coins" }
  | { kind: "stall"; stallId: string; name: string }
  | { kind: "lift" }
  | { kind: "seat"; seatId: string }
  | { kind: "promoter"; promoter: Promoter }
  | { kind: "seated"; room: FairRoom }
  | { kind: "sofa" }
  | { kind: "aula"; tab: AulaTab }
  | { kind: "consult"; index: number }
  | { kind: "loungeBoard" }
  | { kind: "library" }
  | { kind: "libraryIn" }
  | { kind: "libraryOut" }
  | { kind: "parkOut" }
  | { kind: "parkIn" }
  | { kind: "phone" }
  | { kind: "soon"; building: ParkBuilding };

const ANN_SEEN_KEY = "vwo:jobfair-ann-seen";

const EMOTE_ICON: Record<Emote, string> = { wave: "👋", cheers: "🥂", laugh: "😄", heart: "❤️" };

/** Recruiters wear a jacket in their company's colour; the organisers wear navy. */

/** A VIP booth's SPG: a neat blazer in the company colour, hair up, a big smile. */
export function spgLook(name: string, color: string): Look {
  return {
    ...lookFor(`spg:${name}`),
    outfit: "blazer",
    shirt: color,
    accent: "#fde68a",
    pants: "#1f2937",
    shoes: "#111827",
    style: name.length % 2 ? "bun" : "ponytail",
    face: "happy",
    hat: undefined,
    glasses: false,
    mustache: false,
    backpack: undefined,
    prop: undefined,
  };
}

/** Floor arrows pointing to the lift, laid in the aisles of each kind of floor. */
// The halls' right half, past the lift, has its own arrows pointing back to it.
const RIGHT_SIGNS = [
  { x: 52, y: 14.8 },
  { x: 57, y: 6.7 },
  { x: 74, y: 14.8 },
  { x: 91, y: 6.7 },
];
const GROUND_SIGNS = [{ x: 13, y: 15.2 }, { x: 23, y: 6.7 }, { x: 32.5, y: 14.8 }, ...RIGHT_SIGNS];
const HALL_SIGNS = [{ x: 6, y: 15.2 }, { x: 23, y: 6.7 }, { x: 33.5, y: 14.8 }, ...RIGHT_SIGNS];
const ROOM_SIGNS = [
  { x: 11, y: 19.6 },
  { x: 25, y: 19.6 },
];

let savedSession: Session | null = null; // survives switching to the organiser view and back

let pingSeq = 0;

export function JobFair() {
  useFair();
  const [session, setSession] = useState<Session | null>(() => (savedSession && currentAccount() && fair.visitors.has(savedSession.visitorId) ? savedSession : null));
  const [talk, setTalk] = useState<Talk | null>(null);
  const [board, setBoard] = useState<{ boothId: string; jobId?: string; about?: boolean } | null>(null);
  const [applying, setApplying] = useState<{ boothId: string; jobId?: string } | null>(null);
  const [panel, setPanel] = useState<SeekerTab | null>(null);
  const [sponsor, setSponsor] = useState<SponsorView | null>(null);
  const [profile, setProfile] = useState<SeekerProfile>(loadProfile);
  // Live site: the account's saved profile came from the server (first load, another device, a pre-registration).
  useEffect(() => {
    const on = () => setProfile(loadProfile());
    window.addEventListener(PROFILE_EVENT, on);
    return () => window.removeEventListener(PROFILE_EVENT, on);
  }, []);
  const [account, setAccount] = useState<Account | null>(currentAccount);
  // Live site: the session cookie may have expired or been signed out on another device.
  useEffect(() => {
    if (!LIVE) return;
    let gone = false;
    void checkSession().then((a) => {
      if (!gone && ((a?.email ?? null) !== (account?.email ?? null) || a?.mustVerify !== account?.mustVerify)) setAccount(a);
    });
    return () => {
      gone = true;
    };
    // Checked once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Live site: the seeker's applications and the companies' answers come from the server, on every device.
  useEffect(() => {
    if (!LIVE || !account) return;
    const pull = () => void myApplications().then((r) => r.ok && fair.mergeServer(r.data.applications, true));
    // Often enough for a chat with HR to feel live (APPLICATIONS_POLL_SEC); a returning tab catches up at once.
    return pollVisible(pull, () => runtimeConfig().applicationsPollSec);
  }, [account?.email]);
  /** The saved character for this account: set once, then changed from the profile. */
  const character = account ? loadCharacter() : null;
  const [editLook, setEditLook] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** A cat, fireflies or another surprise somewhere in the building (the server says which and where). */
  const anomaly = useAnomaly();
  const collection = useAnomalyCollection();
  const catching = useRef(false);
  useEffect(() => startAnomalies(), []);
  // How much of the screen the bottom tab bar really covers (taller with big system fonts or a
  // home-indicator inset): the action button sits above it and the camera keeps the floor's last row clear.
  const navRef = useRef<HTMLDivElement>(null);
  const [navSpace, setNavSpace] = useState(0);
  /** How far the tab bar reaches from the left edge: on a desktop the keys hint sits beside it. */
  const [navRight, setNavRight] = useState(0);
  useEffect(() => {
    const nav = navRef.current;
    const game = nav?.parentElement;
    if (!nav || !game) return setNavSpace(0);
    const measure = () => {
      const g = game.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      setNavSpace(Math.ceil(g.bottom - n.top));
      setNavRight(Math.ceil(n.right - g.left));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    ro.observe(game);
    return () => ro.disconnect();
  }, [session]);
  const [inviteId, setInviteId] = useState<string | null>(null);
  /** The guide is open, and the place whose introduction is showing (once, the first time in). */
  const [guide, setGuide] = useState(false);
  const [intro, setIntro] = useState<GuidePlace | null>(null);
  // The organiser's announcement stays on screen until the visitor closes it; a new one shows again.
  const announcement = fair.org.announcement;
  const [annSeen, setAnnSeenRaw] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(ANN_SEEN_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const setAnnSeen = (at: number) => {
    setAnnSeenRaw(at);
    try {
      localStorage.setItem(ANN_SEEN_KEY, String(at));
    } catch {
      // Private mode: it shows again next visit.
    }
  };
  /** The wallet is open; "desk" when the info desk opened it, where coins can be bought too. */
  const [wallet, setWallet] = useState<boolean | "desk">(false);
  const [stall, setStall] = useState<string | null>(null);
  const [psych, setPsych] = useState(false);
  const [seminar, setSeminar] = useState(false);
  const [aula, setAula] = useState<AulaTab | null>(null);
  const [notifs, setNotifs] = useState(false);
  const [lounge, setLounge] = useState<LoungeView | null>(null);
  const [loungeCall, setLoungeCall] = useState<
    (LoungeCallStart & { name: string; sub: string; color: string; look?: Look; lines: readonly string[]; ring?: RingSignal; payOnAnswer?: boolean }) | null
  >(null);
  const [lift, setLift] = useState(false);
  /** The park's phone box is open. */
  const [phone, setPhone] = useState(false);
  const [verify, setVerify] = useState(false);
  const [promo, setPromo] = useState<Promoter | null>(null);
  const [media, setMedia] = useState<{ boothId: string; acc: string } | null>(null);
  const [booking, setBooking] = useState<{ floor: number; x: number; y: number } | null>(null);
  const [renting, setRenting] = useState<number | null>(null);
  /** Coins about to be spent, waiting for a yes. */
  const [coinAsk, setCoinAsk] = useState<CoinAsk | null>(null);
  const [games, setGames] = useState(false);
  const [library, setLibrary] = useState(false);
  const [missions, setMissions] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [ring, setRing] = useState<RingSignal | null>(null);
  const [live, setLive] = useState<{ status: LiveStatus; peers: number }>({ status: "connecting", peers: 0 });
  /** How players on other devices look, by their visitor id here. */
  const remoteLooks = useRef(new Map<string, Look>());
  const liveChannel = useRef<LiveChannel | null>(null);
  /** Quick messages from other job seekers, newest last. */
  const [pings, setPings] = useState<PingCardView[]>([]);
  /** The job seeker this player is walking after. */
  const [follow, setFollow] = useState<{ memberId: string; name: string } | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;
  /** People pointed out on the floor (who pinged us, who we follow), until a time. */
  const marks = useRef(new Map<string, number>());
  const muted = useRef(new Set<string>());
  const pingLimit = useRef(new PingLimiter());
  const friends = useFriends();
  const [friendsOpen, setFriendsOpen] = useState(false);
  const hud = useHud();
  savedSession = session;

  // Calls and the stage broadcast need the relay servers; fetch them ahead so ringing isn't delayed.
  useEffect(() => {
    if (session) void loadRelay();
  }, [session]);

  // Friends: loaded on sign-in, and now and then for requests sent from other devices.
  useEffect(() => {
    if (!session) return;
    return pollVisible(
      () => void loadFriends(),
      () => runtimeConfig().friendsPollSec,
    );
  }, [session]);

  // Remember where the player stands, so a reload or a trip to the payment page comes back here.
  useEffect(() => {
    if (!session) return;
    const who = account?.email ?? "guest";
    const save = () => {
      const me = fair.visitors.get(session.visitorId);
      if (me) saveSpot(who, me);
    };
    const timer = setInterval(save, 2_000);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      save();
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [session, account?.email]);

  // Left while inside the fair (closed the app, paid, reloaded): walk straight back in.
  const autoEntered = useRef(false);
  useEffect(() => {
    if (session || autoEntered.current || !account || !character || !wasInside(account.email)) return;
    autoEntered.current = true;
    enter(character);
  });

  const keys = useRef(new Set<string>());
  const route = useRef<{ x: number; y: number }[] | null>(null);
  /** Where a clicked walk ends, possibly on another floor: the route then leads to the lift first. */
  /** `then` runs on arrival: tapping a recruiter walks there and opens the conversation. */
  const goal = useRef<{ floorId: string; x: number; y: number; seatId?: string; then?: () => void } | null>(null);
  const busy = useRef(false);
  busy.current = !!(
    talk ||
    board ||
    applying ||
    panel ||
    sponsor ||
    wallet ||
    stall ||
    psych ||
    seminar ||
    lift ||
    verify ||
    promo ||
    games ||
    library ||
    missions ||
    mapOpen ||
    inviteId ||
    aula ||
    notifs ||
    lounge ||
    loungeCall ||
    phone ||
    guide ||
    intro
  );
  const counted = useRef(new Set<string>());

  const self = session ? fair.visitors.get(session.visitorId) : undefined;
  const floor = fair.floor(self?.floorId ?? fair.floors[0]!.id);
  /** Set when the player is on a room floor (food court, seminar, psikotes) rather than a hall. */
  const room = fair.roomOf(floor.id);
  /** On air in the room the job seeker is in (a speaker, or a session's stream link by the schedule). */
  const stageLive = useStageNow(room?.kind === "aula" ? "aula" : room?.kind === "seminar" ? "seminar" : undefined);
  /** Outside, in the park: no booths, no lift, the way back in is the event building's door. */
  const park = floor.id === fair.parkId;
  /** Inside the Perpustakaan in the park: bookcases and reading tables, the door leads back out. */
  const libRoom = floor.id === fair.libraryId;
  /** The floor everyone comes in on: its door leads out to the park. */
  const lobby = floor.id === fair.lobbyId;
  /** Which hall this is (booths, sponsors and slots are stored per hall), or -1 in a room or the park. */
  const hall = room || park || libRoom ? -1 : fairFloorIndex(floor.id);
  /** The first hall has the entrance hall's info desk and its own lift signs. */
  const firstHall = hall === 0;
  const stop = fair.stopOf(floor.id);
  /** Booths standing on this hall; mini (UMKM) booths have no stand and are listed in the Pojok UMKM instead. */
  const booths = room ? [] : fair.fair.booths.filter((b) => b.floor === hall && hasStand(b));
  const sponsors = room ? [] : fair.fair.sponsors.filter((sp) => sp.floor === hall);
  const coinHere = !room && fair.fair.coinStand.floor === hall;
  const promotersHere = fair.fair.promoters.filter((p) => p.level === stop.level && !p.walks);
  /** Every floor has an info desk; the first hall's is the one by the entrance. */
  const desk = infoDeskOn(fair.fair, floor.id);
  /** A speaker broadcasts to the room the job seeker is in: its big screen and the corner panel play it. */
  const liveHere = !!stageLive && !!session && ((room?.kind === "aula" && stageLive.venue === "aula") || (room?.kind === "seminar" && stageLive.venue !== "aula"));
  const place: GuidePlace = park ? "taman" : libRoom ? "perpustakaan" : room ? room.kind : "hall";
  // The first time in a place (after the welcome), say what it is for and how to use it.
  useEffect(() => {
    if (!session || talk || intro || guide) return;
    const who = account?.email ?? "guest";
    if (placeSeen(who, place)) return;
    markPlaceSeen(who, place);
    setIntro(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, place, talk]);
  const feed = useStageFeed(stageLive, liveHere && !seminar, session?.name ?? "Pengunjung");
  const me = fair.player;
  const seeker = levelOf(me.xp);
  // The park by its clock: how dark it is, and its people (worked out here, never sent anywhere).
  const parkAt = park ? parkNow() : 0;
  const dark = park ? darkness(parkAt) : 0;
  const benchSeatId = (bench: number, side: 0 | 1) => `${fair.parkId}-bench${bench + 1}-${"AB"[side]}`;
  const visitorSeats = fair.occupiedSeats();
  const parkPeople: ParkNpc[] = park ? parkNpcsAt(parkAt, (b, side) => visitorSeats.has(benchSeatId(b, side))) : [];
  // The reading room's people, from the clock too.
  const libPeople: LibraryNpc[] = libRoom ? libraryNpcsAt(Date.now(), (t, k) => visitorSeats.has(librarySeatId(floor.id, t, k))) : [];
  /** Seats taken: by visitors, in the park the bench seats its people sit on, in the library their chairs. */
  const occupied = park
    ? new Set([...visitorSeats, ...parkNpcSeats(parkAt).map(([b, side]) => benchSeatId(b, side))])
    : libRoom
      ? new Set([...visitorSeats, ...libraryNpcSeats().map(([t, k]) => librarySeatId(floor.id, t, k))])
      : visitorSeats;
  const mine = session ? fair.applications.filter((a) => a.visitorId === session.visitorId) : [];
  const appliedIds = new Set(mine.map((a) => a.jobId));

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // Following someone: keep walking to just behind them, onto other floors too.
  useEffect(() => {
    if (!follow || !session) return;
    const step = () => {
      const t = fair.visitors.get(follow.memberId);
      const me = fair.visitors.get(session.visitorId);
      if (!me) return;
      if (!t) {
        setFollow(null);
        setToast(`${follow.name} sudah keluar dari job fair`);
        return;
      }
      if (busy.current) return;
      mark(follow.memberId, 1_500);
      if (t.floorId !== me.floorId) {
        if (closedFloor(t.floorId)) return setFollow(null);
        const into = fair.passFor(t.floorId);
        if (into && !fair.hasTicket(into.id)) {
          setFollow(null);
          askTicket(into, () => startFollow(follow.memberId, false));
          return;
        }
        if (goal.current?.floorId !== t.floorId) goTo(t.floorId, t.x, t.y + 0.9);
        return;
      }
      if (Math.hypot(t.x - me.x, t.y - me.y) > 1.6 && (!goal.current || Math.hypot(goal.current.x - t.x, goal.current.y - t.y) > 0.8)) goTo(t.floorId, t.x, t.y + 0.9);
    };
    step();
    const timer = window.setInterval(step, 600);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, session]);

  // A company scheduled an interview: show the invitation once, over everything but a call.
  // An office visit invitation is queued as "visit:<application id>".
  const inviteVisit = !!inviteId?.startsWith("visit:");
  const invite = inviteId ? fair.applications.find((a) => a.id === inviteId.replace(/^visit:/, "")) : undefined;
  useEffect(() => {
    if (!inviteId && fair.interviewAlerts.length) setInviteId(fair.interviewAlerts.shift()!);
  });

  // An hour and ten minutes before an interview, office visit or reminded Aula item: queued with the other toasts.
  const [, kick] = useReducer((n: number) => n + 1, 0);
  const remindToast = useCallback((text: string) => {
    fair.notices.push(text);
    kick();
  }, []);
  useReminderAlerts(!!session, remindToast);

  // Level-ups and company ratings arrive from the engine; show them one at a time.
  useEffect(() => {
    if (toast) return;
    const up = fair.levelUps.shift();
    if (up) setToast(`🎉 Naik level! Lv ${up} · ${SEEKER_TITLES[up - 1]}`);
    else {
      const n = fair.notices.shift();
      if (n) setToast(/^\p{L}/u.test(n) ? `⭐ ${n}` : n);
    }
  });

  // A company calls about an application, from its portal in another tab.
  useEffect(
    () =>
      onSignal((s) => {
        // Live rings only reach this device through its own inboxes (see listenForCalls).
        if (s.type !== "ring" || (!LIVE && s.to !== PLAYER_ID)) return;
        setRing((cur) => {
          if (cur) sendSignal({ type: "decline", callId: s.callId });
          return cur ?? s;
        });
        navigator.vibrate?.([300, 200, 300]);
      }),
    [],
  );

  // Live: the company rings the account, wherever it is signed in.
  useEffect(() => (LIVE && account?.id ? listenForCalls([`user:${account.id}`]) : undefined), [account?.id]);

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
    if (room?.kind === "konsultasi" && !self.seatId) {
      for (let i = 0; i < (room.consultants ?? []).length && i < LOUNGE.pods.length; i++) {
        const at = loungeSpot(consultantDesk(room.consultants![i]!, i), "front");
        if (Math.abs(self.x - at.x) < 1.8 && Math.abs(self.y - at.y) < 0.9) return { kind: "consult", index: i };
      }
      const b = loungeBoardSpot();
      if (Math.abs(self.x - b.x) < 1.6 && Math.abs(self.y - b.y) < 0.9) return { kind: "loungeBoard" };
    }
    if (self.seatId && room) return { kind: "seated", room };
    if (libRoom) {
      if (self.seatId || atLibraryBooks(self.x, self.y)) return { kind: "library" };
      if (atLibraryExit(self.x, self.y)) return { kind: "libraryOut" };
    }
    if (room?.kind === "aula")
      for (const tab of ["rundown", "info"] as const) {
        const at = aulaSpot(tab);
        if (Math.abs(self.x - at.x) < 1.6 && Math.abs(self.y - at.y) < 0.9) return { kind: "aula", tab: tab === "rundown" ? "jadwal" : "info" };
      }
    if (self.seatId) return { kind: "sofa" };
    if (park) {
      if (atParkDoor(self.x, self.y)) return { kind: "parkIn" };
      if (atPhoneBox(self.x, self.y)) return { kind: "phone" };
      if (atLibraryDoor(self.x, self.y)) return { kind: "libraryIn" };
      const i = plotAt(self.x, self.y);
      const b = i >= 0 ? parkPlots(fair.shownParkBuildings())[i]?.building : null;
      if (b) return { kind: "soon", building: b };
    }
    if (lobby && atLobbyDoor(floor, self.x, self.y)) return { kind: "parkOut" };
    if (coinHere) {
      const c = fair.fair.coinStand;
      if (Math.abs(self.x - (c.x + COIN_STAND_SPOTS.front.x)) < 2 && self.y > c.y + 2.1 && self.y < c.y + 3.6) return { kind: "coins" };
    }
    if (!park && !libRoom && Math.abs(self.x - LIFT_FRONT.x) < 1.7 && Math.abs(self.y - LIFT_FRONT.y) < 1) return { kind: "lift" };
    if (room?.stalls) {
      for (const [i, st] of room.stalls.entries()) {
        const at = stallSpot(stallSlot(st, i), "order");
        if (Math.abs(self.x - at.x) < 2.2 && Math.abs(self.y - at.y) < 0.9) return { kind: "stall", stallId: st.id, name: st.name };
      }
    }
    {
      const seat = floor.seats
        .filter((st) => !occupied.has(st.id))
        .map((st) => ({ st, d: Math.hypot(st.x - self.x, st.y - self.y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (seat && seat.d < 0.9) return { kind: "seat", seatId: seat.st.id };
    }
    for (const p of promotersHere) if (Math.hypot(self.x - p.x, self.y - (p.y + 1.1)) < 1.1) return { kind: "promoter", promoter: p };
    const d = desk;
    if (!park && !libRoom && self.x > d.x - 0.4 && self.x < d.x + d.width + 0.4 && self.y > d.y + d.height && self.y < d.y + d.height + 1.3) return { kind: "info" };
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
        if (followRef.current) setFollow(null);
        if (me.seatId) {
          fair.stand(me.memberId);
          return;
        }
      } else if (route.current) {
        const path = route.current;
        let next = path[0];
        while (next && Math.hypot(next.x - me.x, next.y - me.y) < 0.08) {
          path.shift();
          next = path[0];
        }
        if (!next) {
          route.current = null;
          // At the lift or the park door with somewhere else to be: go through, then walk on.
          if (goal.current && goal.current.floorId !== me.floorId) {
            if (travel(goal.current.floorId)) planRoute();
            else goal.current = null;
            return;
          }
          const seatId = goal.current?.seatId;
          const then = goal.current?.then;
          goal.current = null;
          if (seatId) sitDown(seatId);
          then?.();
          return;
        }
        ix = next.x - me.x;
        iy = next.y - me.y;
        speed = Math.min(speed, (Math.hypot(ix, iy) * 1000) / dt);
      }
      const len = Math.hypot(ix, iy);
      if (!len) return;
      if (me.seatId) fair.stand(me.memberId);
      const stepLen = (speed * dt) / 1000;
      const dx = (ix / len) * stepLen;
      const dy = (iy / len) * stepLen;
      const f = fair.floor(me.floorId);
      const to = route.current ? { x: me.x + dx, y: me.y + dy } : slide(f, me.x, me.y, dx, dy);
      fair.move(me.memberId, to.x, to.y, facingOf(dx, dy, me.facing));
    });
  }, [session]);

  // --- Real people on other devices: share our player, mirror theirs. Limits come from the server's
  // env (see runtime-config.ts); switched off or too crowded, this visit is played solo with bots.
  const friendTags = useRef<string[]>([]);
  friendTags.current = friends.friends.filter((f) => f.state === "friend").map((f) => f.tag);
  useEffect(() => {
    if (!session) return;
    let gone = false;
    let toldFull = false;
    let stop = () => {};
    // Waits a moment for the server's limits; an unreachable server leaves the defaults.
    void Promise.race([loadRuntimeConfig(), new Promise<void>((r) => setTimeout(r, 4000))]).then(() => {
      const cfg = runtimeConfig();
      if (gone) return;
      const channel = new LiveChannel({
        room: "jobfair",
        self: () => {
          const v = fair.visitors.get(session.visitorId);
          if (!v) return null;
          const b = fair.bubbles.get(session.visitorId);
          // Walking a clicked route, or steering with the keys: sent as where to and how fast, not step by step.
          const run = keys.current.has("ShiftLeft") || keys.current.has("ShiftRight");
          let ix = 0;
          let iy = 0;
          if (!busy.current)
            for (const k of keys.current) {
              const d = KEY_DIRS[k];
              if (d) {
                ix += d[0];
                iy += d[1];
              }
            }
          const len = Math.hypot(ix, iy);
          const speed = run ? RUN : WALK;
          const walking = !busy.current && route.current?.length ? route.current : null;
          return {
            name: session.name,
            look: session.look,
            floorId: v.floorId,
            x: v.x,
            y: v.y,
            facing: v.facing,
            seatId: v.seatId ?? null,
            say: b && b.until > Date.now() ? b.text : null,
            verified: !!fair.player.verified,
            tag: myTag(),
            route: len ? null : walking,
            routeSeat: walking && goal.current?.floorId === v.floorId ? (goal.current.seatId ?? null) : null,
            vel: len ? { x: (ix / len) * speed, y: (iy / len) * speed } : null,
            speed,
          };
        },
        onPeer: (p) => {
          remoteLooks.current.set(remoteId(p.id), p.look);
          fair.upsertRemote(p);
        },
        onGone: (id) => {
          remoteLooks.current.delete(remoteId(id));
          fair.removeRemote(id);
        },
        knownFloor: (id) => fair.floors.some((f) => f.id === id),
        onStatus: (status, peers) => {
          setLive({ status, peers });
          if (status === "full" && !toldFull) {
            toldFull = true;
            setToast("Ramai sekali, kamu masuk mode solo");
          }
          // Playing solo on the live site: the fair's bots keep it lively.
          if (LIVE && (status === "solo" || status === "full")) fair.maxBots = MAX_BOTS;
        },
        onDirect: (from, data) => receivePing(remoteId(from), data),
        friends: () => friendTags.current,
        config: cfg.live,
      });
      liveChannel.current = channel;
      channel.start();
      const off = onFrame(() => channel.frame());
      stop = () => {
        off();
        channel.stop();
        liveChannel.current = null;
        if (LIVE) fair.maxBots = 0;
      };
    });
    return () => {
      gone = true;
      stop();
    };
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
      } else if ((e.code === "KeyE" || ((e.key === "Enter" || e.code === "Space") && tag !== "BUTTON")) && !e.repeat) {
        // Enter and Space on a focused button press that button (keyboard users reach the HUD this way).
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
    const who = account?.email ?? "guest";
    // Back where they left off: same floor, same spot (if it is still free to stand on).
    const spot = loadSpot(who);
    // A floor the organiser closed since then: start at the entrance instead.
    const back = spot && fair.floors.some((f) => f.id === spot.floorId) && !fair.floorClosed(spot.floorId);
    if (spot && back && !isBlocked(fair.floor(spot.floorId), spot.x, spot.y)) fair.placeAt(v.memberId, spot.floorId, spot.x, spot.y);
    setInside(who, true);
    // Read fresh: the server's copy (a pre-registration, another device) may have arrived after this page opened.
    const saved = loadProfile();
    if (!saved.name || (!saved.email && account)) updateProfile({ ...saved, name: saved.name || account?.name || c.name, email: saved.email || account?.email || "" });
    counted.current.clear();
    setSession({ visitorId: v.memberId, name: c.name, look: c.look });
    // The long tour is for the first visit; after that a short hello is enough.
    const seenKey = `vwo:intro-seen:${account?.email ?? "guest"}`;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey) === "1";
      localStorage.setItem(seenKey, "1");
    } catch {
      // Blocked storage: show the tour every time.
    }
    if (seen) {
      setToast(`Selamat datang kembali, ${c.name}! Tanya meja info kalau butuh arah.`);
      return;
    }
    setTalk({
      speaker: fair.fair.infoDesk.staff,
      pages: [
        `Halo, ${c.name}! Selamat datang di ${fair.fair.name}.`,
        `Ada ${fair.fair.booths.length} perusahaan dengan ${fair.fair.booths.reduce((n, b) => n + openJobs(b).length, 0)} lowongan di ${fair.fair.floors.length} lantai: ${fair.fair.floors.map((f) => `${f.name} ${f.theme}`).join(", ")}.`,
        `Lift ada di bagian bawah tiap lantai (di lantai booth letaknya di tengah), ikuti tanda 🛗 di lantai. ${fair.stops
          .filter((st) => st.roomId)
          .map((st) => `${st.name} ${st.label}`)
          .join(", ")}.`,
        "Kalau bingung, tanya aku saja, nanti aku antar ke stand mana pun.",
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
    else if (r.kind === "coins") setWallet(true);
    else if (r.kind === "stall") openStall(r.stallId);
    else if (r.kind === "lift") setLift(true);
    else if (r.kind === "seat") sitDown(r.seatId);
    else if (r.kind === "seated") startActivity(r.room);
    else if (r.kind === "sofa") setGames(true);
    else if (r.kind === "promoter") goToPromoter(r.promoter);
    else if (r.kind === "aula") setAula(r.tab);
    else if (r.kind === "consult") setLounge({ mode: "consult", index: r.index });
    else if (r.kind === "loungeBoard") setLounge({ mode: "info" });
    else if (r.kind === "library") setLibrary(true);
    else if (r.kind === "libraryIn") stepThrough(fair.libraryId);
    else if (r.kind === "libraryOut") stepThrough(fair.parkId);
    else if (r.kind === "parkOut") stepThrough(fair.parkId);
    else if (r.kind === "parkIn") stepThrough(fair.lobbyId);
    else if (r.kind === "phone") setPhone(true);
    else if (r.kind === "soon") return;
    else talkToVisitor(r.memberId);
  }

  /** Route toward the goal: straight there on this floor, else to the lift or the park door on the way. */
  function planRoute() {
    let me = savedSession && fair.visitors.get(savedSession.visitorId);
    const g = goal.current;
    if (!me || !g) return;
    // Get up first: a walled-in seat (a VIP lounge armchair) has no path out until we step off it.
    if (me.seatId) {
      fair.stand(me.memberId);
      me = fair.visitors.get(me.memberId)!;
    }
    const f = fair.floor(me.floorId);
    if (g.floorId === me.floorId) {
      // A chair tucked under a desk may not be on the walk grid; the last step onto it is fine.
      route.current = findPath(f, me, g) ?? (g.seatId ? [{ x: g.x, y: g.y }] : null);
      return;
    }
    const at = fair.hop(me.floorId, g.floorId).at;
    route.current = findPath(f, me, at) ?? [at];
  }

  /** The next leg toward another floor, from where the player stands: the lift (a ticket first for a
   *  paid floor), or through the door between the lobby and the park. False when not going. */
  function travel(floorId: string) {
    const me = savedSession && fair.visitors.get(savedSession.visitorId);
    if (!me) return false;
    const h = fair.hop(me.floorId, floorId);
    if (h.via === "lift") return rideTo(h.floorId);
    fair.takeHop(me.memberId, h);
    setToast(
      h.via === "out" || h.via === "libOut"
        ? "🌳 Kamu di taman, di luar gedung"
        : h.via === "libIn"
          ? "📚 Selamat datang di Perpustakaan"
          : `🏢 Kembali ke dalam · ${fair.stopOf(h.floorId).name}`,
    );
    return true;
  }

  /** Standing at a door: go through it now. */
  function stepThrough(floorId: string) {
    route.current = null;
    goal.current = null;
    travel(floorId);
  }

  /** Walk out to the park, from anywhere in the building. */
  const goToPark = () => goTo(fair.parkId, PARK.arrive.x, PARK.arrive.y + 0.8);

  /** Walk to the park's phone box and pick a friend to call. */
  const goToPhone = () => goTo(fair.parkId, PHONE_FRONT.x, PHONE_FRONT.y, () => setPhone(true));

  /** In the park: walk to the event building's door and go back in. */
  const goInside = () => {
    if (reachRef.current?.kind === "parkIn") return stepThrough(fair.lobbyId);
    const door = lobbyDoorFront(fair.floor(fair.lobbyId));
    goTo(fair.lobbyId, door.x, door.y - 0.6);
  };

  /** Take the lift to a floor; a premium floor asks for a ticket first. False when not riding. */
  function rideTo(floorId: string) {
    const s = savedSession;
    if (!s || closedFloor(floorId)) return false;
    const into = fair.passFor(floorId);
    if (into && !fair.hasTicket(into.id)) {
      askTicket(into, () => pickFloor(floorId));
      return false;
    }
    fair.ride(s.visitorId, floorId);
    const st = fair.stopOf(floorId);
    setToast(`🛗 ${st.name} · ${st.label}`);
    return true;
  }

  /** Pick a floor in the lift: ride now when standing at it, otherwise walk there first. */
  function pickFloor(floorId: string) {
    setLift(false);
    const me = savedSession && fair.visitors.get(savedSession.visitorId);
    if (!me || floorId === me.floorId || closedFloor(floorId)) return;
    const into = fair.passFor(floorId);
    if (into && !fair.hasTicket(into.id)) {
      askTicket(into, () => pickFloor(floorId));
      return;
    }
    goal.current = { floorId, ...LIFT_FRONT };
    planRoute();
  }

  /** Walk where the floor was tapped. A tap on or next to a free chair means "sit there": chairs
   *  are small on a phone, so a tap that lands a little off still counts. */
  const walkTo = (x: number, y: number) => {
    const me = session && fair.visitors.get(session.visitorId);
    if (!me || busy.current) return;
    if (followRef.current) setFollow(null);
    const taken =
      me.floorId === fair.parkId
        ? new Set([...fair.occupiedSeats(), ...parkNpcSeats(parkNow()).map(([b, side]) => benchSeatId(b, side))])
        : me.floorId === fair.libraryId
          ? new Set([...fair.occupiedSeats(), ...libraryNpcSeats().map(([t, k]) => librarySeatId(me.floorId, t, k))])
          : fair.occupiedSeats();
    const seat = fair
      .floor(me.floorId)
      .seats.filter((st) => !taken.has(st.id) || st.id === me.seatId)
      .map((st) => ({ st, d: Math.hypot(st.x - x, st.y - y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (seat && seat.d < 0.9) {
      if (seat.st.id === me.seatId) {
        seatedAction();
        return;
      }
      goal.current = { floorId: me.floorId, x: seat.st.x, y: seat.st.y, seatId: seat.st.id };
    } else goal.current = { floorId: me.floorId, x, y };
    planRoute();
  };

  /** Seated in a room: open its activity again (the seminar, the test). */
  function seatedAction() {
    const me = savedSession && fair.visitors.get(savedSession.visitorId);
    if (!me?.seatId) return;
    const r = fair.roomOf(me.floorId);
    const vip = vipSeatBooth(me.seatId);
    if (r) startActivity(r);
    else if (me.floorId === fair.libraryId) setLibrary(true);
    else if (vip && fair.booth(vip)) talkToRecruiter(fair.booth(vip)!, spgName(vip));
    else setGames(true);
  }

  /** Walk to a booth's desk, on whatever floor, and talk to the recruiter there. Called from menus
   *  that are still closing, so no busy check. */
  const goToBooth = (b: CompanyBooth) => {
    // A mini (UMKM) booth has no stand to walk to: its vacancies open straight away.
    if (!hasStand(b)) return setBoard({ boothId: b.id });
    const me = session && fair.visitors.get(session.visitorId);
    if (!me || closedFloor(fair.floorIdOf(b))) return;
    // A stand on a paid floor (the organiser may have moved it there) asks for that floor's ticket first.
    const into = fair.passFor(fair.floorIdOf(b));
    if (into && me.floorId !== fair.floorIdOf(b) && !fair.hasTicket(into.id)) return askTicket(into, () => goToBooth(b));
    goal.current = { floorId: fair.floorIdOf(b), ...boothSpot(b, "talk"), then: () => talkToRecruiter(b) };
    planRoute();
  };

  /** Go to a room's floor by lift, from anywhere. */
  function goToRoom(r: FairRoom) {
    const st = fair.stops.find((x) => x.roomId === r.id);
    if (st) pickFloor(st.floorId);
  }

  /** Walk to a spot, from anywhere, and do `then` on arrival. */
  function goTo(floorId: string, x: number, y: number, then?: () => void) {
    if (!savedSession || !fair.visitors.get(savedSession.visitorId) || closedFloor(floorId)) return;
    goal.current = { floorId, x, y, then };
    planRoute();
  }

  /** The one check for every way to another floor (lift, booth list, follow, ping, resume...): a floor
   *  the organiser closed for now says "segera hadir" and nobody goes. True when closed. */
  function closedFloor(floorId: string) {
    const me = savedSession && fair.visitors.get(savedSession.visitorId);
    if (!fair.floorClosed(floorId) || me?.floorId === floorId) return false;
    const st = fair.stopOf(floorId);
    setToast(`🚧 ${st.name} · ${st.label} segera hadir`);
    return true;
  }

  /** Walk to the lift and open its panel there. */
  const goToLift = () => {
    if (reachRef.current?.kind === "lift") setLift(true);
    else goTo(floor.id, LIFT_FRONT.x, LIFT_FRONT.y, () => setLift(true));
  };

  const goToCoinStand = () => {
    const c = fair.fair.coinStand;
    goTo(fairFloorId(fair.fair, c.floor), c.x + COIN_STAND_SPOTS.front.x, c.y + COIN_STAND_SPOTS.front.y, () => setWallet(true));
  };

  /** Walk to the info desk on this floor. */
  const goToInfo = () => {
    goTo(floor.id, desk.x + desk.width / 2, desk.y + desk.height + 0.6, talkToInfo);
  };

  const goToStall = (i: number) => {
    const st = room?.stalls?.[i];
    if (!st) return;
    const at = stallSpot(stallSlot(st, i), "order");
    goTo(floor.id, at.x, at.y, () => openStall(st.id));
  };

  /** Walk up to a promoter and hear their pitch. */
  function goToPromoter(p: Promoter) {
    const st = fair.stops.find((x) => x.level === p.level);
    if (!st) return;
    if (p.walks) {
      // A walking promoter: close by, the card opens at once; else walk up to where it is now.
      const npc = fair.staff.find((x) => x.id === promoterId(p.id));
      const v = savedSession && fair.visitors.get(savedSession.visitorId);
      if (!npc || !v) return;
      const open = () => {
        fair.ad(`promo:${p.id}`, "view");
        setPromo(p);
      };
      if (v.floorId === npc.floorId && Math.hypot(v.x - npc.x, v.y - npc.y) < 3) open();
      else goTo(npc.floorId, npc.x, npc.y + 1, open);
      return;
    }
    goTo(st.floorId, p.x, p.y + 1.1, () => {
      const me = savedSession && fair.visitors.get(savedSession.visitorId);
      if (me) fair.move(me.memberId, me.x, me.y, "back");
      fair.ad(`promo:${p.id}`, "view");
      setPromo(p);
    });
  }

  function claimDaily() {
    const n = fair.claimDaily();
    if (n) setToast(`🎁 +${n} koin harian${(me.streak ?? 0) > 1 ? ` · 🔥 ${me.streak} hari beruntun` : ""}`);
  }

  function openStall(id: string) {
    setStall(id);
    fair.ad(`stall:${id}`, "view");
  }

  function sitDown(seatId: string) {
    if (!savedSession) return;
    if (!fair.sit(savedSession.visitorId, seatId)) return;
    const r = fair.roomOf(fair.visitors.get(savedSession.visitorId)!.floorId);
    const vip = vipSeatBooth(seatId);
    if (r) startActivity(r);
    else if (vip && fair.booth(vip)) {
      // The SPG walks over and sits down next to the player, then talks.
      const b = fair.booth(vip)!;
      fair.track("sofa");
      fair.say(spgId(b.id), "Selamat datang di lounge VIP! 😊", 2400);
      window.setTimeout(() => {
        const me = savedSession && fair.visitors.get(savedSession.visitorId);
        if (me?.seatId === seatId) talkToRecruiter(b, spgName(b.id));
      }, 1800);
    } else {
      fair.track("sofa");
      setGames(true);
    }
  }

  /** What you do once seated: take the test, watch the seminar, or eat. */
  function startActivity(r: FairRoom) {
    if (r.kind === "psikotes") setPsych(true);
    else if (r.kind === "seminar") setSeminar(true);
    else if (r.kind === "aula") stageLive?.venue === "aula" ? setSeminar(true) : setAula("jadwal");
    else if (r.kind === "konsultasi") setLounge({ mode: "peer" });
    else {
      // The food court: sit down, eat, and play a mini game while at it.
      if (savedSession) fair.say(savedSession.visitorId, me.meals ? "Voucher aman, sambil makan main game ah 😋" : "Istirahat sambil main game ah 🎮", 2200);
      setGames(true);
    }
  }

  /** A paid floor (a room, or a booth floor the organiser put a price on) asks for a ticket first. */
  function askTicket(r: FloorPass, then: () => void) {
    const { price, voucher } = fair.roomPrice(r.id);
    const enough = me.coins >= price;
    setTalk({
      speaker: `${r.staff} · ${r.name}`,
      pages: [`${r.tagline}. Tiket masuk ${r.price} koin${voucher ? `, pakai voucher "${voucher.title}" jadi ${price} koin` : ""}. Saldo kamu ${me.coins} koin.`],
      choices: [
        enough
          ? {
              label: price ? `Bayar ${price} 🪙 dan masuk` : "Pakai voucher dan masuk",
              onPick: () => {
                setTalk(null);
                if (fair.buyTicket(r.id)) {
                  setToast(`🎟️ Tiket ${r.name} dibeli`);
                  then();
                }
              },
            }
          : {
              label: "Koin kurang, isi koin",
              onPick: () => {
                setTalk(null);
                setWallet(true);
              },
            },
        { label: "Nanti saja", onPick: () => setTalk(null) },
      ],
    });
  }

  function rateCompany(b: CompanyBooth) {
    const mineReview = session ? fair.myReview(session.visitorId, b.id) : null;
    setTalk({
      speaker: `${b.recruiter} · ${b.company}`,
      pages: [mineReview ? `Kamu pernah memberi ${"★".repeat(mineReview.stars)}. Mau ubah ratingmu?` : "Bagaimana kesanmu tentang stand dan perusahaan kami?"],
      choices: [
        ...[5, 4, 3, 2, 1].map((n) => ({
          label: `${"★".repeat(n)}${"☆".repeat(5 - n)}`,
          onPick: () => {
            if (!session) return;
            fair.reviewCompany(session.visitorId, b.id, n);
            setTalk({ speaker: `${b.recruiter} · ${b.company}`, pages: [n >= 4 ? "Terima kasih banyak! 🙏" : "Terima kasih, masukanmu kami catat."] });
          },
        })),
        { label: "Batal", onPick: () => setTalk(null) },
      ],
    });
  }

  /** "Lantai 2" for a floor id. */
  const shortName = (floorId: string) => fair.stopOf(floorId).name;

  /** The booth's dialog: from the recruiter at the desk, or from the SPG keeping the player company
   *  in a VIP lounge (same questions, jobs and applying). */
  function talkToRecruiter(b: CompanyBooth, spg?: string) {
    const me = session && fair.visitors.get(session.visitorId);
    if (me && !me.seatId) fair.move(me.memberId, me.x, me.y, "back");
    const host = spg ?? b.recruiter;
    const open = openJobs(b).filter((j) => !appliedIdsNow().has(j.id)).length;
    const main = (pages: string[]): Talk => ({
      speaker: `${host} · ${b.company}`,
      pages,
      choices: [
        { label: "Tanya-tanya", onPick: () => setTalk(faq()) },
        {
          label: "Lihat lowongan",
          onPick: () => {
            setTalk(null);
            setBoard({ boothId: b.id });
          },
        },
        {
          label: "Info perusahaan",
          onPick: () => {
            setTalk(null);
            setBoard({ boothId: b.id, about: true });
          },
        },
        {
          label: open ? "Lamar kerja" : "Lamaranku",
          onPick: () => {
            setTalk(null);
            if (open) setApplying({ boothId: b.id });
            else setPanel("applications");
          },
        },
        { label: "⭐ Beri rating", onPick: () => rateCompany(b) },
        { label: "Tutup", onPick: () => setTalk(null) },
      ],
    });
    const faq = (): Talk => ({
      speaker: `${host} · ${b.company}`,
      pages: ["Silakan, mau tanya apa?"],
      choices: [
        ...b.faq.map((f) => ({ label: f.q, onPick: () => setTalk(main([f.a, "Ada lagi yang mau ditanyakan?"])) })),
        { label: "Kembali", onPick: () => setTalk(main(["Ada yang bisa aku bantu lagi?"])) },
      ],
    });
    const rating = fair.companyRating(b.id);
    const lv = levelOf(fair.companyXp(b.id)).level;
    setTalk(
      main([
        spg
          ? `Halo, ${session?.name ?? ""}! Aku ${spg}, temani kamu di lounge VIP ${b.company}. Santai dulu ya, ini minumannya ☕`
          : `Halo, ${session?.name ?? ""}! Aku ${b.recruiter} dari ${b.company}.`,
        `${b.about} Saat ini kami buka ${openJobs(b).length} posisi.`,
        `Pelamar memberi kami ★${rating.average.toFixed(1)} dari ${rating.count} ulasan (Lv ${lv} · ${COMPANY_TITLES[lv - 1]}).`,
      ]),
    );
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
    const staff = desk.staff;
    const floorChoice = (i: number): Talk => ({
      speaker: `${staff} · Panitia`,
      pages: [`${fair.fair.floors[i]!.name} isinya ${fair.fair.floors[i]!.theme}. Mau ke stand mana?`],
      choices: [
        ...fair.fair.booths
          .filter((b) => b.floor === i && hasStand(b))
          .map((b) => ({
            label: `${b.tier === "premium" ? "👑 " : ""}${b.company}`,
            hint: `${openJobs(b).length} lowongan`,
            onPick: () => {
              setTalk(null);
              goToBooth(b);
              setToast(i === hall ? `Menuju stand ${b.company}` : `Menuju stand ${b.company} di ${fair.fair.floors[i]!.name}`);
            },
          })),
        { label: "← Kembali", onPick: () => setTalk(main) },
      ],
    });
    // Mini (UMKM) booths have no stand: the desk lists them and opens their vacancies.
    const umkm = fair.fair.booths.filter((b) => !hasStand(b));
    const umkmChoice: Talk = {
      speaker: `${staff} · Panitia`,
      pages: [`${UMKM_CORNER}: usaha kecil dan menengah yang ikut job fair. Lowongannya bisa langsung dilihat dari sini.`],
      choices: [
        ...umkm.map((b) => {
          const top = openJobs(b)[0];
          return {
            label: b.company,
            hint: [b.industry, top ? `${top.title}${isFeatured(b, top.id) ? " · unggulan" : ""}` : "belum ada lowongan"].join(" · "),
            onPick: () => {
              setTalk(null);
              setBoard({ boothId: b.id });
            },
          };
        }),
        { label: "← Kembali", onPick: () => setTalk(main) },
      ],
    };
    const main: Talk = {
      speaker: `${staff} · Panitia`,
      pages: ["Ada yang bisa dibantu? Pilih tujuanmu, nanti aku antar."],
      choices: [
        // Every floor in lift order, the same way the lift lists them.
        ...fair.stops.map((st) => {
          const price = fair.floorPrice(st.floorId);
          const r = st.roomId ? fair.room(st.roomId) : undefined;
          const i = fairFloorIndex(st.floorId);
          const count = r ? "" : `${fair.fair.booths.filter((b) => b.floor === i && hasStand(b)).length} stand`;
          return {
            label: `${st.emoji} ${st.label}`,
            hint: fair.floorClosed(st.floorId) ? `Lt ${st.level + 1} · Segera hadir` : [`Lt ${st.level + 1}`, count, price ? `${price} koin` : ""].filter(Boolean).join(" · "),
            onPick: () => {
              if (closedFloor(st.floorId)) return setTalk(null);
              if (!r) return setTalk(floorChoice(i));
              setTalk(null);
              goToRoom(r);
              setToast(`Menuju ${r.name}`);
            },
          };
        }),
        ...(umkm.length ? [{ label: `🏪 ${UMKM_CORNER}`, hint: `${umkm.length} usaha kecil · lowongan tanpa stand`, onPick: () => setTalk(umkmChoice) }] : []),
        {
          label: "🌳 Taman di luar gedung",
          hint: `Lewat pintu taman di ${fair.stopOf(fair.lobbyId).name}`,
          onPick: () => {
            setTalk(null);
            goToPark();
            setToast("Menuju taman");
          },
        },
        {
          label: "🪙 Beli koin di sini",
          hint: "tanpa ke Stand Koin",
          onPick: () => {
            setTalk(null);
            setWallet("desk");
          },
        },
        { label: "Tutup", onPick: () => setTalk(null) },
      ],
    };
    setTalk(main);
  }

  /** Who is pointed out on the floor right now. */
  function markedNow() {
    const now = Date.now();
    for (const [id, until] of marks.current) if (until < now) marks.current.delete(id);
    return new Set(marks.current.keys());
  }

  /** "Lantai 2 · Seminar": a floor's name for quick messages. */
  function floorLabel(floorId: string) {
    const st = fair.stopOf(floorId);
    return `${st.name} · ${st.label}`;
  }

  const plainName = (v: { displayName: string }) => v.displayName.replace(/^🌐 /, "");

  /** Point someone out on the floor for a while. */
  function mark(memberId: string, ms = 20_000) {
    marks.current.set(memberId, Date.now() + ms);
  }

  /** Send a quick message to one job seeker. People on other devices get it on their screen; the
   *  fair's own visitors answer after a moment, so the feature can be tried alone. */
  function sendPing(memberId: string, ping: Ping) {
    const v = fair.visitors.get(memberId);
    if (!v || !session) return;
    const text = PING_TEXT[ping.key](ping.floorId ? floorLabel(ping.floorId) : "");
    if (v.remote) {
      if (!liveChannel.current?.sendTo(memberId.slice(4), ping)) {
        setToast(`${plainName(v)} sedang tidak terhubung`);
        return;
      }
    } else if (v.isBot) {
      const answer: Ping = { key: ping.key === "hi" || ping.key === "team" ? "hiback" : ping.key === "floor" || ping.key === "here" ? "coming" : "ok" };
      window.setTimeout(() => {
        if (!fair.visitors.has(memberId)) return;
        fair.say(memberId, PING_TEXT[answer.key](""), 2600);
        showPing(memberId, answer);
      }, 1400);
    }
    // Everyone nearby sees who it was for, as a bubble over the player.
    fair.say(session.visitorId, `${text.split(" ")[0]} @${plainName(v)}`, 2600);
    fair.track("greet");
    mark(memberId, 8_000);
    setToast(`Terkirim ke ${plainName(v)}`);
  }

  /** A quick message arrived over the live channel. */
  function receivePing(memberId: string, data: unknown) {
    const ping = parsePing(data);
    if (!ping || muted.current.has(memberId) || !fair.visitors.has(memberId)) return;
    if (ping.floorId && !fair.floors.some((f) => f.id === ping.floorId)) return;
    if (!pingLimit.current.allow(memberId)) return;
    if (ping.key === "friendok") {
      const v = fair.visitors.get(memberId)!;
      // The demo keeps friends in this browser; the live site has it on the server already.
      if (LIVE) void loadFriends();
      else if (v.tag) void addFriend(v.tag, plainName(v));
    }
    if (ping.key === "friend" && LIVE) void loadFriends();
    showPing(memberId, ping);
  }

  function showPing(memberId: string, ping: Ping) {
    const v = fair.visitors.get(memberId);
    if (!v) return;
    const name = plainName(v);
    const id = ++pingSeq;
    const close = () => setPings((list) => list.filter((p) => p.id !== id));
    const answer = (key: Ping["key"]) => () => {
      close();
      sendPing(memberId, { key });
    };
    const later = { label: "🙏 Nanti", onPick: answer("later") };
    const actions =
      ping.key === "friend" && v.tag
        ? [
            { label: "⭐ Terima", primary: true, onPick: () => (close(), befriend(memberId)) },
            { label: "🙏 Nanti", onPick: close },
          ]
        : ping.key === "friendok"
          ? [{ label: "👥 Lihat teman", primary: true, onPick: () => (close(), setFriendsOpen(true)) }]
          : ping.key === "follow"
            ? [{ label: "👣 Ikuti", primary: true, onPick: () => (close(), startFollow(memberId, true)) }, later]
            : ping.key === "floor" && ping.floorId
              ? [
                  { label: `🛗 Ke ${fair.stopOf(ping.floorId).name}`, primary: true, onPick: () => (close(), sendPing(memberId, { key: "coming" }), pickFloor(ping.floorId!)) },
                  later,
                ]
              : ping.key === "here" || ping.key === "where" || ping.key === "wait"
                ? [
                    ...(ping.key === "where" ? [{ label: "📍 Kirim lokasiku", primary: true, onPick: () => (close(), sendHere(memberId)) }] : []),
                    ...(ping.key !== "where"
                      ? [{ label: "🏃 Datangi", primary: true, onPick: () => (close(), sendPing(memberId, { key: "coming" }), walkToPerson(memberId)) }]
                      : []),
                    later,
                  ]
                : ["ok", "later", "following", "coming", "thanks", "hiback"].includes(ping.key)
                  ? [{ label: "📍 Lihat", onPick: () => (close(), mark(memberId)) }]
                  : PING_REPLIES.map((k) => ({ label: PING_TEXT[k](""), primary: k === "ok", onPick: answer(k) }));
    actions.push({ label: "🔕", onPick: () => (close(), muted.current.add(memberId), setToast(`${name} dibisukan sampai kamu keluar`)) });
    setPings((list) => [
      ...list.slice(-2),
      { id, name, look: lookOfMember(memberId), text: PING_TEXT[ping.key](ping.floorId ? floorLabel(ping.floorId) : ""), where: floorLabel(v.floorId), actions },
    ]);
    window.setTimeout(close, 30_000);
    mark(memberId);
    playPing();
  }

  /** Save a job seeker met here as a friend: a request they see at once, or a yes to theirs. */
  function befriend(memberId: string) {
    const v = fair.visitors.get(memberId);
    if (!v?.tag) return;
    const name = plainName(v);
    void addFriend(v.tag, name).then((state) => {
      if (!state) return setToast("Belum bisa menyimpan teman, coba lagi sebentar");
      sendPing(memberId, { key: state === "friend" ? "friendok" : "friend" });
      setToast(state === "friend" ? `⭐ ${name} sekarang temanmu` : `⭐ Permintaan teman terkirim ke ${name}`);
    });
  }

  /** Friends at the fair right now, by their tag. */
  function friendsOnline() {
    const out = new Map<string, FriendOnline>();
    for (const v of fair.visitors.values()) {
      if (v.remote && v.tag && friendOf(v.tag)) out.set(v.tag, { memberId: v.memberId, where: floorLabel(v.floorId) });
    }
    return out;
  }

  function lookOfMember(memberId: string) {
    const v = fair.visitors.get(memberId);
    return remoteLooks.current.get(memberId) ?? (v ? lookFor(`${v.displayName}:${v.memberId}`) : undefined);
  }

  function sendHere(memberId: string) {
    const me = session && fair.visitors.get(session.visitorId);
    if (me) sendPing(memberId, { key: "here", floorId: me.floorId });
  }

  /** Walk up to someone, on whatever floor they are. */
  function walkToPerson(memberId: string) {
    const t = fair.visitors.get(memberId);
    if (!t || closedFloor(t.floorId)) return;
    const into = fair.passFor(t.floorId);
    const me = session && fair.visitors.get(session.visitorId);
    if (into && me?.floorId !== t.floorId && !fair.hasTicket(into.id)) {
      askTicket(into, () => walkToPerson(memberId));
      return;
    }
    goTo(t.floorId, t.x, t.y + 0.9);
    mark(memberId, 15_000);
  }

  /** Walk after someone until they leave or the player moves on their own. */
  function startFollow(memberId: string, tell: boolean) {
    const v = fair.visitors.get(memberId);
    if (!v) return;
    setFollow({ memberId, name: plainName(v) });
    if (tell) sendPing(memberId, { key: "following" });
    else setToast(`👣 Mengikuti ${plainName(v)}`);
  }

  function talkToVisitor(memberId: string) {
    const v = fair.visitors.get(memberId);
    if (!v || !session) return;
    const sent = fair.applications.filter((a) => a.visitorId === memberId);
    const name = plainName(v);
    const close = () => setTalk(null);
    const ping = (p: Ping) => () => (close(), sendPing(memberId, p));
    const floors = () =>
      setTalk({
        speaker: v.displayName,
        pages: [`Ajak ${name} ke lantai mana?`],
        choices: [
          ...fair.openStops().map((st) => ({ label: `🛗 ${st.name}`, hint: st.label, onPick: ping({ key: "floor", floorId: st.floorId }) })),
          { label: "Kembali", onPick: () => talkToVisitor(memberId) },
        ],
      });
    const following = follow?.memberId === memberId;
    setTalk({
      speaker: v.displayName,
      pages: [
        v.remote
          ? `${name} sedang online dari device lain. Pesan cepatmu muncul di layarnya, lengkap dengan wajahmu.`
          : sent.length
            ? `Hai! Aku barusan melamar ${sent[0]!.jobTitle} di ${sent[0]!.company}. Semoga lolos!`
            : `Hai! Aku ${name}, lagi keliling cari lowongan yang cocok.`,
      ],
      choices: [
        ...PING_STARTERS.filter((k) => k !== "here").map((k) => ({ label: PING_TEXT[k](""), onPick: ping({ key: k }) })),
        { label: "📍 Kirim lokasiku", hint: floorLabel(fair.visitors.get(session.visitorId)?.floorId ?? v.floorId), onPick: () => (close(), sendHere(memberId)) },
        { label: "🛗 Ajak ke lantai…", onPick: floors },
        ...(v.remote && v.tag
          ? [
              (() => {
                const f = friendOf(v.tag);
                return f?.state === "friend"
                  ? { label: "✅ Sudah berteman", hint: "Lihat daftar teman", onPick: () => (close(), setFriendsOpen(true)) }
                  : f?.state === "sent"
                    ? { label: "⏳ Menunggu jawaban teman", onPick: close }
                    : { label: f?.state === "received" ? "⭐ Terima pertemanan" : "⭐ Simpan jadi teman", onPick: () => (close(), befriend(memberId)) };
              })(),
            ]
          : []),
        following
          ? { label: "✋ Berhenti mengikuti", onPick: () => (close(), setFollow(null)) }
          : { label: `👣 Ikuti ${name}`, onPick: () => (close(), startFollow(memberId, !!v.remote)) },
        ...EMOTES.slice(1, 2).map((e) => ({
          label: `${EMOTE_ICON[e]} Semangat`,
          onPick: () => {
            fair.say(session.visitorId, "Semangat ya! 💪", 1800);
            fair.track("greet");
            close();
          },
        })),
        ...(fair.roomOf(v.floorId)?.kind === "konsultasi" && !v.remote
          ? [{ label: "📞 Telepon", onPick: () => (close(), setLounge({ mode: "peer", memberId: v.memberId })) }]
          : []),
        { label: "Tutup", onPick: close },
      ],
    });
  }

  /** People the job seeker can call from the lounge: the others on this floor. */
  function loungePeers() {
    // Live: real people on other devices; the demo calls the bots on this floor.
    return [...fair.visitors.values()]
      .filter((x) => x.floorId === floor.id && x.memberId !== session?.visitorId && (LIVE ? x.remote && canCallOtherTabs() : !x.remote))
      .map((x) => ({ memberId: x.memberId, name: x.displayName.replace(/^🌐 /, "") }));
  }

  /** Walk to the librarian's desk in the Perpustakaan in the park, from anywhere, and pick a book. */
  function goToLibrary() {
    const spot = librarySpot("front");
    goTo(fair.libraryId, spot.x, spot.y, () => setLibrary(true));
  }

  /** In the park: walk to the Perpustakaan's door and go in. */
  function goToLibraryDoor() {
    if (reachRef.current?.kind === "libraryIn") return stepThrough(fair.libraryId);
    goTo(fair.parkId, LIBRARY_FRONT.x, LIBRARY_FRONT.y, () => stepThrough(fair.libraryId));
  }

  /** Walk to a lounge consultant's desk and open it. */
  function goToConsultant(i: number) {
    const c = room?.consultants?.[i];
    if (!c) return;
    const at = loungeSpot(consultantDesk(c, i), "front");
    goTo(floor.id, at.x, at.y, () => setLounge({ mode: "consult", index: i }));
  }

  /** Pay for a lounge call, then ring the consultant or the other job seeker. */
  function startLoungeCall(c: LoungeCallStart) {
    const who = c.consultant?.name ?? c.peer?.name ?? "";
    const plans = loungePlans();
    const plan = plans.find((p) => p.minutes === c.minutes) ?? plans[0]!;
    // A real consultant: ring first, and the coins go only once they pick up.
    if (c.consultant?.live) {
      setLounge(null);
      if (!c.consultant.open) return setToast("Konsultan sedang tidak di meja");
      if (!canCallOtherTabs()) return setToast("Browser ini belum bisa melakukan panggilan");
      if (me.coins < plan.consultCoins) return setWallet(true);
      const k = c.consultant;
      setLoungeCall({
        ...c,
        name: k.name,
        sub: `${k.role}${k.org ? ` · ${k.org}` : ""}`,
        color: k.color,
        look: staffLook(k.name, k.color),
        lines: [],
        payOnAnswer: true,
        ring: {
          type: "ring",
          callId: newCallId(),
          to: consultAddress(k.id),
          appId: "",
          company: session?.name ?? "Pencari kerja",
          recruiter: session?.name ?? "Pencari kerja",
          logo: "",
          color: "#0f766e",
          jobTitle: "Lounge Konsultasi",
          kind: c.kind,
          from: "seeker",
          minutes: c.minutes,
        },
      });
      return;
    }
    setCoinAsk({
      price: c.consultant ? plan.consultCoins : plan.coins,
      what: `${c.kind === "video" ? "video call" : "telepon"} ${c.minutes} menit dengan ${who}`,
      run: () => placeLoungeCall(c, who),
    });
  }

  function placeLoungeCall(c: LoungeCallStart, who: string) {
    if (!fair.startLoungeCall(c.consultant ? "consult" : "peer", c.minutes, who)) {
      setLounge(null);
      setWallet(true);
      return;
    }
    setLounge(null);
    if (c.consultant)
      setLoungeCall({
        ...c,
        name: c.consultant.name,
        sub: `${c.consultant.role}${c.consultant.org ? ` · ${c.consultant.org}` : ""}`,
        color: c.consultant.color,
        look: staffLook(c.consultant.name, c.consultant.color),
        lines: c.consultant.lines,
      });
    else if (c.peer) {
      const live = c.peer.memberId.startsWith("net:");
      setLoungeCall({
        ...c,
        name: c.peer.name,
        sub: `Pencari kerja · ${c.via ?? "Lounge Konsultasi"}`,
        color: "#0f766e",
        look: live ? remoteLooks.current.get(c.peer.memberId) : lookFor(`${c.peer.name}:${c.peer.memberId}`),
        lines: PEER_LINES,
        ring: live
          ? {
              type: "ring",
              callId: newCallId(),
              to: `peer:${c.peer.memberId.slice(4)}`,
              appId: "",
              company: session?.name ?? "Pencari kerja",
              recruiter: session?.name ?? "Pencari kerja",
              logo: "",
              color: "#0f766e",
              jobTitle: c.via ?? "Lounge Konsultasi",
              kind: c.kind,
              from: "seeker",
              minutes: c.minutes,
            }
          : undefined,
      });
    }
  }

  function appliedIdsNow() {
    const s = savedSession;
    return new Set(s ? fair.applications.filter((a) => a.visitorId === s.visitorId).map((a) => a.jobId) : []);
  }

  const submit = (boothId: string, input: ApplicationInput) => {
    if (!session) return;
    if (!fair.canAffordApply()) {
      setApplying(null);
      setToast(`Koin kurang: melamar butuh ${price("coin.apply")} koin`);
      setWallet(true);
      return;
    }
    const free = fair.player.vouchers.some((x) => !x.used && x.kind === "free-apply");
    const send = () => void sendApplication(boothId, input);
    if (free) return send();
    const b = fair.booth(boothId);
    const job = b?.jobs.find((j) => j.id === input.jobId);
    setCoinAsk({ price: price("coin.apply"), what: `melamar ${job?.title ?? "lowongan ini"}${b ? ` di ${b.company}` : ""}`, run: send });
  };

  const sendApplication = async (boothId: string, input: ApplicationInput) => {
    if (!session) return;
    let id: string | undefined;
    if (LIVE) {
      // The server keeps the application, so the company sees it; coins are only spent once it is in.
      const b = fair.booth(boothId);
      const job = b?.jobs.find((j) => j.id === input.jobId);
      if (!b || !job) return;
      const photo = safeImage(profile.photo);
      const res = await sendToServer({
        boothId,
        jobId: job.id,
        company: b.company,
        jobTitle: job.title,
        name: input.name.trim() || session.name,
        email: input.email.trim(),
        phone: input.phone.trim() || undefined,
        cvUrl: input.cvUrl.trim() || undefined,
        message: input.message.trim() || undefined,
        headline: profile.headline?.trim() || undefined,
        education: profile.education?.trim() || undefined,
        skills: profile.skills?.trim() || undefined,
        city: profile.city?.trim() || undefined,
        photo: photo && photo.length <= 100_000 ? photo : undefined,
        psych: fair.bestPsych() ?? undefined,
      });
      if (!res.ok) {
        setToast(applyErrorText(res.error));
        if (res.error === "already_applied") setApplying(null);
        return;
      }
      id = res.data.application.id;
    }
    const a = fair.apply(session.visitorId, {
      id,
      boothId,
      ...input,
      headline: profile.headline,
      education: profile.education,
      skills: profile.skills,
      city: profile.city,
      photo: profile.photo,
    });
    // Applying turns on "Boleh dihubungi perusahaan untuk lowongan lain" unless they already chose.
    updateProfile({ ...profile, name: input.name || profile.name, email: input.email, phone: input.phone, cvUrl: input.cvUrl, contactable: profile.contactable ?? true });
    setApplying(null);
    if (a) setToast(`Lamaran ${a.jobTitle} terkirim ke ${a.company}${fair.player.txns[0]?.reason.startsWith("Lamar") ? ` (−${price("coin.apply")} 🪙)` : " (voucher)"}`);
  };

  /** Sign out: leave the fair and go back to the login screen. */
  const signOut = () => {
    if (session) fair.leave(session.visitorId);
    setInside(account?.email ?? "guest", false);
    savedSession = null;
    setSession(null);
    setTalk(null);
    setPanel(null);
    logout();
    setAccount(null);
    setProfile(loadProfile());
  };

  const leave = () => {
    if (!session) return;
    setInside(account?.email ?? "guest", false);
    fair.leave(session.visitorId);
    setSession(null);
    setTalk(null);
    setPanel(null);
  };

  /** The seminar running now (sessions rotate every three minutes), for the stage's LED wall: the
   *  slides advance every few seconds so the wall feels like a talk in progress. */
  function currentSlide(): StageScreen {
    const list = fair.seminars();
    if (stageLive && stageLive.venue !== "aula") {
      const sem = list.find((x) => x.id === stageLive.sessionId);
      const sl = sem?.slides[stageLive.slide];
      return {
        badge: "LIVE",
        live: true,
        title: stageLive.title,
        speaker: stageLive.speaker,
        role: stageLive.role,
        slideTitle: sl?.title ?? (stageLive.screen ? "Berbagi layar" : stageLive.title),
        points: sl?.points,
        page: sem ? `${stageLive.slide + 1}/${sem.slides.length}` : undefined,
        stream: feed.stream,
      };
    }
    const now = Date.now();
    const s = liveSeminar(now, list);
    const i = Math.floor(now / 9000) % Math.max(1, s.slides.length);
    const sl = s.slides[i];
    const next = list[(list.indexOf(s) + 1) % list.length];
    return {
      badge: "Sedang berlangsung",
      title: s.title,
      speaker: s.speaker,
      role: s.role,
      slideTitle: sl?.title,
      points: sl?.points,
      page: sl ? `${i + 1}/${s.slides.length}` : undefined,
      next: next && next !== s ? `${next.title} · ${next.speaker}` : undefined,
    };
  }

  /** What the Aula's LED wall and boards show, by the clock. */
  function aulaScreen() {
    const { current, next, over } = fair.aulaNow();
    return {
      now: current,
      next,
      over,
      live: stageLive?.venue === "aula" ? { title: stageLive.title, speaker: stageLive.speaker, stream: feed.stream } : null,
      rundown: fair.rundown().map((e) => ({ start: e.start, title: e.title, on: e.id === current?.id })),
      announcement: announcement?.text,
    };
  }

  /** Walk to the anomaly on this floor and catch it; the server decides what it gives. */
  const catchAnomaly = () => {
    const a = anomaly;
    if (!a || a.claimed || !session || catching.current) return;
    // Stand beside it, where it strolls, so the player doesn't cover it.
    goTo(a.floorId, a.x - 0.8, a.y, async () => {
      if (catching.current) return;
      catching.current = true;
      const r = await claimAnomaly();
      catching.current = false;
      setToast(r.ok ? `${r.rare ? "🌟" : "🎉"} ${r.name} tertangkap! ${anomalyRewardText(r.reward)}. ${r.line}` : r.text);
    });
  };
  const anomalyHere = anomaly && anomaly.floorId === floor.id ? anomaly : null;
  /** A night one in the dark park glows: drawn over the night's tint. */
  const anomalyGlows = !!anomalyHere && dark > 0.5 && ANOMALY_INFO[anomalyHere.kind].phase === "night";
  const anomalyScene = anomalyHere ? anomalyExtras({ ...anomalyHere, claimed: anomalyHere.claimed?.coins }, session ? catchAnomaly : undefined) : [];

  // --- Scene.
  const extras = [
    ...(anomalyGlows ? [] : anomalyScene),
    ...(room ? [] : fair.freeSlots().filter((sl) => sl.floor === hall)).flatMap((sl) => emptyBoothExtras(sl, () => setBooking(sl))),
    ...booths.flatMap((b) =>
      boothExtras(b, {
        onBanner: () => setBoard({ boothId: b.id }),
        onDesk: session ? () => goToBooth(b) : undefined,
        onAccessory: session ? (acc) => (acc === "neon" ? setBoard({ boothId: b.id }) : setMedia({ boothId: b.id, acc })) : undefined,
        rating: { ...fair.companyRating(b.id), level: levelOf(fair.companyXp(b.id)).level },
      }),
    ),
    ...(libRoom
      ? [...libraryRoomExtras({ books: session ? goToLibrary : undefined }), ...libraryNpcExtras(libPeople)]
      : park
        ? parkExtras({
            eventName: fair.fair.name,
            plots: parkPlots(fair.shownParkBuildings()),
            onEnter: session ? goInside : undefined,
            onPlot: session ? (i) => goTo(fair.parkId, plotFront(i).x, plotFront(i).y) : undefined,
            onPhone: session ? goToPhone : undefined,
            onLibrary: session ? goToLibraryDoor : undefined,
            dark,
            npcs: parkPeople,
            scared: self ? scaredFlocks(self.x, self.y) : undefined,
          })
        : [
            ...infoDeskExtras(desk, session ? goToInfo : undefined),
            ...liftExtras(stop.name, fair.stops, session ? goToLift : undefined),
            ...liftSignExtras(room ? ROOM_SIGNS : firstHall ? GROUND_SIGNS : HALL_SIGNS, session ? goToLift : undefined),
          ]),
    ...(lobby ? parkDoorExtras(floor, session ? goToPark : undefined) : []),
    ...sponsors.map((sp) => sponsorExtras(sp, () => openSponsor(sp))),
    ...(coinHere ? coinStandExtras(fair.fair.coinStand, session ? goToCoinStand : undefined) : []),
    ...(room?.kind === "foodcourt"
      ? [...foodStallExtras(room, session ? (id) => goToStall(room.stalls!.findIndex((x) => x.id === id)) : undefined), ...emptyStallExtras(room, session ? setRenting : undefined)]
      : []),
    ...(room?.kind === "psikotes" ? psikotesExtras(room) : []),
    ...promotersHere.flatMap((p) => promoterExtras(p, session ? () => goToPromoter(p) : undefined)),
    ...(room?.kind === "seminar" ? seminarStageExtras(room, currentSlide()) : []),
    ...(room?.kind === "konsultasi"
      ? loungeExtras(room, {
          consult: session ? (i) => goToConsultant(i) : undefined,
          board: session ? () => goTo(floor.id, loungeBoardSpot().x, loungeBoardSpot().y, () => setLounge({ mode: "info" })) : undefined,
        })
      : []),
    ...(room?.kind === "aula"
      ? aulaExtras(room, aulaScreen(), fair.stops, {
          rundown: session ? () => goTo(floor.id, aulaSpot("rundown").x, aulaSpot("rundown").y, () => setAula("jadwal")) : undefined,
          info: session ? () => goTo(floor.id, aulaSpot("info").x, aulaSpot("info").y, () => setAula("info")) : undefined,
          meet: session ? () => setAula("meet") : undefined,
        })
      : []),
  ];
  const npcs: NpcView[] = fair.staff.map((s) => {
    const b = s.boothId ? fair.booth(s.boothId) : undefined;
    const pr = fair.fair.promoters.find((x) => promoterId(x.id) === s.id);
    // The speaker on the seminar stage is whoever the LED wall says is presenting.
    const name =
      room?.kind === "seminar" && s.id === roomStaffId(room.id)
        ? currentSlide().speaker
        : room?.kind === "aula" && s.id === roomStaffId(room.id) && stageLive?.venue === "aula"
          ? stageLive.speaker
          : s.name;
    if (s.id.startsWith("spg:"))
      return { id: s.id, name: `✨ ${s.name}`, floorId: s.floorId, x: s.x, y: s.y, facing: s.facing, seated: s.seated, look: spgLook(s.name, b?.color ?? "#be185d") };
    return { id: s.id, name, floorId: s.floorId, x: s.x, y: s.y, facing: s.facing, look: staffLook(pr?.name ?? name, pr?.color ?? b?.color ?? "#1e3a8a") };
  });
  // The park's people: drawn like staff, never counted as visitors.
  for (const n of parkPeople)
    npcs.push({
      id: n.id,
      name: n.name,
      floorId: floor.id,
      x: n.x,
      y: n.y,
      facing: n.facing,
      seated: n.seated,
      small: n.small,
      moving: n.moving,
      look: parkNpcLook(n, dark > 0.5),
    });
  // The reading room's people, the same way.
  for (const n of libPeople)
    npcs.push({ id: n.id, name: n.name, floorId: floor.id, x: n.x, y: n.y, facing: n.facing, seated: n.seated, small: n.small, moving: n.moving, look: libraryNpcLook(n) });
  // Only who is on the floor in view: people elsewhere cost nothing to draw.
  const avatars: AvatarState[] = [...fair.visitors.values()].filter((v) => v.floorId === floor.id);
  const bubbles = {
    ...Object.fromEntries([...parkPeople, ...libPeople].flatMap((n) => (n.say ? [[n.id, n.say]] : []))),
    ...Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text])),
  };
  const lookOf = (a: AvatarState) =>
    session && a.memberId === session.visitorId ? session.look : (remoteLooks.current.get(a.memberId) ?? lookFor(`${a.displayName}:${a.memberId}`));

  const boardBooth = board ? fair.booth(board.boothId) : undefined;
  const mediaBooth = media ? fair.booth(media.boothId) : undefined;
  const stallView = stall ? fair.fair.rooms.flatMap((r) => r.stalls ?? []).find((x) => x.id === stall) : undefined;
  const applyBooth = applying ? fair.booth(applying.boothId) : undefined;
  const totalJobs = fair.fair.booths.reduce((n, b) => n + openJobs(b).length, 0);

  return (
    <div className="game game-fair" style={navSpace ? { ["--fair-nav" as string]: `${navSpace}px`, ["--fair-nav-right" as string]: `${navRight}px` } : undefined}>
      <CafeScene
        className="game-scene"
        hudBottom={session ? Math.max(72, navSpace) + 52 : 0}
        floor={floor}
        floorName={shortName}
        hallTitle={room ? undefined : fair.hallBanner(fairFloorIndex(floor.id)).title}
        hallSubtitle={room ? undefined : fair.hallBanner(fairFloorIndex(floor.id)).subtitle}
        hallBanner={!room}
        occupiedSeatIds={occupied}
        highlightSeatId={reach?.kind === "seat" ? reach.seatId : null}
        onSeatClick={
          session
            ? (seatId) => {
                const st = floor.seats.find((x) => x.id === seatId);
                const v = fair.visitors.get(session.visitorId);
                if (!st || !v || busy.current) return;
                goal.current = { floorId: v.floorId, x: st.x, y: st.y, seatId };
                planRoute();
              }
            : undefined
        }
        avatars={avatars}
        lookOf={lookOf}
        selfMemberId={session?.visitorId}
        npcs={npcs}
        bubbles={bubbles}
        extras={extras}
        darkness={park ? dark : 0}
        lights={park ? [...parkLights({ dark, npcs: parkPeople }), ...(anomalyGlows ? anomalyScene : [])] : undefined}
        hallSponsors={fair.fair.sponsors}
        follow={self ? { x: self.x, y: self.y } : null}
        onTileClick={session ? walkTo : undefined}
        markedMemberIds={markedNow()}
        onAvatarClick={session ? (id) => (id === session.visitorId ? seatedAction() : talkToVisitor(id)) : undefined}
        onNpcClick={
          session
            ? (id) => {
                const b = fair.fair.booths.find((x) => recruiterId(x.id) === id);
                const st = room?.stalls?.findIndex((x) => stallStaffId(x.id) === id) ?? -1;
                const pr = fair.fair.promoters.find((x) => promoterId(x.id) === id);
                const ci = room?.consultants?.findIndex((x) => consultantId(x.id) === id) ?? -1;
                if (id.startsWith("park:")) fair.say(id, parkNpcHello(id, parkNow()), 3000);
                else if (id.startsWith("lib:")) fair.say(id, libraryNpcHello(id, Date.now()), 3000);
                else if (ci >= 0) goToConsultant(ci);
                else if (id === LIBRARIAN_ID) goToLibrary();
                else if (b) goToBooth(b);
                else if (id.startsWith("spg:")) {
                  const vb = fair.booth(id.slice(4));
                  if (vb) talkToRecruiter(vb, spgName(vb.id));
                } else if (pr) goToPromoter(pr);
                else if (id === "coin-staff") goToCoinStand();
                else if (st >= 0) goToStall(st);
                else if (room && id === roomStaffId(room.id)) fair.say(id, room.tagline, 2600);
                else goToInfo();
              }
            : undefined
        }
      >
        <div className="hud hud-tl rpg-box" data-collapsed={hud.info ? undefined : ""} onPointerDown={(e) => e.stopPropagation()}>
          {hud.info ? (
            <>
              <button type="button" className="hud-title hud-toggle" onClick={hud.toggleInfo} aria-expanded title="Sembunyikan info">
                🎪 {fair.fair.name} <span className="hud-caret">▴</span>
              </button>
              <button type="button" className="hud-floor" onClick={() => session && setLift(true)} title="Pindah lantai lewat lift">
                <span>
                  📍 {stop.name} · {stop.emoji} {stop.label}
                </span>
                {session && <span className="hud-lift">🛗</span>}
              </button>
              {session && (
                <button type="button" className="hud-level" onClick={() => setPanel("profile")} title="Level dan XP">
                  <LevelBar compact level={seeker.level} title={SEEKER_TITLES[seeker.level - 1]!} progress={seeker.progress} xp={me.xp} next={seeker.to} />
                </button>
              )}
              {session && (
                <div
                  className="hud-live"
                  data-status={live.status}
                  title="Pengunjung lain yang sedang membuka job fair ini dari HP atau laptop mereka. Nama, tampilan karakter, dan posisi dibagikan lewat server publik."
                >
                  {live.status === "online"
                    ? `🟢 Online · ${live.peers ? `${live.peers} orang dari device lain` : "belum ada orang lain"}`
                    : live.status === "connecting"
                      ? "⏳ Menyambung…"
                      : live.status === "full"
                        ? "🟡 Ramai sekali, kamu masuk mode solo"
                        : live.status === "solo"
                          ? "⚪ Mode solo, pemain online sedang dimatikan"
                          : LIVE
                            ? "⚪ Offline, pemain lain belum terlihat"
                            : "⚪ Offline, hanya bot"}
                </div>
              )}
              <div className="hud-stats">
                <span>🏬 {fair.stops.length} lantai</span>
                <span>🏢 {fair.fair.booths.length} perusahaan</span>
                <span>⭐ {fair.fair.sponsors.length} sponsor</span>
                <span>💼 {totalJobs} lowongan</span>
                <span>👥 {fair.visitors.size} pengunjung</span>
              </div>
            </>
          ) : (
            // Folded: one short line with where you are and your level; the rest opens on tap.
            <div className="hud-mini">
              <button type="button" className="hud-mini-floor" onClick={() => (session ? setLift(true) : hud.toggleInfo())} title="Pindah lantai lewat lift">
                📍 {stop.name}
                {session && <span className="hud-lift">🛗</span>}
              </button>
              {session && (
                <button type="button" className="hud-mini-lv" onClick={() => setPanel("profile")} title="Level dan XP">
                  Lv {seeker.level}
                </button>
              )}
              {session && <span className="hud-mini-dot" data-status={live.status} title={live.status === "online" ? `Online · ${live.peers} orang lain` : live.status} />}
              <button type="button" className="hud-mini-more" onClick={hud.toggleInfo} aria-expanded={false} title="Tampilkan info acara">
                ▾
              </button>
            </div>
          )}
        </div>

        {session && (
          // Friends, help and the bell share one bar, the same height as the floor pill on the left.
          <div className="hud hud-tr-bar rpg-box" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="hud-ic friends-btn hud-friends" onClick={() => setFriendsOpen(true)} title="Teman" aria-label="Teman">
              👥
              {(() => {
                const asking = friends.friends.filter((f) => f.state === "received").length;
                const on = friendsOnline().size;
                return asking + on > 0 ? (
                  <span className="hud-friends-n" data-ask={asking ? "" : undefined}>
                    {asking || on}
                  </span>
                ) : null;
              })()}
            </button>
            <button type="button" className="hud-ic guide-btn" onClick={() => setGuide(true)} title="Panduan: cara memakai tiap fitur" aria-label="Panduan">
              ❓
            </button>
            <button
              type="button"
              className="hud-ic notif-btn"
              onClick={() => setNotifs(true)}
              title="Notifikasi dari HR"
              aria-label={`Notifikasi${fair.unreadFor(PLAYER_ID) ? `, ${fair.unreadFor(PLAYER_ID)} belum dibaca` : ""}`}
            >
              🔔
              {fair.unreadFor(PLAYER_ID) > 0 && <span className="menu-dot">{fair.unreadFor(PLAYER_ID)}</span>}
            </button>
          </div>
        )}
        {session && friendsOpen && (
          <FriendsPanel
            friends={friends.friends}
            online={friendsOnline()}
            onVisit={(id) => (setFriendsOpen(false), walkToPerson(id))}
            onMessage={(id) => (setFriendsOpen(false), talkToVisitor(id))}
            onAccept={(f) => {
              const on = friendsOnline().get(f.tag);
              if (on) befriend(on.memberId);
              else void addFriend(f.tag, f.name);
            }}
            onRemove={(f) => void removeFriend(f.tag)}
            onClose={() => setFriendsOpen(false)}
          />
        )}

        {session && guide && <GuidePanel place={place} onClose={() => setGuide(false)} />}
        {session && intro && !guide && (
          <PlaceIntro
            place={intro}
            onClose={() => setIntro(null)}
            onMore={() => {
              setIntro(null);
              setGuide(true);
            }}
          />
        )}

        {liveHere && stageLive && !seminar && (
          <StageFeedPanel
            live={stageLive}
            stream={feed.stream}
            link={feed.link}
            embed={stageLive.embed ? streamFor(stageLive) : null}
            full={feed.full}
            onOpen={() => setSeminar(true)}
          />
        )}

        <div className="hud-bottom">
          {talk ? (
            <DialogBox key={talk.speaker + talk.pages[0]} speaker={talk.speaker} pages={talk.pages} choices={talk.choices} onClose={() => setTalk(null)} />
          ) : reach?.kind === "seated" ? (
            <button type="button" className="rpg-box seated-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => startActivity(reach.room)}>
              {reach.room.kind === "foodcourt"
                ? "🎮 Main game sambil makan"
                : reach.room.kind === "seminar"
                  ? "🎤 Tonton seminar"
                  : reach.room.kind === "aula"
                    ? stageLive?.venue === "aula"
                      ? "🔴 Tonton siaran panggung"
                      : "🗓️ Lihat jadwal acara"
                    : reach.room.kind === "konsultasi"
                      ? "📞 Telepon seseorang"
                      : "📝 Kerjakan psikotes"}
            </button>
          ) : reach?.kind === "sofa" ? (
            <button type="button" className="rpg-box seated-btn" onPointerDown={(e) => e.stopPropagation()} onClick={seatedAction}>
              {vipSeatBooth(self?.seatId ?? "") ? `💬 Ngobrol dengan ${spgName(vipSeatBooth(self!.seatId!)!)}` : "🎮 Main mini game"}
            </button>
          ) : reach?.kind === "soon" ? (
            <ParkCard building={reach.building} />
          ) : reach && reachHint(reach.kind) ? (
            <button type="button" className="rpg-box seated-btn reach-hint" onPointerDown={(e) => e.stopPropagation()} onClick={interact}>
              {reachHint(reach.kind)} <span className="rpg-kbd">E</span>
            </button>
          ) : session && anomalyHere && !anomalyHere.claimed ? (
            <button type="button" className="rpg-box seated-btn anom-hint" onPointerDown={(e) => e.stopPropagation()} onClick={catchAnomaly}>
              {anomalyHere.rare ? "🌟" : "✨"} {anomalyHere.name} muncul di lantai ini! {collection.has(anomalyHere.kind) ? "Sudah di koleksi" : "Tangkap"}
            </button>
          ) : session && !reach ? (
            <div className="rpg-box hint hint-keys">
              <span className="rpg-kbd">W</span>
              <span className="rpg-kbd">A</span>
              <span className="rpg-kbd">S</span>
              <span className="rpg-kbd">D</span> jalan · <span className="rpg-kbd">E</span> bicara · <span className="hint-extra">klik orang atau meja untuk menyapa · </span>
              {park ? "🏢 pintu gedung membawa ke lobi" : libRoom ? "🚪 pintu bawah kembali ke taman" : "🛗 ikuti panah ke lift"} · ❓ panduan
            </div>
          ) : null}
        </div>

        {toast && (
          <div className="toast rpg-box" data-long={toast.length > 48 ? "" : undefined}>
            {toast}
          </div>
        )}
        <PingCards items={pings} onClose={(id) => setPings((list) => list.filter((p) => p.id !== id))} />
        {follow && !pings.length && (
          <FollowBar name={follow.name} where={fair.visitors.get(follow.memberId) && floorLabel(fair.visitors.get(follow.memberId)!.floorId)} onStop={() => setFollow(null)} />
        )}

        {session && announcement && announcement.at !== annSeen && (
          <div className="fair-ann rpg-box" role="status" onPointerDown={(e) => e.stopPropagation()}>
            <span className="fair-ann-ico">📢</span>
            <span className="fair-ann-text">
              <b>Panitia</b> · {announcement.text}
            </span>
            <button type="button" className="fair-ann-x" onClick={() => setAnnSeen(announcement.at)} aria-label="Tutup pengumuman">
              ✕
            </button>
          </div>
        )}

        {session && (
          <div ref={navRef} className="hud hud-bl" onPointerDown={(e) => e.stopPropagation()}>
            <div className="rpg-box actions tabbar">
              <button type="button" className="menu-btn" onClick={() => setPanel("profile")} title="Profil, lamaran, dan stempel stand">
                <span className="tab-ico">🎒</span>
                <span className="tab-txt">Profil</span>
              </button>
              <button type="button" className="menu-btn" onClick={() => setPanel("applications")} title="Lamaran yang sudah kamu kirim">
                <span className="tab-ico">📋</span>
                <span className="tab-txt">Lamaran</span>
                {mine.length > 0 && <span className="menu-dot menu-dot-calm">{mine.length}</span>}
              </button>
              <button type="button" className="menu-btn mission-btn" onClick={() => setMissions(true)} title="Misi harian">
                <span className="tab-ico">🎯</span>
                <span className="tab-txt">Misi</span>
                {fair.claimable() + (fair.canClaimDaily() ? 1 : 0) > 0 && <span className="menu-dot">{fair.claimable() + (fair.canClaimDaily() ? 1 : 0)}</span>}
              </button>
              <button type="button" className="menu-btn" onClick={() => setMapOpen(true)} title="Peta: denah tiap lantai dan lowongan per perusahaan">
                <span className="tab-ico">🗺️</span>
                <span className="tab-txt">Peta</span>
              </button>
              <button type="button" className="menu-btn coin-btn" onClick={() => setWallet(true)} title="Dompet koin dan voucher">
                <span className="tab-ico">🪙</span>
                <span className="tab-txt">{me.coins}</span>
              </button>
              <button type="button" className="leave" onClick={leave} title="Keluar dari job fair">
                <span className="tab-ico">🚪</span>
                <span className="tab-txt">Keluar</span>
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
            player={me}
            companyRating={(id) => fair.companyRating(id)}
            visited={fair.visitedBy.get(session.visitorId) ?? new Set()}
            onSaveProfile={updateProfile}
            onReply={(id, text) => fair.replyToCompany(id, text)}
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
                if (hasStand(b)) setToast(`Menuju stand ${b.company}`);
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
            onVerify={() => {
              setPanel(null);
              setVerify(true);
            }}
            account={account?.email}
            onEditCharacter={() => {
              setPanel(null);
              setEditLook(true);
            }}
            onSignOut={signOut}
            onClose={() => setPanel(null)}
          />
        )}

        {session && editLook && (
          <div className="mb-backdrop cc-modal" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditLook(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <CharacterCreator
                defaultName={session.name}
                withCompanions={false}
                cta="Simpan karakter"
                note=""
                onCancel={() => setEditLook(false)}
                onCheckIn={(c) => {
                  const v = fair.visitors.get(session.visitorId);
                  if (v) v.displayName = c.name;
                  setSession({ ...session, name: c.name, look: c.look });
                  setEditLook(false);
                  setPanel("profile");
                }}
              />
            </div>
          </div>
        )}

        {session && library && <Library onClose={() => setLibrary(false)} />}

        {session && games && (
          <SofaGames
            onLibrary={() => {
              setGames(false);
              setToast("📚 Menuju Perpustakaan di taman");
              goToLibrary();
            }}
            left={fair.gameCoinsLeft()}
            logos={fair.fair.booths.map((b) => ({ logo: b.logo, color: b.color }))}
            onReward={(game, coins) => fair.rewardGame(game, coins)}
            myName={session?.name ?? "Kamu"}
            read={me.read ?? []}
            onRead={(id) => fair.readArticle(id)}
            roadmap={me.roadmap ?? {}}
            onToggleStep={(id, key) => fair.toggleStep(id, key)}
            jobsFor={(keys) =>
              fair.fair.booths
                .flatMap((b) =>
                  openJobs(b)
                    .filter((j) => keys.some((k) => j.title.toLowerCase().includes(k)))
                    .map((j) => ({ boothId: b.id, company: b.company, title: j.title })),
                )
                .slice(0, 4)
            }
            onGoToBooth={(id) => {
              const b = fair.booth(id);
              setGames(false);
              if (b) goToBooth(b);
            }}
            onClose={() => setGames(false)}
          />
        )}

        {session &&
          !ring &&
          invite &&
          (inviteVisit ? (
            <VisitCard
              application={invite}
              onClose={() => setInviteId(null)}
              onOpen={() => {
                setInviteId(null);
                setPanel("applications");
              }}
            />
          ) : (
            <InviteCard
              application={invite}
              onClose={() => setInviteId(null)}
              onOpen={() => {
                setInviteId(null);
                setPanel("applications");
              }}
            />
          ))}

        {ring && (
          <CallScreen
            kind={ring.kind}
            peerName={ring.from === "seeker" ? ring.company : `${ring.recruiter} · ${ring.company}`}
            peerSub={ring.from === "seeker" ? `Pencari kerja · ${ring.jobTitle?.slice(0, 40) || "Lounge Konsultasi"}` : `Tentang lamaran ${ring.jobTitle}`}
            peerLogo={ring.logo || undefined}
            peerLook={ring.from === "seeker" ? lookFor(ring.company) : undefined}
            peerColor={ring.color}
            limit={ring.minutes ? ring.minutes * 60 : undefined}
            incoming={ring}
            onEnd={(r) => {
              setRing(null);
              setToast(r.answered ? `Panggilan dengan ${ring.company} selesai` : r.result === "declined" ? "Panggilan ditolak" : `Panggilan tak terjawab dari ${ring.company}`);
            }}
          />
        )}

        {session && mapOpen && (
          <MapPanel
            fair={fair.fair}
            floorOf={(id) => fair.floor(id)}
            places={[...fair.stops, fair.parkStop(), fair.libraryStop()].map(
              (st): MapPlace => ({ ...st, hall: st.roomId || st.level < 0 ? -1 : fairFloorIndex(st.floorId), closed: fair.floorClosed(st.floorId) }),
            )}
            parkBuildings={fair.shownParkBuildings()}
            here={self ? { floorId: self.floorId, x: self.x, y: self.y, facing: self.facing } : null}
            onWalk={(b) => {
              setMapOpen(false);
              goToBooth(b);
              setToast(`🚶 Menuju stand ${b.company}`);
            }}
            onOpenJob={(boothId, jobId) => {
              const b = fair.booth(boothId);
              setMapOpen(false);
              if (b) setBoard({ boothId, jobId, about: !jobId && !openJobs(b).length });
            }}
            onGoPlace={(p) => {
              setMapOpen(false);
              if (p.floorId === fair.parkId) goToPark();
              else if (p.floorId === fair.libraryId) goToLibraryDoor();
              else pickFloor(p.floorId);
            }}
            onClose={() => setMapOpen(false)}
          />
        )}

        {session && missions && (
          <MissionsPanel
            missions={fair.missions()}
            bonusClaimed={fair.dailyState().bonus}
            streak={me.streak ?? 0}
            canClaimDaily={fair.canClaimDaily()}
            onClaim={(id) => fair.claimMission(id)}
            onBonus={() => fair.claimMissionBonus() && setToast("🏆 Semua misi selesai, bonus koin!")}
            onDaily={claimDaily}
            onClose={() => setMissions(false)}
          />
        )}

        {session && verify && (
          <VerifyPanel
            name={profile.name || session.name}
            coins={me.coins}
            verified={!!me.verified}
            onBuy={() =>
              setCoinAsk({ price: price("coin.verify"), what: "centang biru (akun terverifikasi)", run: () => fair.buyVerified() && setToast("✔ Akunmu sekarang terverifikasi") })
            }
            onTopUp={() => {
              setVerify(false);
              setWallet(true);
            }}
            onClose={() => setVerify(false)}
          />
        )}

        {session && promo && (
          <PromoCard
            promoter={promo}
            look={staffLook(promo.name, promo.color)}
            saved={fair.hasPromo(promo.id)}
            onSave={() => fair.savePromo(promo.id) && setToast(`🎟️ Kode ${promo.code} disimpan di dompet`)}
            onVisit={() => fair.ad(`promo:${promo.id}`, "click")}
            onJobs={
              promo.boothId
                ? () => {
                    setPromo(null);
                    setBoard({ boothId: promo.boothId! });
                  }
                : undefined
            }
            onClose={() => setPromo(null)}
          />
        )}

        {session && mediaBooth && media && (
          <BoothMediaPanel
            booth={mediaBooth}
            acc={media.acc}
            merchLeft={(mediaOf(mediaBooth).merch.stock ?? 0) - (fair.ads.get(`acc:${mediaBooth.id}:giveaway`)?.sold ?? 0)}
            onUse={(action) => fair.useAccessory(mediaBooth.id, media.acc, action)}
            onJobs={() => {
              setMedia(null);
              setBoard({ boothId: mediaBooth.id });
            }}
            onToast={setToast}
            onClose={() => setMedia(null)}
          />
        )}

        {sponsor && <SponsorCard sponsor={sponsor} onClose={() => setSponsor(null)} />}

        {booking && <BookStand slot={booking} onClose={() => setBooking(null)} />}
        {renting !== null && <RentStall slot={renting} onClose={() => setRenting(null)} />}
        {coinAsk && <CoinConfirmModal ask={coinAsk} coins={me.coins} onCancel={() => setCoinAsk(null)} />}

        {session && wallet && (
          <WalletPanel
            player={me}
            stand={fair.fair.coinStand}
            atStand={wallet === "desk" || reach?.kind === "coins" || reach?.kind === "info"}
            canClaim={fair.canClaimDaily()}
            live={LIVE}
            onBuy={async (id, method) => {
              if (!LIVE) {
                const got = fair.buyCoins(id, method);
                const pkg = fair.fair.coinStand.packages.find((p) => p.id === id);
                return got ? { ok: true, text: `Pembayaran ${pkg?.price ?? ""} lewat ${method} berhasil. +${got} koin.` } : { ok: false, text: "Paket tidak ditemukan." };
              }
              const r = await pay({ kind: "coins", pack: id });
              if (!r.ok) return { ok: false, text: r.error };
              if ("redirect" in r) return "redirect";
              // No gateway set up: the server settled it at once, so take the coins now.
              await claimPaidCoins();
              return { ok: true, text: "Pembayaran simulasi berhasil. Koin sudah masuk." };
            }}
            onClaim={claimDaily}
            onGoToStand={() => {
              setWallet(false);
              goToCoinStand();
            }}
            onGoToDesk={() => {
              setWallet(false);
              goTo(floor.id, desk.x + desk.width / 2, desk.y + desk.height + 0.6, () => setWallet("desk"));
            }}
            onClose={() => setWallet(false)}
          />
        )}

        {session && lift && (
          <LiftPanel
            stops={fair.stops}
            here={floor.id}
            library={{
              id: fair.libraryId,
              onPick: () => {
                setLift(false);
                if (!libRoom) goToLibrary();
              },
            }}
            park={{
              id: fair.parkId,
              via: fair.stopOf(fair.lobbyId).name,
              onPick: () => {
                setLift(false);
                if (!park) goToPark();
              },
            }}
            atLift={reach?.kind === "lift"}
            ticket={(floorId) => {
              const pass = fair.passFor(floorId);
              return pass && !fair.hasTicket(pass.id) ? pass.price : null;
            }}
            closed={(floorId) => fair.floorClosed(floorId)}
            onPick={pickFloor}
            onClose={() => setLift(false)}
          />
        )}

        {session && stallView && (
          <FoodMenu
            stall={stallView}
            coins={me.coins}
            onBuy={(dealId) => fair.buyDeal(stallView.id, dealId)}
            onVisit={() => fair.ad(`stall:${stallView.id}`, "click")}
            onTopUp={() => {
              setStall(null);
              setWallet(true);
            }}
            onClose={() => setStall(null)}
          />
        )}

        {session && psych && (
          <PsychTest
            name={profile.name || session.name}
            past={me.psych}
            config={fair.psychConfig()}
            onDone={(res) => fair.recordPsych(res)}
            onClose={() => {
              setPsych(false);
              const best = fair.bestPsych();
              if (best != null) fair.say(roomStaffId("psikotes"), `Nilai terbaikmu ${best}. Semangat melamar!`, 3000);
            }}
          />
        )}

        {session && notifs && (
          <Modal
            title="🔔 Notifikasi"
            className="nt-modal"
            onClose={() => setNotifs(false)}
            foot={
              <div className="nt-foot">
                <small>Notifikasi terhapus otomatis setelah 7 hari.</small>
                <span>
                  {fair.unreadFor(PLAYER_ID) > 0 && (
                    <button type="button" className="small-btn ghost" onClick={() => fair.markRead(PLAYER_ID)}>
                      Tandai dibaca
                    </button>
                  )}
                  {fair.notifsFor(PLAYER_ID).length > 0 && (
                    <button type="button" className="small-btn ghost" onClick={() => fair.deleteNotif(PLAYER_ID)}>
                      🗑️ Hapus semua
                    </button>
                  )}
                </span>
              </div>
            }
          >
            <PushCard who="seeker" />
            <NotifList
              items={fair.notifsFor(PLAYER_ID)}
              onDelete={(n) => fair.deleteNotif(PLAYER_ID, n.id)}
              empty="Belum ada notifikasi. Status lamaran, balasan chat, panggilan, undangan interview, dan kunjungan kantor dari HR muncul di sini."
              onPick={(n) => {
                fair.markRead(PLAYER_ID, n.id);
                setNotifs(false);
                const app = n.appId ? fair.applications.find((x) => x.id === n.appId) : undefined;
                if (n.kind === "interview" && app?.interview) setInviteId(app.id);
                else if (n.kind === "visit" && app?.visit) setInviteId(`visit:${app.id}`);
                else setPanel("applications");
              }}
            />
          </Modal>
        )}

        {session && aula && (
          <AulaBoard
            tab={aula}
            stops={fair.stops}
            onClose={() => setAula(null)}
            onGo={(st) => {
              setAula(null);
              pickFloor(st.floorId);
            }}
          />
        )}

        {session && seminar && (
          <SeminarView
            attended={me.seminars}
            attendees={(id) => fair.seminarCounts.get(id) ?? 0}
            sessions={fair.seminars()}
            viewerId={session.visitorId}
            name={profile.name || session.name}
            speakerLook={(n) => staffLook(n, "#0e7490")}
            audience={avatars.filter((a) => a.floorId === floor.id).length}
            venue={room?.kind === "aula" ? "aula" : "seminar"}
            onFinish={(id) => {
              fair.track("seminar");
              if (fair.attendSeminar(id)) setToast("🎓 E-sertifikat didapat, +30 XP");
            }}
            onClose={() => setSeminar(false)}
          />
        )}

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

        {session && phone && (
          <PhoneBox
            book={phoneBook(friends.friends, friendsOnline())}
            coins={me.coins}
            canCall={canCallOtherTabs()}
            onStart={(c) => {
              setPhone(false);
              startLoungeCall({ ...c, via: "Telepon umum di taman" });
            }}
            onFriends={() => (setPhone(false), setFriendsOpen(true))}
            onTopUp={() => (setPhone(false), setWallet(true))}
            onClose={() => setPhone(false)}
          />
        )}

        {session && lounge && (
          <LoungeDesk
            view={lounge}
            consultants={room?.consultants ?? []}
            peers={loungePeers()}
            coins={me.coins}
            onStart={startLoungeCall}
            onTopUp={() => (setLounge(null), setWallet(true))}
            onClose={() => setLounge(null)}
          />
        )}

        {session && loungeCall && (
          <CallScreen
            kind={loungeCall.kind}
            peerName={loungeCall.name}
            peerSub={loungeCall.sub}
            peerLook={loungeCall.look}
            peerColor={loungeCall.color}
            bot={!loungeCall.ring}
            outgoing={loungeCall.ring}
            lines={loungeCall.lines}
            botNote="Demo: lawan bicara adalah bot. Versi live menyambungkan panggilan sungguhan lewat server."
            limit={loungeCall.minutes * 60}
            // A real consultant picked up: now the call is paid (nothing is charged for a missed or declined one).
            onAnswered={loungeCall.payOnAnswer ? () => fair.startLoungeCall("consult", loungeCall.minutes, loungeCall.name) : undefined}
            onEnd={(r) => {
              setLoungeCall(null);
              if (r.answered) setToast(`Panggilan selesai (${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, "0")})`);
              else if (loungeCall.payOnAnswer && r.result !== "ended") setToast("Konsultan sedang tidak di meja");
            }}
          />
        )}

        {applyBooth && session && (
          <ApplyForm
            booth={applyBooth}
            jobId={applying?.jobId}
            defaultName={session.name}
            defaults={profile}
            appliedJobIds={appliedIds}
            cost={fair.freeApplies() ? "🎟️ voucher" : `${price("coin.apply")} 🪙`}
            note={LIVE ? "Lamaran disimpan di server jobfair dan dikirim ke perusahaan." : undefined}
            onClose={() => setApplying(null)}
            onSubmit={(input) => submit(applyBooth.id, input)}
          />
        )}

        {!session && (
          <div className="title-screen" onPointerDown={(e) => e.stopPropagation()}>
            <a className="home-link rpg-box" href="#/">
              ← Beranda
            </a>
            <InstallButton className="title-install rpg-box" />
            {account ? (
              <div className="title-stack">
                <div className="title-account rpg-box">
                  <span>
                    👤 {account.name} · {account.email}
                  </span>
                  <button type="button" onClick={signOut}>
                    Ganti akun
                  </button>
                </div>
                {account.mustVerify && (
                  <div className="title-verify rpg-box" role="status">
                    <span>📧 Cek email untuk verifikasi akun sebelum melamar.</span>
                    <button type="button" onClick={async () => setToast(await resendVerification())}>
                      Kirim ulang
                    </button>
                  </div>
                )}
                {character ? (
                  <ReturningCard character={character} onEnter={() => enter(character)} />
                ) : (
                  <CharacterCreator
                    key={account.email}
                    defaultName={account.name}
                    onCheckIn={enter}
                    withCompanions={false}
                    cta="Masuk job fair ▶"
                    note="Tampilan ini bisa diubah lagi nanti dari 🎒 Profil."
                  />
                )}
              </div>
            ) : (
              <AccountGate
                onIn={(a) => {
                  setAccount(a);
                  setProfile(loadProfile());
                }}
              />
            )}
          </div>
        )}
      </CafeScene>
    </div>
  );
}
