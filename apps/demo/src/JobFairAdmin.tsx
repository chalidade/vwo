import { useState } from "react";
import { CafeScene, boothExtras, coinStandExtras, foodStallExtras, infoDeskExtras, lookFor, liftExtras, promoterExtras, psikotesExtras, seminarStageExtras, sponsorExtras } from "@vwo/ui";
import type { ApplicationStatus } from "./jobfair-engine";
import { staffLook } from "./JobFair";
import { COMPANY_TITLES, levelOf } from "./fair/content";
import { Stars } from "./fair/Modal";
import { fair, useFair } from "./useFair";

const EVENT_TEXT = {
  arrive: "datang",
  visit: "mampir ke stand",
  apply: "melamar",
  leave: "pulang",
  sponsor: "melihat sponsor",
  rate: "dinilai",
  review: "memberi rating",
  room: "masuk",
  coins: "membeli koin",
} as const;
const time = (at: number) => new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The organiser's view: the whole hall live, traffic per booth, and every application. */
export function JobFairAdmin() {
  useFair();
  const booths = fair.fair.booths;
  const [tab, setTab] = useState(0);
  const stop = fair.stops[tab] ?? fair.stops[0]!;
  const floor = fair.floor(stop.floorId);
  const level = fair.levelOf(floor.id);
  const room = fair.roomOf(floor.id);
  const visitors = [...fair.visitors.values()];
  const decide = (id: string, status: ApplicationStatus) => fair.setStatus(id, status);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{fair.fair.name} · Live</h1>
        <button
          type="button"
          className="small-btn ghost"
          onClick={() => {
            if (confirm("Hapus semua data demo job fair (lamaran, kunjungan, sponsor) di browser ini?")) fair.reset();
          }}
        >
          Hapus data demo
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Data demo tersimpan di localStorage browser ini, jadi tetap ada setelah halaman dimuat ulang.</p>
      <div className="row">
        <div className="card">
          <div className="muted">Pengunjung di aula</div>
          <div className="stat">{fair.visitors.size}</div>
        </div>
        <div className="card">
          <div className="muted">Kunjungan ke stand</div>
          <div className="stat">{[...fair.visits.values()].reduce((a, b) => a + b, 0)}</div>
        </div>
        <div className="card">
          <div className="muted">Lamaran masuk</div>
          <div className="stat">{fair.applications.length}</div>
        </div>
      </div>
      <div className="floor-tabs" role="tablist">
        {fair.stops.map((st, i) => (
          <button key={st.floorId} type="button" role="tab" aria-selected={i === tab} data-active={i === tab ? "" : undefined} onClick={() => setTab(i)}>
            {st.name} · {st.emoji} {st.label} <span className="muted">({visitors.filter((v) => v.floorId === st.floorId).length} orang)</span>
          </button>
        ))}
      </div>
      <div className="layout2">
        <CafeScene
          className="admin-scene"
          floor={floor}
          floorName={(id) => fair.stopOf(id).name}
          hallTitle={room ? undefined : fair.fair.name}
          hallBanner={!room}
          occupiedSeatIds={fair.occupiedSeats()}
          avatars={[...fair.visitors.values()]}
          lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
          npcs={fair.staff.map((s) => ({ id: s.id, name: s.name, floorId: s.floorId, x: s.x, y: s.y, facing: s.facing, look: staffLook(s.name, (s.boothId && fair.booth(s.boothId)?.color) || fair.fair.promoters.find((p) => s.id.endsWith(p.id))?.color || "#1e3a8a") }))}
          bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
          extras={[
            ...liftExtras(stop.name, fair.stops),
            ...fair.fair.promoters.filter((p) => p.level === stop.level).flatMap((p) => promoterExtras(p)),
            ...(room
              ? room.kind === "foodcourt"
                ? foodStallExtras(room)
                : room.kind === "psikotes"
                  ? psikotesExtras(room)
                  : seminarStageExtras(room, null)
              : [
                  ...booths.filter((b) => b.floor === level).flatMap((b) => boothExtras(b, { rating: { ...fair.companyRating(b.id), level: levelOf(fair.companyXp(b.id)).level } })),
                  ...(level === 0 ? infoDeskExtras(fair.fair.infoDesk) : []),
                  ...fair.fair.sponsors.filter((sp) => sp.floor === level).map((sp) => sponsorExtras(sp)),
                  ...(fair.fair.coinStand.floor === level ? coinStandExtras(fair.fair.coinStand) : []),
                ]),
          ]}
          hallSponsors={fair.fair.sponsors}
        />
        <div className="card" style={{ maxHeight: 520, overflow: "auto" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Riwayat</h2>
          <table className="list">
            <tbody>
              {fair.events.slice(0, 40).map((e, i) => (
                <tr key={i}>
                  <td className="muted">{time(e.at)}</td>
                  <td>
                    {e.name} {EVENT_TEXT[e.type]} {e.type === "apply" ? `${e.jobTitle} · ${e.company}` : e.type === "rate" ? `oleh ${e.company} ${e.jobTitle}` : e.type === "review" ? `${e.company} ${e.jobTitle}` : (e.company ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Stand perusahaan</h2>
        <table className="list">
          <thead>
            <tr>
              <th>Perusahaan</th>
              <th>Lantai</th>
              <th>Recruiter</th>
              <th>Di stand sekarang</th>
              <th>Kunjungan</th>
              <th>Lamaran</th>
              <th>Rating</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {[...booths].sort((a, b) => a.floor - b.floor).map((b) => (
              <tr key={b.id}>
                <td>
                  <span className="dot" style={{ background: b.color }} /> {b.company} {b.tier === "premium" && <span title="Stand VIP">👑</span>}
                </td>
                <td>{fair.fair.floors[b.floor]?.name}</td>
                <td>{b.recruiter}</td>
                <td>{fair.peopleAt(b.id)}</td>
                <td>{fair.visits.get(b.id) ?? 0}</td>
                <td>{fair.applications.filter((a) => a.boothId === b.id).length}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Stars value={fair.companyRating(b.id).average} count={fair.companyRating(b.id).count} />
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {(() => {
                    const lv = levelOf(fair.companyXp(b.id)).level;
                    return `Lv ${lv} · ${COMPANY_TITLES[lv - 1]}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Sponsor</h2>
        <table className="list">
          <thead>
            <tr>
              <th>Sponsor</th>
              <th>Paket</th>
              <th>Dilihat</th>
              <th>Website</th>
            </tr>
          </thead>
          <tbody>
            {fair.fair.sponsors.map((sp) => (
              <tr key={sp.id}>
                <td>
                  <span className="dot" style={{ background: sp.color }} /> {sp.name}
                </td>
                <td>{sp.tier}</td>
                <td>{fair.sponsorViews.get(sp.id) ?? 0}</td>
                <td className="muted small">{sp.website.replace(/^https?:\/\//, "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Media iklan</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Slot berbayar: NPC promotor (dilihat = pengunjung mendengar promonya, klik = buka situs atau simpan kode) dan tenant food court (voucher terjual).
        </p>
        <table className="list">
          <thead>
            <tr>
              <th>Pengiklan</th>
              <th>Slot</th>
              <th>Dilihat</th>
              <th>Klik</th>
              <th>Voucher terjual</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...fair.fair.promoters.map((p) => ({ key: `promo:${p.id}`, name: `${p.emoji} ${p.brand}`, color: p.color, slot: `NPC promotor · ${fair.stops.find((st) => st.level === p.level)?.name ?? ""}` })),
              ...fair.fair.rooms.flatMap((r) => r.stalls ?? []).map((st) => ({ key: `stall:${st.id}`, name: `${st.emoji} ${st.name}`, color: st.color, slot: "Tenant food court" })),
            ].map((row) => {
              const a = fair.ads.get(row.key);
              return (
                <tr key={row.key}>
                  <td>
                    <span className="dot" style={{ background: row.color }} /> {row.name}
                  </td>
                  <td className="muted small">{row.slot}</td>
                  <td>{a?.views ?? 0}</td>
                  <td>
                    {a?.clicks ?? 0}
                    {a?.views ? <span className="muted small"> ({Math.round(((a.clicks ?? 0) / a.views) * 100)}%)</span> : null}
                  </td>
                  <td>{row.key.startsWith("stall:") ? `${a?.sold ?? 0} · ${a?.coins ?? 0} 🪙` : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Lamaran masuk</h2>
        {fair.applications.length === 0 && <p className="muted">Belum ada lamaran.</p>}
        <div style={{ overflowX: "auto" }}>
          <table className="list">
            <tbody>
              {fair.applications.slice(0, 30).map((a) => (
                <tr key={a.id}>
                  <td className="muted">{time(a.at)}</td>
                  <td>
                    {a.name}{a.verified && <span className="rpg-check" title="Verified">✔</span>} {a.isBot && <span className="muted">· bot</span>}
                    {a.email && (
                      <>
                        <br />
                        <span className="muted small">{a.email}</span>
                      </>
                    )}
                  </td>
                  <td>
                    {a.jobTitle}
                    <br />
                    <span className="muted small">{a.company}</span>
                  </td>
                  <td>
                    <span className="status" data-status={a.status}>
                      {a.status}
                    </span>
                    {a.psych != null && (
                      <>
                        <br />
                        <span className="muted small">🧠 Psikotes {a.psych}</span>
                      </>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="rate-pick" title="Nilai pelamar">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" data-on={(a.rating ?? 0) >= n ? "" : undefined} onClick={() => fair.rateApplicant(a.id, n)} aria-label={`${n} bintang`}>
                          ★
                        </button>
                      ))}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="small-btn" onClick={() => decide(a.id, "Diundang interview")} disabled={a.status === "Diundang interview"}>
                      Undang interview
                    </button>{" "}
                    <button type="button" className="small-btn ghost" onClick={() => decide(a.id, "Belum cocok")} disabled={a.status === "Belum cocok"}>
                      Belum cocok
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
