import { useState } from "react";
import type { ApplicationStatus } from "../jobfair-engine";
import { FloorScene } from "../fair/FloorScene";
import { COMPANY_TITLES, levelOf } from "../fair/content";
import { Stars } from "../fair/Modal";
import { fair } from "../useFair";

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

/** The organiser's live view: the whole hall, traffic per booth, ads and every application. */
export function OrgLive() {
  const booths = fair.fair.booths;
  const [tab, setTab] = useState(0);
  const stop = fair.stops[tab] ?? fair.stops[0]!;
  const visitors = [...fair.visitors.values()];
  const decide = (id: string, status: ApplicationStatus) => fair.setStatus(id, status);

  return (
    <div className="org">
      <div className="cp-kpis">
        {[
          ["Pengunjung di aula", fair.visitors.size],
          ["Kunjungan ke stand", [...fair.visits.values()].reduce((a, b) => a + b, 0)],
          ["Lamaran masuk", fair.applications.length],
          ["Stand aktif", booths.length],
        ].map(([label, n]) => (
          <div key={label} className="card cp-kpi">
            <span className="muted small">{label}</span>
            <span className="stat">{n}</span>
          </div>
        ))}
      </div>
      <div className="floor-tabs" role="tablist">
        {fair.stops.map((st, i) => (
          <button key={st.floorId} type="button" role="tab" aria-selected={i === tab} data-active={i === tab ? "" : undefined} onClick={() => setTab(i)}>
            {st.name} · {st.emoji} {st.label} <span className="muted">({visitors.filter((v) => v.floorId === st.floorId).length} orang)</span>
          </button>
        ))}
      </div>
      <div className="layout2">
        <FloorScene className="admin-scene" floorId={stop.floorId} />
        <div className="card org-log">
          <h2 className="cp-h2">Riwayat</h2>
          <div className="org-scroll">
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
      </div>
      <div className="card">
        <h2 className="cp-h2">Stand perusahaan</h2>
        <div className="org-scroll">
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
      </div>
      <div className="card">
        <h2 className="cp-h2">Lamaran masuk</h2>
        {fair.applications.length === 0 && <p className="muted">Belum ada lamaran.</p>}
        <div>
          <div className="org-scroll">
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
      </div>
    </div>
  );
}
