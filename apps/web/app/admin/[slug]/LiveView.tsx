"use client";
import { useEffect, useMemo, useState } from "react";
import { CafeScene } from "@vwo/ui";
import type { LiveSnapshot, VenueLayout } from "@/lib/types";

/** Staff view of who is inside, per floor. Polls the live endpoint; realtime push comes later. */
export function LiveView({ slug, floors }: { slug: string; floors: VenueLayout }) {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [floorId, setFloorId] = useState(floors[0]?.id);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch(`/api/venues/${slug}/live`, { cache: "no-store" });
      if (alive && res.ok) setLive(await res.json());
    };
    void load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug]);

  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  const occupied = useMemo(() => new Set(live?.occupiedSeatIds ?? []), [live]);
  const groups = useMemo(() => {
    const byVisit = new Map<string, LiveSnapshot["members"]>();
    for (const m of live?.members ?? []) byVisit.set(m.visitId, [...(byVisit.get(m.visitId) ?? []), m]);
    return [...byVisit.values()];
  }, [live]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="row">
        <div className="card">
          <div className="muted">Orang di dalam</div>
          <div className="stat">{live?.peopleInside ?? "-"}</div>
        </div>
        <div className="card">
          <div className="muted">Rombongan</div>
          <div className="stat">{live?.groupsInside ?? "-"}</div>
        </div>
        <div className="card">
          <div className="muted">Kursi kosong</div>
          <div className="stat">
            {live ? `${live.seatsFree} / ${live.seatsTotal}` : "-"}
          </div>
        </div>
      </div>
      <div className="row">
        {floors.map((f) => (
          <button key={f.id} className={f.id === floor?.id ? "" : "ghost"} onClick={() => setFloorId(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
      {floor && <CafeScene floor={floor} floorName={(id) => floors.find((f) => f.id === id)?.name ?? ""} occupiedSeatIds={occupied} showFreeSeats style={{ height: 520, borderRadius: 12 }} />}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Siapa di dalam</h2>
        {groups.length === 0 && <p className="muted">Belum ada pelanggan.</p>}
        <table className="list">
          <tbody>
            {groups.flatMap((g) =>
              g.map((m, i) => (
                <tr key={m.memberId}>
                  <td>{i === 0 ? "●" : "└"}</td>
                  <td>
                    {m.displayName} {m.memberType === "companion" && <span className="muted">(NPC)</span>}
                  </td>
                  <td>{m.seatLabel ?? <span className="muted">belum duduk</span>}</td>
                  <td className="muted">{new Date(m.checkedInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
