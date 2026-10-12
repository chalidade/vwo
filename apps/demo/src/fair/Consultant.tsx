import { ArrowLeft, CheckCircle2, Clock, Coins, Headset, Pencil, PhoneIncoming, PhoneMissed, Power, Send, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CONSULT_COLORS, CONSULT_EMOJIS, CONSULT_LIMITS as L, type ConsultantProfile, consultAddress, deskName, koinText } from "@vwo/shared";
import { ACCOUNT_EVENT, type Account, currentAccount } from "../account";
import { type Contact, type MyConsult, type MyDesk, applyToOrganizer, buySlot, loadMine, onConsultChange, saveProfile, setOpen } from "../consult";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";
import { type RingSignal, canCallOtherTabs, listenForCalls, onSignal, sendSignal } from "./call";
import { CallScreen } from "./Call";

const EMPTY: ConsultantProfile = { name: "", role: "", org: "", topics: ["", "", ""], bio: "", emoji: CONSULT_EMOJIS[0], color: CONSULT_COLORS[0] };

/** What goes to the server: blank topics and empty optional fields left out. */
const cleanProfile = (p: ConsultantProfile): ConsultantProfile => ({
  name: p.name.trim(),
  role: p.role.trim(),
  ...(p.org?.trim() ? { org: p.org.trim() } : {}),
  topics: p.topics.map((t) => t.trim()).filter(Boolean),
  ...(p.bio?.trim() ? { bio: p.bio.trim() } : {}),
  emoji: p.emoji,
  color: p.color,
});
const profileReady = (p: ConsultantProfile) => p.name.trim().length >= 2 && p.role.trim().length >= 2 && p.topics.some((t) => t.trim().length >= 2);

function useAccount() {
  const [a, setA] = useState<Account | null>(currentAccount);
  useEffect(() => {
    const on = () => setA(currentAccount());
    window.addEventListener(ACCOUNT_EVENT, on);
    return () => window.removeEventListener(ACCOUNT_EVENT, on);
  }, []);
  return a;
}

/**
 * The consultant's page: get a desk in the consultation lounge (apply to the organiser for free, or
 * buy a slot with coins), then edit the profile visitors see and open the desk to take calls.
 */
