import { useEffect, useState } from "react";
import { type BoothTheme, type CompanyBooth, type GateStyle, hasStand, MINI_MAX_OPEN_JOBS, openJobs, standSlotIndex, standSlotName, UMKM_CORNER } from "@vwo/shared";
import { BOOTH_THEMES, FLOOR_SLOTS, GATE_STYLES } from "@vwo/ui";
import { BOOTH_SLOTS } from "../jobfair-engine";
import { sessionLogin } from "../company/login";
import { ArrowLeftRight, FileSpreadsheet, MoveRight } from "lucide-react";
import { ACCESSORY_PRODUCTS, LAPOR_LABEL, coinText, rupiah } from "../fair/company";
import { LIVE } from "../mode";
import { boothMembers, moveStandOnServer, removeBoothMember } from "../server-fair";
import { fair } from "../useFair";

const COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#eab308", "#f97316", "#dc2626", "#db2777", "#9333ea", "#334155"];
const slotName = (x: number, y: number) => standSlotName(standSlotIndex(x, y));
/** Where slot `slot` sits in the move picker's grid: its column and row in the hall, and on a phone
 *  the right three columns go under the left three (see .org-move-grid). */
const slotCell = (slot: number) => {
  const col = Math.floor(slot / 2);
  const row = slot % 2;
  return { ["--gc" as string]: col + 1, ["--gr" as string]: row + 1, ["--gcm" as string]: (col % 3) + 1, ["--grm" as string]: row + 1 + (col < 3 ? 0 : 2) };
};

/** Where a new booth goes; `mini` adds a mini (UMKM) booth to the floor's Pojok UMKM instead of a slot. */
type Slot = { floor: number; x: number; y: number; mini?: boolean };

