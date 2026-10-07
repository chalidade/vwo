import { useState } from "react";
import type { Promoter, SponsorView } from "@vwo/shared";
import { fair } from "../useFair";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Every paid ad in the event: promoter NPCs (standing or walking), sponsor banners, food court tenants, booth decorations, and announcements. */
export function OrgAds({ onToast }: { onToast: (t: string) => void }) {
  const [editing, setEditing] = useState<Promoter | null>(null);
  const [sponsor, setSponsor] = useState<SponsorView | null>(null);
  const [note, setNote] = useState("");
  const promoters = fair.allPromoters();
  const ann = fair.org.announcement;
  const floorName = (level: number) => fair.stops.find((s) => s.level === level)?.name ?? `Lantai ${level + 1}`;
  const stalls = fair.fair.rooms.flatMap((r) => r.stalls ?? []);
  const decor = [...fair.ads.entries()].filter(([k]) => k.startsWith("acc:"));
  const decorTotal = decor.reduce((n, [, a]) => ({ views: n.views + a.views, clicks: n.clicks + a.clicks, sold: n.sold + a.sold }), { views: 0, clicks: 0, sold: 0 });

  return (
    <div className="org">
      <div className="card">
        <h2 className="cp-h2">📢 Pengumuman ke semua pengunjung</h2>
        {ann && (
          <p className="org-ann">
            <b>Sedang tampil:</b> {ann.text} <span className="muted small">· {new Date(ann.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
          </p>
        )}
        <form
          className="org-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            fair.announce(note);
            setNote("");
            onToast("Pengumuman dikirim");
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Contoh: Walk-in interview PT Contoh dibuka jam 13.00 di Lantai 2" />
          <button type="submit" disabled={!note.trim()}>
            Kirim
          </button>
          {ann && (
            <button type="button" className="ghost" onClick={() => fair.announce("")}>
              Hapus
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <div className="org-row org-row-head">
          <h2 className="cp-h2" style={{ margin: 0 }}>
            🧑‍💼 NPC promotor
          </h2>
          <button type="button" className="small-btn" onClick={() => setEditing(newPromoter())}>
            ＋ Tambah promotor
          </button>
        </div>
        <p className="muted small">Promotor berdiri di satu titik dan menyapa yang lewat. Promotor keliling berjalan di lantainya dan mendatangi pengunjung untuk menawarkan promo.</p>
        <ul className="org-cards">
          {promoters.map((p) => {
            const a = fair.ads.get(`promo:${p.id}`);
            const off = p.active === false;
            return (
              <li key={p.id} data-off={off ? "" : undefined} style={{ ["--c" as string]: p.color }}>
                <span className="org-emoji">{p.emoji}</span>
                <span className="org-card-main">
                  <b>
                    {p.brand} <span className="muted small">· {p.name}</span>
                  </b>
                  <span className="small">{p.headline}</span>
                  <span className="muted small">
                    {floorName(p.level)} · {p.walks ? "🚶 Keliling" : "🧍 Berdiri"} · 👁 {a?.views ?? 0} · 👆 {a?.clicks ?? 0} ({pct(a?.clicks ?? 0, a?.views ?? 0)})
                    {p.code && ` · kode ${p.code}`}
                  </span>
                </span>
                <span className="org-card-tools">
                  <button type="button" className="small-btn" data-on={off ? undefined : ""} onClick={() => fair.savePromoter({ ...p, active: off ? undefined : false })}>
                    {off ? "Nonaktif" : "✓ Aktif"}
                  </button>
                  <button type="button" className="small-btn ghost" onClick={() => setEditing(p)}>
                    Ubah
                  </button>
                  <button type="button" className="small-btn ghost" onClick={() => confirm(`Hapus promotor ${p.brand}?`) && fair.removePromoter(p.id)} aria-label={`Hapus ${p.brand}`}>
                    🗑
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card">
        <h2 className="cp-h2">🏷️ Banner sponsor</h2>
        <ul className="org-cards">
          {fair.fair.sponsors.map((sp) => (
            <li key={sp.id} style={{ ["--c" as string]: sp.color }}>
              <span className="org-emoji cp-logo">{sp.logo}</span>
              <span className="org-card-main">
                <b>
                  {sp.name} <span className="muted small">· {sp.tier}</span>
                </b>
                <span className="small">{sp.tagline}</span>
                <span className="muted small">
                  {fair.fair.floors[sp.floor]?.name} · 👁 {fair.sponsorViews.get(sp.id) ?? 0} dilihat {sp.promo && `· promo ${sp.promo}`}
                </span>
              </span>
              <span className="org-card-tools">
                <button type="button" className="small-btn ghost" onClick={() => setSponsor(sp)}>
                  Ubah
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="cp-h2">📊 Laporan iklan lain</h2>
        <div className="org-scroll">
          <table className="list cp-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Dilihat</th>
                <th>Interaksi</th>
                <th>Terjual / diklaim</th>
              </tr>
            </thead>
            <tbody>
              {stalls.map((st) => {
                const a = fair.ads.get(`stall:${st.id}`);
                return (
                  <tr key={st.id}>
                    <td>
                      {st.emoji} {st.name} <span className="muted small">· food court</span>
                    </td>
                    <td>{a?.views ?? 0}</td>
                    <td>{a?.clicks ?? 0}</td>
                    <td>
                      {a?.sold ?? 0} voucher · {a?.coins ?? 0} 🪙
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>✨ Aksesoris premium semua stand</td>
                <td>{decorTotal.views}</td>
                <td>{decorTotal.clicks}</td>
                <td>{decorTotal.sold} diklaim</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PromoterForm
          p={editing}
          isNew={!promoters.some((x) => x.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            fair.savePromoter(p);
            setEditing(null);
            onToast(`Promotor ${p.brand} disimpan`);
          }}
        />
      )}
      {sponsor && (
        <SponsorForm
          sp={sponsor}
          onClose={() => setSponsor(null)}
          onSave={(sp) => {
            fair.saveSponsor(sp);
            setSponsor(null);
            onToast(`Sponsor ${sp.name} disimpan`);
          }}
        />
      )}
    </div>
  );
}

function newPromoter(): Promoter {
  return {
    id: fair.newAdId("promo"),
    name: "",
    brand: "",
    emoji: "🎁",
    color: "#f97316",
    level: 0,
    x: 24,
    y: 13,
    headline: "",
    offer: "",
    cta: "Kunjungi",
    url: "https://",
    callouts: [],
    walks: true,
  };
}

function PromoterForm({ p, isNew, onClose, onSave }: { p: Promoter; isNew: boolean; onClose: () => void; onSave: (p: Promoter) => void }) {
  const [f, setF] = useState(p);
  const [callouts, setCallouts] = useState(p.callouts.join("\n"));
  const set = <K extends keyof Promoter>(k: K, v: Promoter[K]) => setF({ ...f, [k]: v });
  return (
    <div className="cp-modal" onClick={onClose}>
      <form
        className="card cp-form org-add"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...f, name: f.name.trim() || "Promotor", brand: f.brand.trim(), code: f.code?.trim().toUpperCase() || undefined, callouts: lines(callouts).slice(0, 6) });
        }}
      >
        <h2 className="cp-h2 cp-span">{isNew ? "Promotor baru" : `Ubah ${p.brand}`}</h2>
        <label>
          Merek
          <input value={f.brand} onChange={(e) => set("brand", e.target.value)} required maxLength={30} />
        </label>
        <label>
          Nama promotor
          <input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={20} />
        </label>
        <label>
          Emoji
          <input value={f.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={4} />
        </label>
        <label>
          Warna
          <input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} />
        </label>
        <label>
          Lantai
          <select value={f.level} onChange={(e) => set("level", Number(e.target.value))}>
            {fair.stops.map((s) => (
              <option key={s.level} value={s.level}>
                {s.name} · {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cara promosi
          <select value={f.walks ? "walk" : "stand"} onChange={(e) => set("walks", e.target.value === "walk" ? true : undefined)}>
            <option value="walk">🚶 Keliling, mendatangi pengunjung</option>
            <option value="stand">🧍 Berdiri di satu titik</option>
          </select>
        </label>
        {!f.walks && (
          <>
            <label>
              Posisi X (ubin)
              <input type="number" min={1} max={38} step={0.5} value={f.x} onChange={(e) => set("x", Number(e.target.value))} />
            </label>
            <label>
              Posisi Y (ubin)
              <input type="number" min={1} max={20} step={0.5} value={f.y} onChange={(e) => set("y", Number(e.target.value))} />
            </label>
          </>
        )}
        <label className="cp-span">
          Judul promo
          <input value={f.headline} onChange={(e) => set("headline", e.target.value)} required maxLength={60} />
        </label>
        <label className="cp-span">
          Penawaran
          <textarea rows={2} value={f.offer} onChange={(e) => set("offer", e.target.value)} maxLength={240} />
        </label>
        <label>
          Kode promo (opsional)
          <input value={f.code ?? ""} onChange={(e) => set("code", e.target.value)} maxLength={16} />
        </label>
        <label>
          Teks tombol
          <input value={f.cta} onChange={(e) => set("cta", e.target.value)} maxLength={20} />
        </label>
        <label className="cp-span">
          Link
          <input type="url" value={f.url} onChange={(e) => set("url", e.target.value)} />
        </label>
        <label className="cp-span">
          Sapaan ke pengunjung (satu per baris)
          <textarea rows={3} value={callouts} onChange={(e) => setCallouts(e.target.value)} />
        </label>
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

function SponsorForm({ sp, onClose, onSave }: { sp: SponsorView; onClose: () => void; onSave: (sp: SponsorView) => void }) {
  const [f, setF] = useState(sp);
  const set = <K extends keyof SponsorView>(k: K, v: SponsorView[K]) => setF({ ...f, [k]: v });
  return (
    <div className="cp-modal" onClick={onClose}>
      <form
        className="card cp-form org-add"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...f, promo: f.promo?.trim() || undefined });
        }}
      >
        <h2 className="cp-h2 cp-span">Ubah sponsor</h2>
        <label>
          Nama
          <input value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={30} />
        </label>
        <label>
          Paket
          <select value={f.tier} onChange={(e) => set("tier", e.target.value as SponsorView["tier"])}>
            {(["Platinum", "Gold", "Silver"] as const).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Logo (2 huruf)
          <input value={f.logo} onChange={(e) => set("logo", e.target.value)} maxLength={3} />
        </label>
        <label>
          Warna
          <input type="color" value={f.color} onChange={(e) => set("color", e.target.value)} />
        </label>
        <label className="cp-span">
          Tagline
          <input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={80} />
        </label>
        <label className="cp-span">
          Tentang
          <textarea rows={2} value={f.about} onChange={(e) => set("about", e.target.value)} maxLength={300} />
        </label>
        <label>
          Promo di banner
          <input value={f.promo ?? ""} onChange={(e) => set("promo", e.target.value)} maxLength={60} />
        </label>
        <label>
          Website
          <input type="url" value={f.website} onChange={(e) => set("website", e.target.value)} />
        </label>
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
