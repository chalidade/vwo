import { useState } from "react";
import { fairFloorIndex } from "@vwo/shared";
import { fair, useFair } from "../useFair";

/** The organiser builds the venue: add or take out booth floors, switch rooms off, and set which
 *  floors are free and which cost coins to enter. */
export function OrgFloors({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const [theme, setTheme] = useState("");
  const stops = fair.stops;
  const entrance = stops[0]?.floorId;
  const topHall = fair.fair.floors.length - 1;
  const blocker = fair.removeHallBlocker();
  const hidden = fair.hiddenRooms();

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Lantai gedung</h2>
        <p className="muted small">
          Urutan dari atas ke bawah seperti tombol lift. Lantai booth berisi 6 tempat stand yang bisa dipesan perusahaan. Isi harga 0 untuk lantai gratis, atau jumlah koin untuk lantai berbayar. Lantai {stops[0]?.level != null ? stops[0].level + 1 : 1} tempat pengunjung datang selalu gratis.
        </p>
        <div className="fl-list">
          {[...stops].reverse().map((st) => {
            const hall = st.roomId ? -1 : fairFloorIndex(st.floorId);
            const booths = hall >= 0 ? fair.fair.booths.filter((b) => b.floor === hall).length : 0;
            const price = fair.floorPrice(st.floorId);
            return (
              <div key={st.floorId} className="fl-row">
                <b className="fl-n">{st.level + 1}</b>
                <div className="fl-main">
                  {hall >= 0 ? (
                    <input
                      aria-label={`Nama ${st.name}`}
                      defaultValue={st.label}
                      maxLength={40}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value.trim() !== st.label) {
                          fair.renameHall(hall, e.target.value);
                          onToast(`${st.name} diganti jadi ${e.target.value.trim()}`);
                        }
                      }}
                    />
                  ) : (
                    <span className="fl-label">
                      {st.emoji} {st.label}
                    </span>
                  )}
                  <span className="muted small">{hall >= 0 ? `Lantai booth · ${booths}/6 stand terisi` : "Ruangan"}</span>
                </div>
                <label className="fl-price">
                  {st.floorId === entrance ? (
                    <span className="fl-tag">Pintu masuk · gratis</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        aria-label={`Harga masuk ${st.name}`}
                        defaultValue={price}
                        key={`${st.floorId}-${price}`}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (n === price) return;
                          fair.setFloorPrice(st.floorId, n);
                          onToast(fair.floorPrice(st.floorId) ? `${st.name} jadi berbayar: ${fair.floorPrice(st.floorId)} koin` : `${st.name} jadi gratis`);
                        }}
                      />
                      <span className="fl-tag" data-paid={price ? "" : undefined}>
                        {price ? "koin" : "Gratis"}
                      </span>
                    </>
                  )}
                </label>
                <div className="fl-act">
                  {st.roomId ? (
                    st.floorId !== entrance && (
                      <button
                        type="button"
                        className="small-btn ghost"
                        onClick={() => {
                          fair.setRoomHidden(st.roomId!, true);
                          onToast(`${st.label} dinonaktifkan`);
                        }}
                      >
                        Nonaktifkan
                      </button>
                    )
                  ) : (
                    hall === topHall && (
                      <button
                        type="button"
                        className="small-btn ghost"
                        disabled={!!blocker}
                        title={blocker ?? undefined}
                        onClick={() => {
                          if (fair.removeHall()) onToast(`${st.name} dihapus`);
                        }}
                      >
                        Hapus lantai
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {blocker && fair.fair.floors.length > 1 && <p className="muted small">Hapus lantai booth teratas: {blocker}</p>}
      </div>

      <div className="card">
        <h2 className="cp-h2">Tambah lantai booth</h2>
        <p className="muted small">Lantai baru muncul di atas lantai booth teratas, lengkap dengan meja informasi dan 6 tempat stand kosong. Ruangan di atasnya ikut naik satu lantai.</p>
        <form
          className="org-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (fair.addHall(theme)) {
              onToast(`Lantai booth baru ditambahkan: ${theme.trim() || "Lantai baru"}`);
              setTheme("");
            } else onToast("Maksimal 8 lantai booth");
          }}
        >
          <input value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={40} placeholder="Tema lantai, misal Startup & UMKM" />
          <button type="submit" className="small-btn">
            Tambah lantai
          </button>
        </form>
      </div>

      {hidden.length > 0 && (
        <div className="card">
          <h2 className="cp-h2">Ruangan nonaktif</h2>
          <div className="fl-list">
            {hidden.map((r) => (
              <div key={r.id} className="fl-row">
                <span className="fl-label">
                  {r.emoji} {r.name}
                </span>
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    fair.setRoomHidden(r.id, false);
                    onToast(`${r.name} aktif lagi`);
                  }}
                >
                  Aktifkan lagi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
