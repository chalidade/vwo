import { useState } from "react";
import { CafeScene, boothExtras, coinStandExtras, foodStallExtras, infoDeskExtras, lookFor, psikotesExtras, roomDoorExtras, seminarStageExtras, sponsorExtras } from "@vwo/ui";
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
  const [level, setLevel] = useState(0);
  const floor = fair.floors[level] ?? fair.floors[0]!;
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
        {fair.floors.map((f, i) => (
          <button key={f.id} type="button" role="tab" aria-selected={i === level} data-active={i === level ? "" : undefined} onClick={() => setLevel(i)}>
            {fair.roomOf(f.id)?.emoji} {f.name} <span className="muted">({visitors.filter((v) => v.floorId === f.id).length} orang)</span>
          </button>
        ))}
      </div>
      <div className="layout2">
        <CafeScene
          className="admin-scene"
          floor={floor}
          floorName={(id) => fair.fair.floors[fair.floors.findIndex((f) => f.id === id)]?.name ?? "Tangga"}
          hallTitle={room ? undefined : fair.fair.name}
          hallBanner={!room}
          occupiedSeatIds={fair.occupiedSeats()}
          avatars={[...fair.visitors.values()]}
          lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
          npcs={fair.staff.map((s) => ({ id: s.id, name: s.name, floorId: s.floorId, x: s.x, y: s.y, facing: s.facing, look: staffLook(s.name, (s.boothId && fair.booth(s.boothId)?.color) || "#1e3a8a") }))}
          bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
          extras={
            room
              ? room.kind === "foodcourt"
                ? foodStallExtras(room)
                : room.kind === "psikotes"
                  ? psikotesExtras(room)
                  : seminarStageExtras(room, null)
              : [
                  ...booths.filter((b) => b.floor === level).flatMap((b) => boothExtras(b, { rating: { ...fair.companyRating(b.id), level: levelOf(fair.companyXp(b.id)).level } })),
                  ...(level === 0 ? infoDeskExtras(fair.fair.infoDesk) : []),
                  ...fair.fair.sponsors.filter((sp) => sp.floor === level).map((sp) => sponsorExtras(sp)),
                  ...fair.fair.rooms.filter((r) => r.floor === level).flatMap((r) => roomDoorExtras(r)),
                  ...(fair.fair.coinStand.floor === level ? coinStandExtras(fair.fair.coinStand) : []),
                ]
          }
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
                  <span className="dot" style={{ background: b.color }} /> {b.company}
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
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Lamaran masuk</h2>
        {fair.applications.length === 0 && <p className="muted">Belum ada lamaran.</p>}
        <div style={{ overflowX: "auto" }}>
          <table className="list">
            <tbody>
              {fair.applications.slice(0, 30).map((a) => (
                <tr key={a.id}>
                  <td className="muted">{time(a.at)}</td>
                  <td>
                    {a.name} {a.isBot && <span className="muted">· bot</span>}
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