/** The organiser adds companies to free booth places, takes them out, or brings them back. */
export function OrgBooths({ onToast }: { onToast: (t: string) => void }) {
  const [adding, setAdding] = useState<Slot | null>(null);
  const [config, setConfig] = useState<string | null>(null);
  const [people, setPeople] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const configuring = config ? fair.booth(config) : undefined;
  const movingBooth = moving ? fair.booth(moving) : undefined;
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
        <div className="row org-export">
          <span className="muted small cp-grow">
            Semua lowongan aktif di acara ini ({fair.fair.booths.reduce((n, b) => n + b.jobs.filter((j) => !j.closed).length, 0)}), {LAPOR_LABEL}:
          </span>
          <button
            type="button"
            className="small-btn ghost"
            onClick={() => void import("../fair/exports").then((m) => m.saveLapor(fair.fair.booths, "lapor-lowongan-acara", "xlsx"))}
          >
            <FileSpreadsheet size={14} aria-hidden /> Excel
          </button>
          <button
            type="button"
            className="small-btn ghost"
            onClick={() => void import("../fair/exports").then((m) => m.saveLapor(fair.fair.booths, "lapor-lowongan-acara", "csv"))}
          >
            CSV
          </button>
        </div>
        {floors.map((fl, floor) => (
          <section key={floor} className="org-floor">
            <h3 className="cp-h3">{fl.name}</h3>
            <div className="org-slots">
              {BOOTH_SLOTS.map((sl) => {
                const b = fair.fair.booths.find((x) => hasStand(x) && x.floor === floor && x.x === sl.x && x.y === sl.y);
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
                      {b.company} {b.tier === "premium" && <span className="cp-vip">VIP</span>}
                    </b>
                    <span className="muted small">
                      {slotName(sl.x, sl.y)} · {apps} pelamar · {fair.peopleAt(b.id)} di stand
                    </span>
                    <span className="small org-login">
                      <code>{b.id}</code> · PIN {LIVE && !fair.hasCompanyPin(b.id) ? <span className="muted">belum diatur</span> : <code>{fair.companyPin(b.id)}</code>}
                    </span>
                    <span className="org-slot-tools">
                      <button type="button" className="small-btn" onClick={() => setConfig(b.id)}>
                        Atur
                      </button>
                      <button type="button" className="small-btn ghost" onClick={() => setMoving(b.id)}>
                        Pindah
                      </button>
                      <a className="small-btn ghost" href={`#/jobfair/company/${b.id}`} onClick={() => !LIVE && sessionLogin(b.id)}>
                        Portal
                      </a>
                      {LIVE && (
                        <button type="button" className="small-btn ghost" aria-expanded={people === b.id} onClick={() => setPeople(people === b.id ? null : b.id)}>
                          Akun
                        </button>
                      )}
                      <button
                        type="button"
                        className="small-btn ghost"
                        onClick={() => {
                          const pin = prompt(
                            `PIN baru untuk ${b.company} (4–6 angka). Berikan ke perusahaan bersama kode ${b.id}.`,
                            LIVE && !fair.hasCompanyPin(b.id) ? String(100000 + Math.floor(Math.random() * 900000)) : fair.companyPin(b.id),
                          );
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
                    {people === b.id && <BoothPeople boothId={b.id} onToast={onToast} />}
                  </div>
                );
              })}
            </div>
            <div className="org-umkm">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">
                  <b>{UMKM_CORNER}</b> <span className="muted">· paket mini tanpa stand, {MINI_MAX_OPEN_JOBS} lowongan aktif</span>
                </span>
                <button type="button" className="small-btn ghost" onClick={() => setAdding({ floor, x: 0, y: 0, mini: true })}>
                  + Tambah UMKM
                </button>
              </div>
              <ul className="cp-jobs">
                {fair.fair.booths
                  .filter((b) => b.floor === floor && !hasStand(b))
                  .map((b) => (
                    <li key={b.id}>
                      <span className="cp-job-main">
                        <b>{b.company}</b>
                        <span className="muted small">
                          {openJobs(b)[0]?.title ?? "Belum ada lowongan aktif"} · {fair.applications.filter((a) => a.boothId === b.id).length} pelamar · <code>{b.id}</code> · PIN{" "}
                          {LIVE && !fair.hasCompanyPin(b.id) ? "belum diatur" : <code>{fair.companyPin(b.id)}</code>}
                        </span>
                      </span>
                      <span className="cp-job-tools">
                        <a className="small-btn ghost" href={`#/jobfair/company/${b.id}`} onClick={() => !LIVE && sessionLogin(b.id)}>
                          Portal
                        </a>
                        <button
                          type="button"
                          className="small-btn ghost"
                          onClick={() => {
                            const pin = prompt(`PIN baru untuk ${b.company} (4–6 angka).`, LIVE && !fair.hasCompanyPin(b.id) ? String(100000 + Math.floor(Math.random() * 900000)) : fair.companyPin(b.id));
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
                            if (!confirm(`Keluarkan ${b.company} dari ${UMKM_CORNER}? Lamaran ke perusahaan ini ikut terhapus.`)) return;
                            fair.removeBooth(b.id);
                            onToast(`${b.company} dikeluarkan`);
                          }}
                        >
                          Lepas
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
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
                    {bk.company} {bk.tier === "premium" && <span className="cp-vip">VIP</span>}
                  </b>
                  <span className="muted small">
                    {bk.contact} · {bk.email} · {coinText(bk.price)} lunas via {bk.method} · {new Date(bk.at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
      {configuring && (
        <ConfigureBooth
          booth={configuring}
          onClose={() => setConfig(null)}
          onDone={() => {
            setConfig(null);
            onToast(`Stand ${configuring.company} diperbarui`);
          }}
        />
      )}
      {movingBooth && (
        <MoveStand
          booth={movingBooth}
          onClose={() => setMoving(null)}
          onDone={(text) => {
            setMoving(null);
            onToast(text);
          }}
        />
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
          const b = fair.addBooth({ company, industry, tagline, recruiter, logo, color, tier: slot.mini ? "mini" : vip ? "premium" : "regular", floor: slot.floor, x: slot.x, y: slot.y });
          if (b) onDone(b.company);
        }}
      >
        <h2 className="cp-h2 cp-span">
          {slot.mini ? "UMKM baru" : "Stand baru"} · {fair.fair.floors[slot.floor]?.name}, {slot.mini ? UMKM_CORNER : slotName(slot.x, slot.y)}
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
        {!slot.mini && (
          <label className="cp-check cp-span">
            <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} /> Stand VIP (sudah dibayar ke panitia)
          </label>
        )}
        <p className="muted small cp-span" style={{ margin: 0 }}>
          Perusahaan melengkapi profil, lowongan, dan dekorasi sendiri lewat portal perusahaan.
        </p>
        <div className="row cp-span">
          <button type="submit" disabled={!company.trim()}>
            {slot.mini ? "Tambah UMKM" : "Tambah stand"}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}

/** What to tell the organiser when a move failed. */
function moveErrorText(error: string) {
  switch (error) {
    case "not_allowed":
    case "not_signed_in":
      return "Hanya panitia yang bisa memindahkan stand. Masuk lagi dengan akun panitia.";
    case "invalid_slot":
      return "Tempat itu tidak ada lagi. Muat ulang halaman lalu pilih tempat lain.";
    case "same_slot":
      return "Stand sudah ada di tempat itu.";
    case "not_found":
      return "Stand ini sudah tidak ada di acara.";
    case "too_many_requests":
      return "Terlalu banyak perpindahan dalam waktu singkat. Coba lagi sebentar lagi.";
    case "offline":
      return "Tidak tersambung ke server. Periksa internet lalu coba lagi.";
    default:
      return "Stand gagal dipindah. Coba lagi.";
  }
}

/**
 * Move a stand to another slot, on its floor or another booth floor: a small map of every floor's
 * twelve slots, laid out like the hall (six columns, two rows; on a phone the right half wraps below). A free slot moves the stand there; a taken one swaps the two stands. The booth's
 * applicants, promoter, media and VIP SPG go with it, and visitors pay the new floor's entry price.
 */
function MoveStand({ booth, onClose, onDone }: { booth: CompanyBooth; onClose: () => void; onDone: (text: string) => void }) {
  const [to, setTo] = useState<{ floor: number; slot: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const here = { floor: booth.floor, slot: BOOTH_SLOTS.findIndex((s) => s.x === booth.x && s.y === booth.y) };
  const other = to ? fair.standAt(to.floor, to.slot) : undefined;
  const floorName = (i: number) => `${fair.fair.floors[i]?.name ?? ""} · ${fair.fair.floors[i]?.theme ?? ""}`;
  const priceOf = (i: number) => fair.floorPrice(fair.floorIdOf({ floor: i }));
  const move = async () => {
    if (!to) return;
    setBusy(true);
    setError("");
    const r = LIVE ? await moveStandOnServer(booth.id, to.floor, to.slot) : fair.moveStand(booth.id, to.floor, to.slot);
    setBusy(false);
    if ("ok" in r && !r.ok) return setError(moveErrorText(r.error));
    if ("error" in r) return setError(moveErrorText(r.error));
    // Live: the server's answer is the truth; every visitor's game takes it on its next pull.
    if ("data" in r) fair.setPlacements(r.data.placements);
    const place = `${fair.fair.floors[to.floor]?.name}, ${standSlotName(to.slot).toLowerCase()}`;
    onDone(other ? `Stand ${booth.company} dan ${other.company} bertukar tempat` : `Stand ${booth.company} dipindah ke ${place}`);
  };
  return (
    <div className="cp-modal org-move-wrap" onClick={onClose}>
      <div className="card org-move" role="dialog" aria-label={`Pindahkan stand ${booth.company}`} onClick={(e) => e.stopPropagation()}>
        <h2 className="cp-h2">Pindahkan stand {booth.company}</h2>
        <p className="muted small org-move-help">
          Sekarang di {fair.fair.floors[booth.floor]?.name}, {standSlotName(here.slot).toLowerCase()}. Pilih tempat kosong untuk memindah, atau stand lain untuk bertukar tempat.
          Pelamar, promotor, video, dan dekorasi ikut pindah.
        </p>
        <div className="org-move-floors">
          {fair.fair.floors.map((_, floor) => {
            const price = priceOf(floor);
            return (
              <section key={floor} className="org-move-floor">
                <div className="org-move-head">
                  <b className="small">{floorName(floor)}</b>
                  <span className="org-move-price muted small">{price ? `Masuk ${price} koin` : "Gratis"}</span>
                </div>
                <div className="org-move-grid" role="radiogroup" aria-label={floorName(floor)}>
                  {BOOTH_SLOTS.map((_, slot) => {
                    const b = fair.standAt(floor, slot);
                    const current = floor === here.floor && slot === here.slot;
                    const picked = to?.floor === floor && to.slot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        role="radio"
                        aria-checked={picked}
                        className="org-move-cell"
                        data-state={current ? "here" : b ? "taken" : "free"}
                        data-picked={picked ? "" : undefined}
                        disabled={current || busy}
                        title={standSlotName(slot)}
                        aria-label={`${standSlotName(slot)}: ${current ? "posisi sekarang" : b ? b.company : "kosong"}`}
                        style={{ ...(b ? { ["--c" as string]: b.color } : {}), ...slotCell(slot) }}
                        onClick={() => setTo({ floor, slot })}
                      >
                        <span className="org-move-name">{current ? "Di sini" : b ? b.company : "Kosong"}</span>
                        <span className="org-move-slot">{standSlotName(slot)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {to && (
          <p className="small org-move-plan">
            {other ? (
              <>
                <ArrowLeftRight size={14} aria-hidden /> {booth.company} dan {other.company} bertukar tempat: {other.company} pindah ke {fair.fair.floors[here.floor]?.name},{" "}
                {standSlotName(here.slot).toLowerCase()}.
              </>
            ) : (
              <>
                <MoveRight size={14} aria-hidden /> {booth.company} pindah ke {fair.fair.floors[to.floor]?.name}, {standSlotName(to.slot).toLowerCase()}.
              </>
            )}
            {to.floor !== here.floor && priceOf(to.floor) !== priceOf(here.floor)
              ? ` Pengunjung membayar harga masuk ${fair.fair.floors[to.floor]?.name}: ${priceOf(to.floor) ? `${priceOf(to.floor)} koin` : "gratis"}.`
              : ""}
          </p>
        )}
        {error && <p className="bk-err small">{error}</p>}
        <div className="row">
          <button type="button" disabled={!to || busy} onClick={() => void move()}>
            {busy ? "Memindah…" : other ? "Tukar tempat" : "Pindahkan"}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

const ADDONS = ACCESSORY_PRODUCTS.filter((p) => p.id !== "vip" && p.id !== "promoter");

/** Everything about one booth's look in one place: VIP or regular, theme, add-ons, gate and video. */
function ConfigureBooth({ booth, onClose, onDone }: { booth: CompanyBooth; onClose: () => void; onDone: () => void }) {
  const [tier, setTier] = useState(booth.tier ?? "regular");
  const [theme, setTheme] = useState<BoothTheme>(booth.theme ?? "classic");
  const [addons, setAddons] = useState(new Set(booth.accessories ?? []));
  const [videoUrl, setVideoUrl] = useState(booth.media?.videoUrl ?? "");
  const [gate, setGate] = useState<GateStyle>(booth.media?.gate ?? (booth.tier === "premium" ? "klasik" : "janur"));
  const [gateText, setGateText] = useState(booth.media?.gateText ?? "");
  const floorUsed = ADDONS.filter((p) => p.slot === "floor" && addons.has(p.id)).length;
  const gated = tier === "premium" || addons.has("gapura");
  const hasVideo = tier === "premium" || addons.has("tv");
  const toggle = (id: string, slot: string) => {
    const next = new Set(addons);
    if (next.has(id)) next.delete(id);
    else if (slot !== "floor" || floorUsed < FLOOR_SLOTS) next.add(id);
    setAddons(next);
  };
  return (
    <div className="cp-modal" onClick={onClose}>
      <form
        className="card cp-form org-add org-config"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          fair.configureBooth(booth.id, {
            tier,
            theme,
            accessories: [...addons],
            media: { videoUrl: videoUrl.trim(), gate, gateText: gateText.trim() },
          });
          onDone();
        }}
      >
        <h2 className="cp-h2 cp-span">Atur stand {booth.company}</h2>
        <div className="cp-span bk-tiers">
          {(["regular", "premium"] as const).map((t) => (
            <button key={t} type="button" className="bk-tier" data-active={tier === t ? "" : undefined} onClick={() => setTier(t)}>
              <b>{t === "premium" ? "Stand VIP" : "Stand reguler"}</b>
              <small>{t === "premium" ? "Lebih lebar, umbul-umbul, gapura, layar video besar" : "Panel, meja recruiter, roll-up banner"}</small>
            </button>
          ))}
        </div>
        <div className="cp-span">
          <span className="muted small">Tema</span>
          <div className="cp-themes">
            {(Object.keys(BOOTH_THEMES) as BoothTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                className="cp-theme"
                data-active={theme === t ? "" : undefined}
                onClick={() => setTheme(t)}
                style={{ ["--wall" as string]: BOOTH_THEMES[t].wall, ["--base" as string]: BOOTH_THEMES[t].base, ["--post" as string]: BOOTH_THEMES[t].post, ["--c" as string]: booth.color }}
              >
                <span className="cp-theme-swatch" />
                {BOOTH_THEMES[t].name}
              </button>
            ))}
          </div>
        </div>
        <div className="cp-span">
          <span className="muted small">
            Add-on stand · barang lantai {floorUsed}/{FLOOR_SLOTS} · add-on berbayar yang dicentang panitia dianggap sudah lunas
          </span>
          <div className="org-addons">
            {ADDONS.map((p) => {
              const included = p.id === "gapura" && tier === "premium";
              return (
                <label key={p.id} className="cp-check">
                  <input type="checkbox" checked={included || addons.has(p.id)} disabled={included} onChange={() => toggle(p.id, p.slot)} />
                  {p.emoji} {p.name} <span className="muted small">{included ? "termasuk VIP" : p.price ? coinText(p.price) : "gratis"}</span>
                </label>
              );
            })}
          </div>
        </div>
        {hasVideo && (
          <label className="cp-span">
            Link video (YouTube atau .mp4){tier === "premium" ? ", diputar di layar besar VIP" : ", diputar di TV stand"}
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/... (kosong = slideshow profil)" />
          </label>
        )}
        {gated && (
          <>
            <label>
              Model gapura
              <select value={gate} onChange={(e) => setGate(e.target.value as GateStyle)}>
                {(Object.keys(GATE_STYLES) as GateStyle[]).map((g) => (
                  <option key={g} value={g}>
                    {GATE_STYLES[g]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tulisan gapura
              <input value={gateText} onChange={(e) => setGateText(e.target.value)} maxLength={40} placeholder={`Selamat datang di ${booth.company}`} />
            </label>
          </>
        )}
        <div className="row cp-span">
          <button type="submit">Simpan</button>
          <button type="button" className="ghost" onClick={onClose}>
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}

/** Live site: the Google accounts that run a booth, and taking one off it. */
function BoothPeople({ boothId, onToast }: { boothId: string; onToast: (t: string) => void }) {
  const [list, setList] = useState<{ id: string; email: string; name: string | null }[] | null>(null);
  const [error, setError] = useState(false);
  const load = () => void boothMembers(boothId).then((r) => (r.ok ? setList(r.data.members) : setError(true)));
  useEffect(load, [boothId]);
  if (error) return <p className="muted small">Daftar akun gagal dimuat.</p>;
  if (!list) return <p className="muted small">Memuat akun…</p>;
  if (!list.length) return <p className="muted small">Belum ada akun. Perusahaan bergabung dengan kode dan PIN di portal perusahaan.</p>;
  return (
    <ul className="cp-ul small">
      {list.map((m) => (
        <li key={m.id}>
          {m.name ?? m.email} <span className="muted">{m.email}</span>{" "}
          <button
            type="button"
            className="cp-linkbtn"
            onClick={async () => {
              if (!confirm(`Keluarkan ${m.email} dari stand ini?`)) return;
              const r = await removeBoothMember(boothId, m.id);
              onToast(r.ok ? `${m.email} dikeluarkan` : "Gagal mengeluarkan akun");
              load();
            }}
          >
            Keluarkan
          </button>
        </li>
      ))}
    </ul>
  );
}