export function ConsultantPage() {
  useFair();
  const account = useAccount();
  const [mine, setMine] = useState<MyConsult | null>(null);
  const [error, setError] = useState("");
  const reload = () =>
    void loadMine().then((r) => {
      if (r.ok) {
        setMine(r.data);
        setError("");
      } else setError(r.error);
    });
  useEffect(() => {
    if (!account) return;
    reload();
    return onConsultChange(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.email]);

  return (
    <main className="cp inv-page ks-page">
      <div className="inv-bar">
        <a className="small-btn ghost cp-link" href="#/jobfair">
          <ArrowLeft size={14} aria-hidden /> Ke job fair
        </a>
      </div>
      <div className="card">
        <h2 className="cp-h2 ks-title">
          <Headset size={18} aria-hidden /> Konsultan Lounge Konsultasi
        </h2>
        <p className="muted small ks-lead">
          Pencari kerja menelepon kamu dari meja konsultasi di Lounge Konsultasi untuk tanya soal CV, interview, dan karier. Satu akun, satu meja.
        </p>
        {!account ? (
          <p className="cp-server-note">
            Masuk dulu dengan akunmu di halaman <a href="#/jobfair">Job Fair</a>, lalu buka halaman ini lagi.
          </p>
        ) : error ? (
          <p className="bk-err">{error}</p>
        ) : !mine ? (
          <p className="muted small">Memuat…</p>
        ) : null}
      </div>
      {account && mine && (mine.consultant ? <DeskView desk={mine.consultant} onChanged={reload} /> : <GetDesk account={account} mine={mine} onChanged={reload} />)}
    </main>
  );
}

/** No desk yet: what the application says, and the two ways to a desk. */
function GetDesk({ account, mine, onChanged }: { account: Account; mine: MyConsult; onChanged: () => void }) {
  const req = mine.request;
  const [profile, setProfile] = useState<ConsultantProfile>(() =>
    req ? { ...EMPTY, ...req.profile, topics: [...req.profile.topics, "", "", ""].slice(0, 3) } : { ...EMPTY, name: account.name },
  );
  const [contact, setContact] = useState<Contact>(() => ({ email: req?.email ?? account.email, phone: req?.phone ?? "" }));
  const [desk, setDesk] = useState(mine.freeDesks[0] ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const ready = profileReady(profile) && /\S+@\S+\.\S+/.test(contact.email) && /^\+?[0-9 ()-]{8,20}$/.test(contact.phone.trim());
  const pending = req?.status === "pending";
  const coins = fair.player.coins;

  const run = async (what: "apply" | "buy") => {
    if (!ready) return setError("Lengkapi nama, peran, minimal satu topik, email, dan nomor HP dulu.");
    if (what === "buy" && !confirm(`Beli ${deskName(desk)} seharga ${koinText(mine.price)}?`)) return;
    setBusy(true);
    setError("");
    const c = { email: contact.email.trim(), phone: contact.phone.trim() };
    const r = what === "apply" ? await applyToOrganizer(cleanProfile(profile), c) : await buySlot(desk, cleanProfile(profile), c);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(what === "apply" ? "Pendaftaran terkirim. Panitia akan memeriksa dan memberi kabar lewat email." : `${deskName(desk)} sudah jadi milikmu.`);
    onChanged();
  };

  return (
    <>
      {req && (
        <div className="card ks-status" data-status={req.status}>
          {req.status === "pending" && (
            <p>
              <Clock size={16} aria-hidden /> <b>Pendaftaranmu sedang diperiksa panitia.</b> Kamu bisa mengubah isinya di bawah, atau langsung beli slot kalau ingin segera dapat
              meja.
            </p>
          )}
          {req.status === "rejected" && (
            <p>
              <XCircle size={16} aria-hidden /> <b>Pendaftaran belum diterima.</b> {req.note ? `Alasan: ${req.note}` : ""} Kamu bisa mendaftar lagi atau membeli slot.
            </p>
          )}
          {req.status === "removed" && (
            <p>
              <XCircle size={16} aria-hidden /> <b>Mejamu sudah dilepas panitia.</b> Daftar lagi atau beli slot untuk kembali.
            </p>
          )}
        </div>
      )}
      <div className="card">
        <h2 className="cp-h2">Dua cara dapat meja</h2>
        <ol className="ks-ways">
          <li>
            <b>Daftar ke panitia</b> (gratis). Panitia memeriksa profilmu lalu memberi meja yang kosong. Kabar dikirim ke email.
          </li>
          <li>
            <b>Beli slot konsultan</b> ({koinText(mine.price)} per acara). Meja langsung jadi milikmu begitu dibayar dengan koin.
          </li>
        </ol>
        <p className="muted small">Meja kosong sekarang: {mine.freeDesks.length ? mine.freeDesks.map(deskName).join(", ") : "tidak ada, semua meja terisi"}.</p>
      </div>
      <div className="card">
        <h2 className="cp-h2">Profil konsultan</h2>
        <ProfileFields value={profile} onChange={setProfile} />
        <h3 className="ks-sub">Kontak untuk panitia</h3>
        <p className="muted small">Tidak ditampilkan ke pengunjung.</p>
        <div className="bk-form">
          <label>
            Email
            <input type="email" value={contact.email} maxLength={L.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          </label>
          <label>
            Nomor HP / WhatsApp
            <input type="tel" value={contact.phone} maxLength={L.phone} placeholder="08xxxxxxxxxx" onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </label>
        </div>
      </div>
      <div className="ks-options">
        <div className="card">
          <h2 className="cp-h2">Daftar ke panitia</h2>
          <p className="muted small">Gratis. Panitia yang memilih mejamu.</p>
          <button type="button" className="small-btn ks-go" disabled={busy} onClick={() => void run("apply")}>
            <Send size={15} aria-hidden /> {pending ? "Perbarui pendaftaran" : "Kirim pendaftaran"}
          </button>
        </div>
        <div className="card">
          <h2 className="cp-h2">Beli slot konsultan</h2>
          {mine.freeDesks.length ? (
            <>
              <label className="ks-desk">
                Pilih meja
                <select value={desk} onChange={(e) => setDesk(Number(e.target.value))}>
                  {mine.freeDesks.map((d) => (
                    <option key={d} value={d}>
                      {deskName(d)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">
                <Coins size={13} aria-hidden /> Saldo {koinText(coins)}.{" "}
                {coins < mine.price && (
                  <>
                    Isi koin dulu lewat dompet koin di <a href="#/jobfair">Job Fair</a>.
                  </>
                )}
              </p>
              <button type="button" className="small-btn ks-go" disabled={busy || mine.price <= 0} onClick={() => void run("buy")}>
                <Coins size={15} aria-hidden /> Beli {deskName(desk)} · {koinText(mine.price)}
              </button>
            </>
          ) : (
            <p className="muted small">Semua meja sedang terisi. Daftar ke panitia, nanti dikabari saat ada meja kosong.</p>
          )}
        </div>
      </div>
      {error && <p className="bk-err">{error}</p>}
      {done && (
        <p className="ks-ok">
          <CheckCircle2 size={15} aria-hidden /> {done}
        </p>
      )}
    </>
  );
}

function ProfileFields({ value: p, onChange }: { value: ConsultantProfile; onChange: (p: ConsultantProfile) => void }) {
  const set = (patch: Partial<ConsultantProfile>) => onChange({ ...p, ...patch });
  return (
    <div className="bk-form">
      <label>
        Nama tampilan
        <input value={p.name} maxLength={L.name} placeholder="Kak Rani" onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label>
        Peran / jabatan
        <input value={p.role} maxLength={L.role} placeholder="Konsultan karier" onChange={(e) => set({ role: e.target.value })} />
      </label>
      <label>
        Organisasi (boleh dikosongkan)
        <input value={p.org ?? ""} maxLength={L.org} placeholder="Nama perusahaan atau komunitas" onChange={(e) => set({ org: e.target.value })} />
      </label>
      <fieldset className="ks-topics">
        <legend>Topik konsultasi (1–3)</legend>
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            value={p.topics[i] ?? ""}
            maxLength={L.topic}
            placeholder={["Review CV", "Persiapan interview", "Pindah bidang kerja"][i]}
            aria-label={`Topik ${i + 1}`}
            onChange={(e) => set({ topics: [0, 1, 2].map((k) => (k === i ? e.target.value : (p.topics[k] ?? ""))) })}
          />
        ))}
      </fieldset>
      <label>
        Perkenalan singkat
        <textarea value={p.bio ?? ""} maxLength={L.bio} rows={3} placeholder="Pengalaman dan hal yang bisa kamu bantu" onChange={(e) => set({ bio: e.target.value })} />
      </label>
      <div className="bk-colors" role="radiogroup" aria-label="Ikon">
        <span className="small">Ikon</span>
        {CONSULT_EMOJIS.map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={p.emoji === x}
            data-active={p.emoji === x ? "" : undefined}
            className="rs-emoji"
            onClick={() => set({ emoji: x })}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="bk-colors" role="radiogroup" aria-label="Warna">
        <span className="small">Warna</span>
        {CONSULT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={p.color === c}
            aria-label={c}
            data-active={p.color === c ? "" : undefined}
            style={{ background: c }}
            onClick={() => set({ color: c })}
          />
        ))}
      </div>
    </div>
  );
}

interface LogEntry {
  at: number;
  name: string;
  minutes: number;
  answered: boolean;
  seconds: number;
}
const logKey = (id: string) => `vwo:consult-log:${id}`;
function readLog(id: string): LogEntry[] {
  try {
    const l = JSON.parse(localStorage.getItem(logKey(id)) ?? "[]") as LogEntry[];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const hhmm = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** The consultant's own desk: open it to take calls, edit the profile, and today's calls. */
function DeskView({ desk, onChanged }: { desk: MyDesk; onChanged: () => void }) {
  const [open, setOpenState] = useState(false);
  const [ring, setRing] = useState<RingSignal | null>(null);
  const [log, setLog] = useState<LogEntry[]>(() => readLog(desk.id));
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ConsultantProfile>(() => ({ ...desk.profile, topics: [...desk.profile.topics, "", "", ""].slice(0, 3) }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ringRef = useRef<RingSignal | null>(null);
  ringRef.current = ring;
  const address = consultAddress(desk.id);

  // While the desk is open: tell the server every minute (the lamp in the lounge stays green), and take calls.
  useEffect(() => {
    if (!open) return;
    const beat = setInterval(() => void setOpen(true), 60_000);
    const stopListening = LIVE ? listenForCalls([address]) : () => {};
    const off = onSignal((s) => {
      if (s.type !== "ring" || s.to !== address) return;
      // Already on a call: the second caller hears "busy" and pays nothing.
      if (ringRef.current) return sendSignal({ type: "busy", callId: s.callId });
      setRing(s);
      navigator.vibrate?.([300, 200, 300]);
    });
    const close = () => void setOpen(false);
    window.addEventListener("pagehide", close);
    return () => {
      clearInterval(beat);
      stopListening();
      off();
      window.removeEventListener("pagehide", close);
    };
  }, [open, address]);

  // The desk opens only while this page listens: a lamp left green by an earlier visit goes off, and leaving closes it.
  const openRef = useRef(false);
  openRef.current = open;
  useEffect(() => {
    if (desk.open) void setOpen(false);
    return () => {
      if (openRef.current) void setOpen(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    setBusy(true);
    setMsg("");
    const r = await setOpen(!open);
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setOpenState(!open);
  };

  const save = async () => {
    if (!profileReady(profile)) return setMsg("Lengkapi nama, peran, dan minimal satu topik.");
    setBusy(true);
    const r = await saveProfile(cleanProfile(profile));
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setEditing(false);
    setMsg("Profil disimpan.");
    onChanged();
  };

  const today = log.filter((l) => sameDay(l.at, Date.now()));
  const p = desk.profile;
  return (
    <>
      <div className="card ks-desk-card" style={{ ["--c" as string]: p.color }}>
        <div className="ks-desk-head">
          <span className="ks-avatar" aria-hidden>
            {p.emoji}
          </span>
          <div>
            <b>{p.name}</b>
            <span className="muted small">
              {p.role}
              {p.org ? ` · ${p.org}` : ""}
            </span>
            <span className="muted small">
              {deskName(desk.desk)} · {desk.via === "slot" ? "slot dibeli" : "dari panitia"}
            </span>
          </div>
        </div>
        <div className="ks-open" data-open={open ? "" : undefined}>
          <span>
            <Power size={16} aria-hidden /> {open ? "Meja buka: pencari kerja bisa menelepon" : "Meja tutup: pencari kerja melihat kamu sedang tidak di meja"}
          </span>
          <button type="button" className="small-btn ks-go" disabled={busy} onClick={() => void toggle()}>
            {open ? "Tutup meja" : "Buka meja"}
          </button>
        </div>
        {open && <p className="muted small">Biarkan halaman ini terbuka. Panggilan masuk berdering di sini; izinkan mikrofon (dan kamera untuk video call) saat diminta.</p>}
        {!canCallOtherTabs() && <p className="bk-err">Browser ini tidak mendukung panggilan. Pakai Chrome, Edge, Firefox, atau Safari terbaru.</p>}
        {!LIVE && <p className="muted small">Demo: buka job fair di tab lain browser ini, masuk ke Lounge Konsultasi, lalu telepon {deskName(desk.desk)}.</p>}
      </div>

      <div className="card">
        <div className="ks-row">
          <h2 className="cp-h2">Profil di meja</h2>
          {!editing && (
            <button type="button" className="small-btn ghost" onClick={() => setEditing(true)}>
              <Pencil size={14} aria-hidden /> Ubah
            </button>
          )}
        </div>
        {editing ? (
          <>
            <ProfileFields value={profile} onChange={setProfile} />
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="small-btn ghost" onClick={() => setEditing(false)}>
                Batal
              </button>
              <button type="button" className="small-btn ks-go" disabled={busy} onClick={() => void save()}>
                Simpan profil
              </button>
            </div>
          </>
        ) : (
          <>
            <ul className="ks-topic-list">
              {p.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {p.bio && <p className="small">{p.bio}</p>}
          </>
        )}
        {msg && <p className="small">{msg}</p>}
      </div>

      <div className="card">
        <h2 className="cp-h2">Panggilan hari ini ({today.length})</h2>
        {today.length === 0 ? (
          <p className="muted small">Belum ada panggilan hari ini.</p>
        ) : (
          <ul className="ks-log">
            {today.map((l) => (
              <li key={l.at}>
                {l.answered ? <PhoneIncoming size={15} aria-hidden /> : <PhoneMissed size={15} aria-hidden />}
                <span>
                  <b>{l.name}</b> · {hhmm(l.at)}
                </span>
                <span className="muted small">
                  {l.answered ? `${Math.floor(l.seconds / 60)}:${String(l.seconds % 60).padStart(2, "0")} dari ${l.minutes} menit` : "tidak terjawab"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ring && (
        <CallScreen
          kind={ring.kind}
          peerName={ring.company}
          peerSub={`Pencari kerja · ${ring.minutes ?? 0} menit konsultasi`}
          peerColor="#0f766e"
          limit={ring.minutes ? ring.minutes * 60 : undefined}
          incoming={ring}
          onEnd={(r) => {
            const entry: LogEntry = { at: Date.now(), name: ring.company.slice(0, 40), minutes: ring.minutes ?? 0, answered: r.answered, seconds: r.seconds };
            const next = [entry, ...readLog(desk.id)].slice(0, 100);
            try {
              localStorage.setItem(logKey(desk.id), JSON.stringify(next));
            } catch {
              // Kept on screen only.
            }
            setLog(next);
            setRing(null);
          }}
        />
      )}
    </>
  );
}
