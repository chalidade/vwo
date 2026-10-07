import { useState } from "react";
import { CafeScene } from "@vwo/ui";
import { WAITER_LOOK } from "./staff";
import { useCafe } from "./useCafe";

const ORDER_STATUS = { new: "Dibuat", ready: "Siap diantar", delivering: "Diantar", served: "Sudah di meja", cancelled: "Batal" } as const;

const EVENT_TEXT = {
  check_in: "datang",
  seat_claim: "duduk di",
  seat_release: "berdiri dari",
  floor_change: "pindah ke",
  check_out: "keluar",
} as const;

export function AdminLive() {
  const cafe = useCafe();
  const [floorId, setFloorId] = useState(cafe.floors[0]!.id);
  const floor = cafe.floors.find((f) => f.id === floorId)!;
  const counts = cafe.snapshot();
  const occupied = new Set(cafe.seatOwner.keys());

  const groups = new Map<string, typeof members>();
  const members = [...cafe.members.values()].sort((a, b) => a.checkedInAt - b.checkedInAt);
  for (const m of members) groups.set(m.visitId, [...(groups.get(m.visitId) ?? []), m]);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Cafe A · Live</h1>
      <div className="row">
        <div className="card">
          <div className="muted">Orang di dalam</div>
          <div className="stat">{counts.peopleInside}</div>
        </div>
        <div className="card">
          <div className="muted">Rombongan</div>
          <div className="stat">{counts.groupsInside}</div>
        </div>
        <div className="card">
          <div className="muted">Kursi kosong</div>
          <div className="stat">
            {counts.seatsFree} / {counts.seatsTotal}
          </div>
        </div>
      </div>
      <div className="row">
        {cafe.floors.map((f) => (
          <button key={f.id} className={f.id === floor.id ? "" : "ghost"} onClick={() => setFloorId(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="layout2">
        <CafeScene
          className="admin-scene"
          floor={floor}
          floorName={(id) => cafe.floor(id).name}
          occupiedSeatIds={occupied}
          avatars={members}
          npcs={cafe.staff.map((w) => ({ ...w, look: WAITER_LOOK }))}
          bubbles={Object.fromEntries([...cafe.bubbles].map(([id, b]) => [id, b.text]))}
          servedSeatIds={cafe.served}
          showFreeSeats
        />
        <div className="card" style={{ maxHeight: 520, overflow: "auto" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Riwayat</h2>
          <table className="list">
            <tbody>
              {cafe.events.slice(0, 40).map((e, i) => (
                <tr key={i}>
                  <td className="muted">{new Date(e.at).toLocaleTimeString("id-ID")}</td>
                  <td>
                    {e.name} {EVENT_TEXT[e.type]} {e.seatLabel ?? e.floorName ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Pesanan di kasir</h2>
        {cafe.orders.length === 0 && <p className="muted">Belum ada pesanan.</p>}
        <table className="list">
          <tbody>
            {cafe.orders.slice(0, 12).map((o) => (
              <tr key={o.id}>
                <td className="muted">{new Date(o.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>{o.name}</td>
                <td>Meja {o.tableLabel}</td>
                <td>{o.items.join(", ")}</td>
                <td>{ORDER_STATUS[o.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Siapa di dalam</h2>
        {members.length === 0 && <p className="muted">Belum ada pelanggan.</p>}
        <table className="list">
          <tbody>
            {[...groups.values()].flatMap((g) =>
              g.map((m, i) => (
                <tr key={m.memberId}>
                  <td>{i === 0 ? "●" : "└"}</td>
                  <td>
                    {m.displayName} {m.memberType === "companion" && <span className="muted">(NPC)</span>}{" "}
                    {m.isBot && <span className="muted">· bot</span>}
                  </td>
                  <td>{m.seatId ? cafe.seat(m.seatId)?.seat.label : <span className="muted">belum duduk · {cafe.floor(m.floorId).name}</span>}</td>
                  <td className="muted">{new Date(m.checkedInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
