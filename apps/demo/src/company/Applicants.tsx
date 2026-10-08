import { useEffect, useMemo, useRef, useState } from "react";
import { type CompanyBooth, safeUrl } from "@vwo/shared";
import { lookFor } from "@vwo/ui";
import { type ApplicationStatus, type FairApplication, PLAYER_ID } from "../jobfair-engine";
import { CallScreen, type CallResult } from "../fair/Call";
import { type CallKind, type RingSignal, canCallOtherTabs } from "../fair/call";
import { INTERVIEW_MODES, PIPELINE, applicantsCsv, matchScore } from "../fair/company";
import { fair } from "../useFair";

const when = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const waNumber = (phone: string) => phone.replace(/\D/g, "").replace(/^0/, "62");

type Sort = "new" | "match" | "psych" | "rating";

/** Review applications: filter, read, rate, move through the pipeline, chat, call and invite to interview. */
export function Applicants({ booth, focusId }: { booth: CompanyBooth; focusId?: string }) {
  const apps = fair.applications.filter((a) => a.boothId === booth.id);
  const [job, setJob] = useState("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [openId, setOpenId] = useState<string | null>(focusId ?? null);
  const jobOf = (a: FairApplication) => booth.jobs.find((j) => j.id === a.jobId);
  const score = (a: FairApplication) => matchScore(a, jobOf(a));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = apps.filter(
      (a) =>
        (job === "all" || a.jobId === job) &&
        (status === "all" || a.status === status) &&
        (!term || [a.name, a.email, a.skills, a.headline, a.jobTitle].some((s) => s?.toLowerCase().includes(term))),
    );
    const key: Record<Sort, (a: FairApplication) => number> = {
      new: (a) => a.at,
      match: score,
      psych: (a) => a.psych ?? -1,
      rating: (a) => a.rating ?? 0,
    };
    return out.sort((x, y) => key[sort](y) - key[sort](x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps.length, job, status, q, sort, fair.applications.map((a) => a.updatedAt).join()]);

  const open = openId ? apps.find((a) => a.id === openId) : undefined;

  const exportCsv = () => {
    const csv = applicantsCsv(booth, list, (i) => score(list[i]!));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pelamar-${booth.id}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="cp-apps" data-open={open ? "" : undefined}>
      <div className="card cp-apps-list">
        <div className="cp-filters">
          <input type="search" placeholder="Cari nama, keahlian..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pelamar" />
          <select value={job} onChange={(e) => setJob(e.target.value)} aria-label="Lowongan">
            <option value="all">Semua lowongan</option>
            {booth.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="all">Semua status</option>
            {PIPELINE.map((s) => (
              <option key={s} value={s}>
                {s} ({apps.filter((a) => a.status === s).length})
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan">
            <option value="new">Terbaru</option>
            <option value="match">Paling cocok</option>
            <option value="psych">Nilai psikotes</option>
            <option value="rating">Rating tertinggi</option>
          </select>
          <button type="button" className="small-btn ghost" onClick={exportCsv} disabled={!list.length}>
            ⬇ CSV
          </button>
        </div>
        {list.length === 0 ? (
          <p className="muted">{apps.length ? "Tidak ada pelamar yang cocok dengan filter." : "Belum ada pelamar. Pengunjung yang melamar di stand kamu akan muncul di sini."}</p>
        ) : (
          <ul className="cp-app-list">
            {list.map((a) => {
              const m = score(a);
              const last = a.messages?.[a.messages.length - 1];
              return (
                <li key={a.id}>
                  <button type="button" className="cp-app-row" data-active={a.id === openId ? "" : undefined} onClick={() => setOpenId(a.id)}>
                    <span className="cp-match" data-level={m >= 75 ? "hi" : m >= 55 ? "mid" : "lo"}>{m}%</span>
                    <span className="cp-app-main">
                      <b>
                        {a.name}
                        {a.verified && <span className="rpg-check">✔</span>}
                        {a.visitorId === PLAYER_ID && <span className="cp-you">kamu</span>}
                        {last?.from === "seeker" && <span className="cp-new">💬</span>}
                      </b>
                      <span className="muted small">
                        {a.jobTitle} · {when(a.at)}
                      </span>
                    </span>
                    <span className="status" data-status={a.status}>
                      {a.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {open ? <Detail key={open.id} booth={booth} app={open} match={score(open)} onBack={() => setOpenId(null)} /> : <div className="card cp-empty muted">Pilih pelamar untuk melihat detail.</div>}
    </div>
  );
}

function Detail({ booth, app: a, match, onBack }: { booth: CompanyBooth; app: FairApplication; match: number; onBack: () => void }) {
  const [call, setCall] = useState<{ kind: CallKind; ring?: RingSignal } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState(a.notes ?? "");
  const [feedback, setFeedback] = useState(a.feedback ?? "");
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(10, 0, 0, 0);
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [iv, setIv] = useState({ at: local(a.interview ? new Date(a.interview.at) : tomorrow), mode: a.interview?.mode ?? "Video call", place: a.interview?.place ?? "", note: a.interview?.note ?? "" });
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => chatEnd.current?.scrollIntoView({ block: "nearest" }), [a.messages?.length]);
  useEffect(() => {
    if (a.status === "Terkirim") fair.setStatus(a.id, "Dilihat");
  }, [a.id, a.status]);
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  };

  const reachable = a.isBot || (a.visitorId === PLAYER_ID && canCallOtherTabs());
  const startCall = (kind: CallKind) => {
    if (a.isBot) return setCall({ kind });
    setCall({
      kind,
      ring: {
        type: "ring",
        callId: `call-${Date.now().toString(36)}`,
        to: a.visitorId,
        appId: a.id,
        company: booth.company,
        logo: booth.logo,
        color: booth.color,
        recruiter: booth.recruiter,
        jobTitle: a.jobTitle,
        kind,
      },
    });
  };
  const endCall = (r: CallResult) => {
    fair.logCall(a.id, { at: Date.now(), kind: call!.kind, answered: r.answered, seconds: r.seconds });
    setCall(null);
    flash(r.answered ? `Panggilan selesai (${Math.floor(r.seconds / 60)}m ${r.seconds % 60}d)` : r.result === "declined" ? "Panggilan ditolak" : "Tidak diangkat. Pelamar akan melihat panggilan tak terjawab.");
  };

  const send = () => {
    fair.messageApplicant(a.id, msg);
    setMsg("");
  };

  return (
    <div className="card cp-detail">
      <button type="button" className="small-btn ghost cp-back" onClick={onBack}>
        ← Daftar pelamar
      </button>
      <div className="cp-detail-head">
        <div>
          <h2 className="cp-h2" style={{ margin: 0 }}>
            {a.name}
            {a.verified && <span className="rpg-check">✔</span>}
          </h2>
          <span className="muted small">
            {a.headline || (a.isBot ? "Pengunjung job fair" : "Pelamar")} · melamar <b>{a.jobTitle}</b> · {when(a.at)}
          </span>
        </div>
        <span className="cp-match cp-match-big" data-level={match >= 75 ? "hi" : match >= 55 ? "mid" : "lo"} title="Kecocokan dengan kualifikasi lowongan">
          {match}%<small>cocok</small>
        </span>
      </div>

      <div className="cp-call-row">
        <button type="button" onClick={() => startCall("video")} disabled={!reachable}>
          🎥 Video call
        </button>
        <button type="button" onClick={() => startCall("voice")} disabled={!reachable}>
          📞 Telepon
        </button>
        {a.phone && (
          <>
            <a className="small-btn ghost cp-link" href={`tel:${a.phone}`}>
              📱 {a.phone}
            </a>
            <a className="small-btn ghost cp-link" href={`https://wa.me/${waNumber(a.phone)}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </>
        )}
        {/^[^\s@?&#]+@[^\s@?&#]+$/.test(a.email) && (
          <a className="small-btn ghost cp-link" href={`mailto:${a.email}?subject=${encodeURIComponent(`Lamaran ${a.jobTitle} - ${booth.company}`)}`}>
            ✉️ Email
          </a>
        )}
      </div>
      {!reachable && <p className="muted small">Panggilan di aplikasi hanya ke pelamar yang sedang online. Pakai nomor HP atau WhatsApp di atas.</p>}
      {a.visitorId === PLAYER_ID && reachable && <p className="muted small">Pelamar ini kamu sendiri: buka job fair di tab lain browser ini untuk mengangkat panggilannya.</p>}

      <div className="cp-pipeline" role="group" aria-label="Status lamaran">
        {(["Shortlist", "Diundang interview", "Diterima", "Belum cocok"] as ApplicationStatus[]).map((s) => (
          <button key={s} type="button" className="small-btn" data-status={s} data-active={a.status === s ? "" : undefined} onClick={() => fair.setStatus(a.id, s)}>
            {s === "Shortlist" ? "⭐ Shortlist" : s === "Diundang interview" ? "📅 Interview" : s === "Diterima" ? "✅ Terima" : "✕ Belum cocok"}
          </button>
        ))}
      </div>

      <dl className="cp-facts">
        <dt>Email</dt>
        <dd>{a.email || "-"}</dd>
        <dt>No. HP</dt>
        <dd>{a.phone || "-"}</dd>
        {a.city && (
          <>
            <dt>Domisili</dt>
            <dd>{a.city}</dd>
          </>
        )}
        {a.education && (
          <>
            <dt>Pendidikan</dt>
            <dd>{a.education}</dd>
          </>
        )}
        <dt>Keahlian</dt>
        <dd>{a.skills || "-"}</dd>
        <dt>CV</dt>
        <dd>
          {a.cvUrl ? (
            <a href={safeUrl(a.cvUrl)} target="_blank" rel="noopener noreferrer">
              Buka CV ↗
            </a>
          ) : (
            "Tidak dilampirkan"
          )}
        </dd>
        <dt>Psikotes</dt>
        <dd>{a.psych != null ? `${a.psych}%` : "Belum ikut"}</dd>
      </dl>
      {a.message && <blockquote className="cp-quote">{a.message}</blockquote>}

      <h3 className="cp-h3">Penilaian</h3>
      <div className="row">
        <span className="rate-pick" title="Nilai pelamar">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" data-on={(a.rating ?? 0) >= n ? "" : undefined} onClick={() => fair.rateApplicant(a.id, n, feedback || undefined)} aria-label={`${n} bintang`}>
              ★
            </button>
          ))}
        </span>
        <input className="cp-grow" placeholder="Feedback untuk pelamar (terlihat oleh pelamar)" value={feedback} onChange={(e) => setFeedback(e.target.value)} onBlur={() => a.rating && fair.rateApplicant(a.id, a.rating, feedback || undefined)} />
      </div>

      <h3 className="cp-h3">Jadwalkan interview</h3>
      {a.interview && (
        <p className="cp-iv-reply" data-reply={a.interview.reply ?? "menunggu"}>
          {a.interview.reply === "hadir" ? "✅ Pelamar konfirmasi hadir" : a.interview.reply === "jadwal-ulang" ? "🕑 Pelamar minta jadwal ulang: kirim jadwal baru di bawah" : "⏳ Menunggu konfirmasi pelamar"} ·{" "}
          {new Date(a.interview.at).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      <form
        className="cp-form cp-iv"
        onSubmit={(e) => {
          e.preventDefault();
          fair.scheduleInterview(a.id, { at: new Date(iv.at).getTime(), mode: iv.mode, place: iv.place.trim() || undefined, note: iv.note.trim() || undefined });
          flash("Undangan interview terkirim ke pelamar");
        }}
      >
        <label>
          Waktu
          <input type="datetime-local" required value={iv.at} onChange={(e) => setIv({ ...iv, at: e.target.value })} />
        </label>
        <label>
          Cara
          <select value={iv.mode} onChange={(e) => setIv({ ...iv, mode: e.target.value })}>
            {INTERVIEW_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Tempat / link
          <input value={iv.place} onChange={(e) => setIv({ ...iv, place: e.target.value })} placeholder={iv.mode === "Di stand" ? booth.company : "Lewat aplikasi ini"} />
        </label>
        <label className="cp-span">
          Pesan tambahan
          <input value={iv.note} onChange={(e) => setIv({ ...iv, note: e.target.value })} placeholder="Siapkan portofolio ya" />
        </label>
        <button type="submit">{a.interview ? "Ubah jadwal" : "Kirim undangan"}</button>
      </form>

      <h3 className="cp-h3">Chat dengan pelamar</h3>
      <div className="cp-chat">
        {(a.messages ?? []).length === 0 && <p className="muted small">Belum ada pesan.</p>}
        {(a.messages ?? []).map((m, i) => (
          <div key={i} className="cp-bubble" data-me={m.from === "company" ? "" : undefined}>
            {m.text}
            <span>{when(m.at)}</span>
          </div>
        ))}
        <div ref={chatEnd} />
      </div>
      <form
        className="row cp-send"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input className="cp-grow" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Pesan untuk ${a.name}`} maxLength={600} />
        <button type="submit" disabled={!msg.trim()}>
          Kirim
        </button>
      </form>

      <h3 className="cp-h3">Catatan internal</h3>
      <textarea className="cp-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => fair.noteApplicant(a.id, notes)} placeholder="Hanya tim kamu yang bisa membaca catatan ini" />

      {(a.calls ?? []).length > 0 && (
        <>
          <h3 className="cp-h3">Riwayat panggilan</h3>
          <ul className="cp-ul">
            {a.calls!.map((c, i) => (
              <li key={i}>
                {c.kind === "video" ? "🎥" : "📞"} {when(c.at)} · {c.answered ? `${Math.floor(c.seconds / 60)}m ${c.seconds % 60}d` : "tidak tersambung"}
              </li>
            ))}
          </ul>
        </>
      )}
      {toast && <div className="cp-toast">{toast}</div>}
      {call && (
        <CallScreen
          kind={call.kind}
          peerName={a.name}
          peerSub={`Pelamar ${a.jobTitle}`}
          peerLook={lookFor(`${a.name}:${a.visitorId}`)}
          peerColor={booth.color}
          bot={a.isBot}
          outgoing={call.ring}
          onEnd={endCall}
        />
      )}
    </div>
  );
}
