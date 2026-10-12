import { Armchair, Bot, Check, ExternalLink, Power, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CONSULT_DESKS, type ConsultRequest, deskName } from "@vwo/shared";
import { type OrgConsult, loadOrg, onConsultChange, orgAction } from "../consult";
import { LIVE } from "../mode";

const STATUS: Record<ConsultRequest["status"], string> = { pending: "Menunggu", approved: "Diterima", rejected: "Ditolak", removed: "Dilepas" };
const when = (t: number) => new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The consultation lounge's desks: who sits where (real consultants and the demo's bots), the
 * applications to approve onto a free desk, and taking someone off a desk.
 */
export function OrgConsultants({ onToast }: { onToast: (t: string) => void }) {
  const [data, setData] = useState<OrgConsult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => void loadOrg().then((r) => (r.ok ? (setData(r.data), setError("")) : setError(r.error)));
  useEffect(() => {
    load();
    const off = onConsultChange(load);
    // Open lamps change while the page is open.
    const t = setInterval(load, 30_000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);

  const act = async (a: Parameters<typeof orgAction>[0], done: string) => {
    setBusy(true);
    const r = await orgAction(a);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onToast(done);
    load();
  };

  if (!data)
    return (
      <div className="org">
        <div className="card">{error ? <p className="bk-err">{error}</p> : <p className="muted small">Memuat…</p>}</div>
      </div>
    );

  const pending = data.requests.filter((r) => r.status === "pending");
  const decided = data.requests.filter((r) => r.status !== "pending");
  const setBot = (id: string, on: boolean) => {
    const off = on ? data.botsOff.filter((x) => x !== id) : [...data.botsOff, id];
    void act({ action: "bots", off }, on ? "Konsultan demo dinyalakan" : "Konsultan demo dimatikan, mejanya kosong");
  };

  return (
    <div className="org ks-org">
      <div className="card">
        <h2 className="cp-h2">Meja konsultasi</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Lounge Konsultasi punya {CONSULT_DESKS} meja. Konsultan dapat meja lewat pendaftaran yang kamu setujui (gratis) atau dengan membeli slot di{" "}
          <a href="#/jobfair/konsultan">halaman konsultan</a>. Konsultan demo (bot) bisa dimatikan supaya mejanya kosong.
        </p>
        {error && <p className="bk-err">{error}</p>}
        <ul className="ks-desks">
          {Array.from({ length: CONSULT_DESKS }, (_, d) => {
            const c = data.consultants.find((x) => x.desk === d);
            const bot = data.bots.find((b) => b.desk === d && !data.botsOff.includes(b.id));
            return (
              <li key={d}>
                <span className="ks-desk-n">
                  <Armchair size={15} aria-hidden /> {deskName(d)}
                </span>
                {c ? (
                  <div className="ks-desk-who">
                    <b>{c.profile.name}</b>
                    <span className="muted small">
                      {c.profile.role}
                      {c.profile.org ? ` · ${c.profile.org}` : ""} · {c.via === "slot" ? "slot dibeli" : "disetujui panitia"} · sejak {when(c.at)}
                    </span>
                    <span className="muted small">
                      {c.email ?? "-"} · {c.phone ?? "-"}
                    </span>
                    <span className="ks-lamp" data-open={c.open ? "" : undefined}>
                      <Power size={12} aria-hidden /> {c.open ? "Meja buka" : "Meja tutup"}
                    </span>
                  </div>
                ) : bot ? (
                  <div className="ks-desk-who">
                    <b>{bot.name}</b>
                    <span className="muted small">
                      <Bot size={12} aria-hidden /> {bot.role} · konsultan demo (bot)
                    </span>
                  </div>
                ) : (
                  <div className="ks-desk-who">
                    <span className="muted small">Kosong</span>
                  </div>
                )}
                {c ? (
                  <button
                    type="button"
                    className="small-btn ghost"
                    disabled={busy}
                    onClick={() =>
                      confirm(`Lepas ${c.profile.name} dari ${deskName(d)}? Mejanya jadi kosong. Koin slot tidak dikembalikan otomatis.`) &&
                      void act({ action: "remove", id: c.id }, `${c.profile.name} dilepas dari ${deskName(d)}`)
                    }
                  >
                    <Trash2 size={14} aria-hidden /> Lepas
                  </button>
                ) : bot ? (
                  <button type="button" className="small-btn ghost" disabled={busy} onClick={() => setBot(bot.id, false)}>
                    <Power size={14} aria-hidden /> Matikan bot
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {data.botsOff.length > 0 && (
          <div className="ks-bots-off">
            <h3 className="cp-h3">Konsultan demo yang dimatikan</h3>
            <ul className="cp-jobs">
              {data.bots
                .filter((b) => data.botsOff.includes(b.id))
                .map((b) => {
                  const taken = data.consultants.some((c) => c.desk === b.desk);
                  return (
                    <li key={b.id}>
                      <span>
                        <Bot size={14} aria-hidden /> {b.name} · {deskName(b.desk)}
                        {taken && <span className="muted small"> · mejanya dipakai konsultan</span>}
                      </span>
                      <button type="button" className="small-btn ghost" disabled={busy || taken} onClick={() => setBot(b.id, true)}>
                        Nyalakan
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="cp-h2">Pendaftaran konsultan ({pending.length} menunggu)</h2>
        {!LIVE && <p className="muted small">Demo: pendaftaran tersimpan di browser ini. Daftar dari halaman konsultan di tab lain.</p>}
        {pending.length === 0 && <p className="muted small">Belum ada pendaftaran yang menunggu.</p>}
        <ul className="cp-jobs">
          {pending.map((r) => (
            <Pending key={r.userId} r={r} free={data.freeDesks} busy={busy} act={act} />
          ))}
        </ul>
        {decided.length > 0 && (
          <details className="ks-decided">
            <summary>Sudah diputuskan ({decided.length})</summary>
            <ul className="cp-jobs">
              {decided.map((r) => (
                <li key={r.userId}>
                  <span>
                    <b>{r.profile.name}</b> · {r.profile.role}
                    <span className="muted small">
                      {" "}
                      · {STATUS[r.status]}
                      {r.decidedAt ? ` ${when(r.decidedAt)}` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function Pending({ r, free, busy, act }: { r: ConsultRequest; free: number[]; busy: boolean; act: (a: Parameters<typeof orgAction>[0], done: string) => Promise<void> }) {
  const [desk, setDesk] = useState(free[0] ?? 0);
  const pick = free.includes(desk) ? desk : free[0];
  return (
    <li className="ks-req">
      <div className="ks-desk-who">
        <b>{r.profile.name}</b>
        <span className="muted small">
          {r.profile.role}
          {r.profile.org ? ` · ${r.profile.org}` : ""} · daftar {when(r.at)}
        </span>
        <span className="small">Topik: {r.profile.topics.join(", ")}</span>
        {r.profile.bio && <span className="small">{r.profile.bio}</span>}
        <span className="muted small">
          <a href={`mailto:${r.email}`}>
            {r.email} <ExternalLink size={11} aria-hidden />
          </a>{" "}
          · {r.phone}
        </span>
      </div>
      <div className="ks-req-actions">
        {pick !== undefined ? (
          <>
            <select value={pick} onChange={(e) => setDesk(Number(e.target.value))} aria-label="Meja">
              {free.map((d) => (
                <option key={d} value={d}>
                  {deskName(d)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="small-btn"
              disabled={busy}
              onClick={() => void act({ action: "approve", user: r.userId, desk: pick }, `${r.profile.name} dapat ${deskName(pick)}`)}
            >
              <Check size={14} aria-hidden /> Setujui
            </button>
          </>
        ) : (
          <span className="muted small">Tidak ada meja kosong. Lepas konsultan atau matikan bot dulu.</span>
        )}
        <button
          type="button"
          className="small-btn ghost"
          disabled={busy}
          onClick={() => {
            const note = prompt(`Alasan menolak ${r.profile.name} (dikirim lewat email):`, "Profil belum sesuai kebutuhan acara.");
            if (note && note.trim().length >= 3) void act({ action: "reject", user: r.userId, note: note.trim().slice(0, 300) }, `${r.profile.name} ditolak`);
          }}
        >
          <X size={14} aria-hidden /> Tolak
        </button>
      </div>
    </li>
  );
}
