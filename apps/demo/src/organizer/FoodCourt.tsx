import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { type FoodStall, STALL_MAX_DEALS, STALL_MAX_MENU, STALL_SLOTS, type StallEdit, stallSlot } from "@vwo/shared";
import { fair } from "../useFair";
import { OrgLeads } from "./Leads";

const COLORS = ["#ea580c", "#dc2626", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#9333ea", "#7c2d12"];
const sideOf = (slot: number) => (slot < 8 ? `Belakang ${slot + 1}` : slot < 12 ? `Kiri ${slot - 7}` : `Kanan ${slot - 11}`);

/** The organiser fills, edits, empties and resets the food court's stands, and sets what visitors read about it. */
export function OrgFoodCourt({ onToast }: { onToast: (t: string) => void }) {
  const room = fair.foodCourt();
  const [adding, setAdding] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  if (!room?.stalls) return <div className="card">Acara ini tidak punya food court.</div>;
  const bySlot = new Map(room.stalls.map((st, i) => [stallSlot(st, i), st]));
  const free = fair.freeStallSlots(room.id).length;
  const edited = editing ? room.stalls.find((st) => st.id === editing) : undefined;

  return (
    <div className="org">
      <OrgLeads kind="stall" onToast={onToast} />
      <FoodCourtInfo roomId={room.id} onToast={onToast} />
      <div className="card">
        <h2 className="cp-h2">Stan food court</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          {STALL_SLOTS.length} tempat stan: 8 di dinding belakang, 4 di sisi kiri, 3 di sisi kanan. {free} kosong. Stan kosong tampil di peta dengan tanda "Ajukan stan": usaha
          kuliner mengisi formulir tanpa harga, lalu permintaannya muncul di atas. Ketuk Ubah untuk mengganti nama, tampilan, jam buka, menu, atau voucher sebuah stan.
        </p>
        <div className="org-slots">
          {STALL_SLOTS.map((_, slot) => {
            const st = bySlot.get(slot);
            if (!st)
              return (
                <button key={slot} type="button" className="org-slot org-slot-free" onClick={() => (setEditing(null), setAdding(slot))}>
                  <span className="org-plus">＋</span>
                  <span className="small">Tambah stan</span>
                  <span className="muted small">{sideOf(slot)}</span>
                </button>
              );
            const a = fair.ads.get(`stall:${st.id}`);
            return (
              <div key={st.id} className="org-slot" style={{ ["--c" as string]: st.color }}>
                <span className="cp-logo">{st.emoji}</span>
                <b className="org-slot-name">{st.name}</b>
                <span className="muted small">
                  {sideOf(slot)} · {st.vendor} · {st.deals.length} voucher · {a?.sold ?? 0} terjual
                </span>
                {st.hours && <span className="muted small">Buka {st.hours}</span>}
                <span className="org-slot-tools">
                  <button
                    type="button"
                    className="small-btn"
                    onClick={() => {
                      setAdding(null);
                      setEditing(st.id);
                      requestAnimationFrame(() => document.getElementById("fc-stall-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                    }}
                  >
                    <Pencil size={14} aria-hidden /> Ubah
                  </button>
                  <button
                    type="button"
                    className="small-btn ghost"
                    onClick={() => {
                      if (!confirm(`Lepas stan ${st.name}? Tempatnya jadi kosong dan bisa disewa.`)) return;
                      fair.removeStall(st.id);
                      if (editing === st.id) setEditing(null);
                      onToast(`Stan ${st.name} dilepas`);
                    }}
                  >
                    Lepas
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className="small-btn ghost"
            onClick={() => {
              if (!confirm("Kembalikan food court seperti awal? Stan yang ditambah, diubah, atau disewa akan kembali seperti semula.")) return;
              fair.resetStalls(room.id);
              setEditing(null);
              onToast("Food court dikembalikan seperti awal");
            }}
          >
            Kembalikan seperti awal
          </button>
        </p>
      </div>
      {adding !== null && (
        <StallForm
          key={`new-${adding}`}
          title={`Stan baru · ${sideOf(adding)}`}
          onClose={() => setAdding(null)}
          onSave={(input) => {
            const st = fair.addStall(adding, { name: input.name ?? "" }, room.id);
            if (!st) return onToast("Tempat ini sudah terisi");
            // The rest (vouchers, menu, hours) goes on the same way an edit does.
            fair.updateStall(st.id, input);
            setAdding(null);
            onToast(`Stan ${st.name} ditambahkan`);
          }}
        />
      )}
      {edited && (
        <StallForm
          key={edited.id}
          stall={edited}
          title={`Ubah stan · ${sideOf(stallSlot(edited, room.stalls.indexOf(edited)))}`}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            const st = fair.updateStall(edited.id, input);
            setEditing(null);
            onToast(st ? `Stan ${st.name} disimpan` : "Stan ini sudah tidak ada");
          }}
        />
      )}
    </div>
  );
}

/** What visitors read about the food court: its name, the line under it, and who hosts it. */
function FoodCourtInfo({ roomId, onToast }: { roomId: string; onToast: (t: string) => void }) {
  const base = fair.publishedRoom(roomId);
  const set = fair.org.roomInfo?.[roomId] ?? {};
  const [f, setF] = useState({ name: set.name ?? "", tagline: set.tagline ?? "", host: set.host ?? "", hostRole: set.hostRole ?? "" });
  const field = (k: keyof typeof f, label: string, max: number, hint: string, fallback?: string) => (
    <label className={k === "tagline" ? "cp-span" : undefined}>
      {label}
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} maxLength={max} placeholder={fallback} />
      <span className="sel-hint">{hint}</span>
    </label>
  );
  return (
    <form
      className="card cp-form"
      onSubmit={(e) => {
        e.preventDefault();
        fair.setRoomInfo(roomId, f);
        onToast("Info food court disimpan");
      }}
    >
      <h2 className="cp-h2 cp-span" style={{ margin: 0 }}>
        Info food court
      </h2>
      <p className="muted small cp-span" style={{ margin: 0 }}>
        Tampil ke pengunjung di lift, di papan lantai, dan saat menyapa pengelola. Kosongkan untuk memakai teks bawaan.
      </p>
      {field("name", "Nama lantai", 40, "Nama yang muncul di tombol lift dan peta.", base?.name)}
      {field("tagline", "Keterangan singkat", 120, "Satu kalimat: apa yang ada di sini, jam buka, atau promo hari ini.", base?.tagline)}
      {field("host", "Nama pengelola", 40, "Karakter yang berdiri di food court dan menyapa pengunjung.", base?.staff.name)}
      {field("hostRole", "Jabatan pengelola", 40, "Misalnya: Pengelola food court.", base?.staff.role)}
      <div className="cp-span row inv-actions">
        <button type="submit" className="small-btn">
          Simpan info
        </button>
      </div>
    </form>
  );
}

type DealRow = { id?: string; title: string; worth: string; price: number; terms: string };
type MenuRow = { id?: string; name: string; emoji: string; price: string };

/** A new stall, or the changes to one already standing. */
function StallForm({ stall, title, onClose, onSave }: { stall?: FoodStall; title: string; onClose: () => void; onSave: (input: StallEdit) => void }) {
  const [name, setName] = useState(stall?.name ?? "");
  const [emoji, setEmoji] = useState(stall?.emoji ?? "🍽️");
  const [vendor, setVendor] = useState(stall?.vendor ?? "");
  const [promo, setPromo] = useState(stall?.promo ?? "");
  const [about, setAbout] = useState(stall?.about ?? "");
  const [hours, setHours] = useState(stall?.hours ?? "");
  const [address, setAddress] = useState(stall?.address ?? "");
  const [website, setWebsite] = useState(stall?.website ?? "");
  const [color, setColor] = useState(stall?.color ?? COLORS[0]!);
  const [deals, setDeals] = useState<DealRow[]>(stall?.deals.map((d) => ({ id: d.id, title: d.title, worth: d.worth, price: d.price, terms: d.terms })) ?? []);
  const [menu, setMenu] = useState<MenuRow[]>(stall?.menu.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, price: m.price })) ?? []);
  const setDeal = (i: number, patch: Partial<DealRow>) => setDeals(deals.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const setDish = (i: number, patch: Partial<MenuRow>) => setMenu(menu.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const colors = COLORS.includes(color) ? COLORS : [color, ...COLORS];
  return (
    <form
      id="fc-stall-form"
      className="card bk-form org-form fc-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name, emoji, vendor, promo, about, hours, address, website, color, deals: deals.filter((d) => d.title.trim()), menu: menu.filter((m) => m.name.trim()) });
      }}
    >
      <h3 className="cp-h3">{title}</h3>
      <label>
        Nama usaha
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus={!stall} />
      </label>
      <div className="fc-pair">
        <label>
          Ikon (emoji)
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} />
        </label>
        <label>
          Penjaga stan
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={30} />
        </label>
      </div>
      <div className="bk-colors" role="radiogroup" aria-label="Warna">
        <span className="small">Warna</span>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            data-active={color === c ? "" : undefined}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <label>
        Promo singkat
        <input value={promo} onChange={(e) => setPromo(e.target.value)} maxLength={80} />
      </label>
      <label>
        Tentang usaha
        <textarea rows={2} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} />
      </label>
      <div className="fc-pair">
        <label>
          Jam buka
          <input value={hours} onChange={(e) => setHours(e.target.value)} maxLength={40} placeholder="10.00–21.00" />
        </label>
        <label>
          Situs / Instagram
          <input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} placeholder="https://" inputMode="url" />
        </label>
      </div>
      <label>
        Alamat outlet
        <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} />
      </label>

      <fieldset className="fc-set">
        <legend className="small">
          Voucher dijual pakai koin ({deals.length}/{STALL_MAX_DEALS})
        </legend>
        {deals.length === 0 && <p className="muted small">Belum ada voucher. Tanpa voucher, stan tetap tampil tapi tidak menjual apa pun.</p>}
        {deals.map((d, i) => (
          <div key={d.id ?? `new-${i}`} className="fc-row">
            <label className="fc-wide">
              Nama voucher
              <input value={d.title} onChange={(e) => setDeal(i, { title: e.target.value })} maxLength={60} placeholder="Voucher makan Rp20.000" />
            </label>
            <label>
              Nilai di outlet
              <input value={d.worth} onChange={(e) => setDeal(i, { worth: e.target.value })} maxLength={20} placeholder="Rp20.000" />
            </label>
            <label>
              Harga (koin)
              <input type="number" min={1} max={200} value={d.price} onChange={(e) => setDeal(i, { price: Number(e.target.value) })} />
            </label>
            <label className="fc-wide">
              Syarat
              <input value={d.terms} onChange={(e) => setDeal(i, { terms: e.target.value })} maxLength={120} placeholder="Berlaku 30 hari." />
            </label>
            <button type="button" className="small-btn ghost fc-del" aria-label={`Hapus voucher ${d.title || i + 1}`} onClick={() => setDeals(deals.filter((_, k) => k !== i))}>
              <Trash2 size={14} aria-hidden /> Hapus
            </button>
          </div>
        ))}
        {deals.length < STALL_MAX_DEALS && (
          <button type="button" className="small-btn ghost" onClick={() => setDeals([...deals, { title: "", worth: "", price: 8, terms: "" }])}>
            <Plus size={14} aria-hidden /> Tambah voucher
          </button>
        )}
      </fieldset>

      <fieldset className="fc-set">
        <legend className="small">
          Menu andalan ({menu.length}/{STALL_MAX_MENU})
        </legend>
        {menu.map((m, i) => (
          <div key={m.id ?? `new-${i}`} className="fc-row">
            <label className="fc-wide">
              Nama menu
              <input value={m.name} onChange={(e) => setDish(i, { name: e.target.value })} maxLength={40} />
            </label>
            <label>
              Ikon
              <input value={m.emoji} onChange={(e) => setDish(i, { emoji: e.target.value })} maxLength={8} />
            </label>
            <label>
              Harga di outlet
              <input value={m.price} onChange={(e) => setDish(i, { price: e.target.value })} maxLength={20} placeholder="Rp25.000" />
            </label>
            <button type="button" className="small-btn ghost fc-del" aria-label={`Hapus menu ${m.name || i + 1}`} onClick={() => setMenu(menu.filter((_, k) => k !== i))}>
              <Trash2 size={14} aria-hidden /> Hapus
            </button>
          </div>
        ))}
        {menu.length < STALL_MAX_MENU && (
          <button type="button" className="small-btn ghost" onClick={() => setMenu([...menu, { name: "", emoji: "🍽️", price: "" }])}>
            <Plus size={14} aria-hidden /> Tambah menu
          </button>
        )}
      </fieldset>

      <div className="row">
        <button type="button" className="ghost" onClick={onClose}>
          Batal
        </button>
        <button type="submit">Simpan stan</button>
      </div>
    </form>
  );
}
