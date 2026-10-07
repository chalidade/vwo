import { CafeScene, boothExtras, infoDeskExtras, lookFor } from "@vwo/ui";
import type { ApplicationStatus } from "./jobfair-engine";
import { staffLook } from "./JobFair";
import { fair, useFair } from "./useFair";

const EVENT_TEXT = { arrive: "datang", visit: "mampir ke stand", apply: "melamar", leave: "pulang" } as const;
const time = (at: number) => new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The organiser's view: the whole hall live, traffic per booth, and every application. */
export function JobFairAdmin() {
  useFair();
  const booths = fair.fair.booths;
  const decide = (id: string, status: ApplicationStatus) => fair.setStatus(id, status);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>{fair.fair.name} · Live</h1>
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
      <div className="layout2">
        <CafeScene
          className="admin-scene"
          floor={fair.floor}
          occupiedSeatIds={new Set()}
          avatars={[...fair.visitors.values()]}
          lookOf={(a) => lookFor(`${a.displayName}:${a.memberId}`)}
          npcs={fair.staff.map((s) => ({ id: s.id, name: s.name, floorId: fair.floor.id, x: s.x, y: s.y, facing: s.facing, look: staffLook(s.name, (s.boothId && fair.booth(s.boothId)?.color) || "#1e3a8a") }))}
          bubbles={Object.fromEntries([...fair.bubbles].map(([id, b]) => [id, b.text]))}
          extras={[...booths.flatMap((b) => boothExtras(b)), ...infoDeskExtras(fair.fair.infoDesk)]}
        />
        <div className="card" style={{ maxHeight: 520, overflow: "auto" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Riwayat</h2>
          <table className="list">
            <tbody>
              {fair.events.slice(0, 40).map((e, i) => (
                <tr key={i}>
                  <td className="muted">{time(e.at)}</td>
                  <td>
                    {e.name} {EVENT_TEXT[e.type]} {e.type === "apply" ? `${e.jobTitle} · ${e.company}` : (e.company ?? "")}
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
              <th>Recruiter</th>
              <th>Di stand sekarang</th>
              <th>Kunjungan</th>
              <th>Lamaran</th>
            </tr>
          </thead>
          <tbody>
            {booths.map((b) => (
              <tr key={b.id}>
                <td>
                  <span className="dot" style={{ background: b.color }} /> {b.company}
                </td>
                <td>{b.recruiter}</td>
                <td>{fair.peopleAt(b.id)}</td>
                <td>{fair.visits.get(b.id) ?? 0}</td>
                <td>{fair.applications.filter((a) => a.boothId === b.id).length}</td>
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
