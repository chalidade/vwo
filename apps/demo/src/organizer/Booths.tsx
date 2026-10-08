import { useState } from "react";
import { BOOTH_SLOTS } from "../jobfair-engine";
import { sessionLogin } from "../company/login";
import { rupiah } from "../fair/company";
import { fair } from "../useFair";

const COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#eab308", "#f97316", "#dc2626", "#db2777", "#9333ea", "#334155"];
const SLOT_NAMES = ["Kiri atas", "Kiri bawah", "Tengah atas", "Tengah bawah", "Kanan atas", "Kanan bawah"];
const slotName = (x: number, y: number) => SLOT_NAMES[BOOTH_SLOTS.findIndex((s) => s.x === x && s.y === y)] ?? "";

type Slot = { floor: number; x: number; y: number };

/** The organiser adds companies to free booth places, takes them out, or brings them back. */
export function OrgBooths({ onToast }: { onToast: (t: string) => void }) {
  const [adding, setAdding] = useState<Slot | null>(null);
  const floors = fair.fair.floors;
  const removed = fair.removedBooths();
  const free = fair.freeSlots();

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">Denah stand</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Tiap lantai aula punya {BOOTH_SLOTS.length} tempat stand. Lepas stand untuk mengosongkan tempat: di peta muncul stand kosong yang bisa dibooking perusahaan sendiri, atau isi langsung di sini. {free.length} tempat kosong.
        </p>
        {floors.map((fl, floor) => (
          <section key={floor} className="org-floor">
            <h3 className="cp-h3">{fl.name}</h3>
            <div className="org-slots">
              {BOOTH_SLOTS.map((sl) => {
                const b = fair.fair.booths.find((x) => x.floor === floor && x.x === sl.x && x.y === sl.y);
                if (!b)
                  return (
                    <button key={`${sl.x}-${sl.y}`} type="button" className="org-slot org-slot-free" onClick={() => setAdding({ floor, ...sl })}>
                      <span className="org-plus">＋</span>
                      <span className="small">Tambah stand</span>
                      <span className="muted small">{slotName(sl.x, sl.y)}</span>
                    </button>
                  );
                const apps = fair.applications.filter((a) => a.boothId === b.id).length;
                return (
                  <div key={b.id} className="org-slot" style={{ ["--c" as string]: b.color }}>
                    <span className="cp-logo">{b.logo}</span>
                    <b className="org-slot-name">
                      {b.company} {b.tier === "premium" && "👑"}
                    </b>
                    <span className="muted small">
                      {slotName(sl.x, sl.y)} · {apps} pelamar · {fair.peopleAt(b.id)} di stand
                    </span>
                    <span className="small org-login">
                      🔑 <code>{b.id}</code> · PIN <code>{fair.companyPin(b.id)}</code>
                    </span>
                    <span className="org-slot-tools">
                      <a className="small-btn ghost" href={`#/jobfair/company/${b.id}`} onClick={() => sessionLogin(b.id)}>
                        Portal
                      </a>
                      <button
                        type="button"
                        className="small-btn ghost"
                        onClick={() => {
                          const pin = prompt(`PIN baru untuk ${b.company} (4–6 angka)`, fair.companyPin(b.id));
                          if (pin == null) return;
                          onToast(fair.setCompanyPin(b.id, pin.trim()) ? `PIN ${b.company} diganti` : "PIN harus 4–6 angka");
                        }}
                      >
                        PIN
                      </button>
                      <button
                        type="button"
                        className="small-btn ghost"
                        onClick={() => {
                          if (!confirm(`Lepas stand ${b.company}? ${apps ? `${apps} lamaran ke stand ini ikut terhapus.` : ""}`)) return;
                          fair.removeBooth(b.id);
                          onToast(`Stand ${b.company} dilepas`);
                        }}
                      >
                        Lepas
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {fair.bookings().length > 0 && (
        <div className="card">
          <h2 className="cp-h2">Booking dari peta</h2>
          <ul className="cp-jobs">
            {fair.bookings().map((bk) => (
              <li key={bk.id}>
                <span className="cp-job-main">
                  <b>
                    {bk.company} {bk.tier === "premium" && "👑"}
                  </b>
                  <span className="muted small">
                    {bk.contact} · {bk.email} · {rupiah(bk.price)} lunas via {bk.method} · {new Date(bk.at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {removed.length > 0 && (
        <div className="card">
          <h2 className="cp-h2">Stand yang dilepas</h2>
          <ul className="cp-jobs">
            {removed.map((b) => {
              const taken = fair.fair.booths.some((x) => x.floor === b.floor && x.x === b.x && x.y === b.y);
              return (
                <li key={b.id}>
                  <span className="cp-job-main">
                    <b>{b.company}</b>
                    <span className="muted small">
                      {floors[b.floor]?.name} · {slotName(b.x, b.y)} {taken && "· tempatnya sudah terisi"}
                    </span>
                  </span>
                  <button type="button" className="small-btn" disabled={taken} onClick={() => fair.restoreBooth(b.id) && onToast(`Stand ${b.company} kembali`)}>
                    Pasang lagi
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {adding && (
        <AddBooth
          slot={adding}
          onClose={() => setAdding(null)}
          onDone={(name) => {
            setAdding(null);
            onToast(`Stand ${name} ditambahkan`);
          }}
        />
      )}
    </div>
  );
}

function AddBooth({ slot, onClose, onDone }: { slot: Slot; onClose: () => void; onDone: (name: string) => void }) {
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [tagline, setTagline] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [logo, setLogo] = useState("");
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]!);
  const [vip, setVip] = useState(false);
  return (
    <div className="cp-modal" onClick={onClose}>
      <form
        className="card cp-form org-add"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const b = fair.addBooth({ company, industry, tagline, recruiter, logo, color, tier: vip ? "premium" : "regular", ...slot });
          if (b) onDone(b.company);
        }}
      >
        <h2 className="cp-h2 cp-span">
          Stand baru · {fair.fair.floors[slot.floor]?.name}, {slotName(slot.x, slot.y)}
        </h2>
        <label>
          Nama perusahaan
          <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={40} placeholder="PT Contoh Maju" autoFocus />
        </label>
        <label>
          Industri
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={30} placeholder="Teknologi" />
        </label>
        <label className="cp-span">
          Tagline
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} />
        </label>
        <label>
          Nama recruiter
          <input value={recruiter} onChange={(e) => setRecruiter(e.target.value)} maxLength={30} />
        </label>
        <label>
          Logo (2 huruf)
          <input value={logo} onChange={(e) => setLogo(e.target.value)} maxLength={2} placeholder="CM" />
        </label>
        <div className="cp-span">
          <span className="muted small">Warna</span>
          <div className="cp-colors">
            {COLORS.map((c) => (
              <button key={c} type="button" className="cp-color" style={{ background: c }} data-active={color === c ? "" : undefined} onClick={() => setColor(c)} aria-label={`Warna ${c}`} />
            ))}
          </div>
        </div>
        <label className="cp-check cp-span">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} /> Stand VIP (sudah dibayar ke panitia)
        </label>
        <p className="muted small cp-span" style={{ margin: 0 }}>
          Perusahaan melengkapi profil, lowongan, dan dekorasi sendiri lewat portal perusahaan.
        </p>
        <div className="row cp-span">
          <button type="submit" disabled={!company.trim()}>
            Tambah stand
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
