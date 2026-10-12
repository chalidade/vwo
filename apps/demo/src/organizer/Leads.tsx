import { Check, Globe, Mail, MapPin, MessageCircle, Phone, RefreshCw, Store, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BOOTH_TIERS,
  type BoothTier,
  type Lead,
  type LeadKind,
  type LeadStatus,
  LEAD_STATUS_LABEL,
  LEAD_STATUSES,
  leadOpen,
  standSlotIndex,
  standSlotName,
  telLink,
  TIER_LABEL,
  UMKM_CORNER,
  waLink,
} from "@vwo/shared";
import { editLead, fulfilBooth, fulfilStall, leadError, loadLeads } from "../leads";
import { LIVE } from "../mode";
import { fair, useFair } from "../useFair";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0d9488", "#db2777", "#334155"];
const stallSide = (slot: number) => (slot < 8 ? `Belakang ${slot + 1}` : slot < 12 ? `Kiri ${slot - 7}` : `Kanan ${slot - 11}`);
const when = (t: number) => new Date(t).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
type Filter = "open" | LeadStatus | "all";

/**
 * Booth or food court stall requests from the forms: the organiser calls the contact, keeps notes,
 * moves the status along, and with one action opens the booth (with its portal code and PIN) or the stall.
 */
export function OrgLeads({ kind, onToast }: { kind: LeadKind; onToast: (t: string) => void }) {
  useFair();
  const [list, setList] = useState<Lead[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const load = () =>
    void loadLeads().then((r) => {
      if (r.ok) (setList(r.data.filter((l) => l.kind === kind)), setError(""));
      else setError(r.error === "not_allowed" ? leadError(r.error) : "Daftar permintaan gagal dimuat.");
    });
  useEffect(load, [kind]);
  const replace = (l: Lead) => setList((xs) => xs?.map((x) => (x.id === l.id ? l : x)) ?? null);

  const count = (f: Filter) => (list ?? []).filter((l) => (f === "all" ? true : f === "open" ? leadOpen(l) : l.status === f)).length;
  const shown = (list ?? []).filter((l) => (filter === "all" ? true : filter === "open" ? leadOpen(l) : l.status === filter));
  const filters: [Filter, string][] = [["open", "Perlu ditindak"], ...LEAD_STATUSES.map((s): [Filter, string] => [s, LEAD_STATUS_LABEL[s]]), ["all", "Semua"]];

  return (
    <div className="card lead-card">
      <div className="org-row org-row-head">
        <h2 className="cp-h2" style={{ margin: 0 }}>
          {kind === "booth" ? "Permintaan stand dari formulir" : "Permintaan stan food court"}
        </h2>
        <button type="button" className="small-btn ghost" onClick={load} aria-label="Muat ulang">
          <RefreshCw size={14} aria-hidden /> Muat ulang
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {kind === "booth"
          ? "Perusahaan mengisi formulir dari stand kosong di peta atau dari jobfair.co.id/daftar-perusahaan, tanpa melihat harga. Hubungi kontaknya, sepakati paket dan tempat, lalu buat stand: kode dan PIN portal langsung dikirim ke email kontak."
          : "Usaha kuliner mengisi formulir dari stan kosong di Food Court, tanpa melihat harga. Hubungi kontaknya, lalu buka stannya di tempat yang dipilih."}
        {!LIVE && " Demo: permintaan tersimpan di browser ini."}
      </p>
      <div className="lead-filters" role="tablist" aria-label="Saring status">
        {filters.map(([f, label]) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} data-active={filter === f ? "" : undefined} onClick={() => setFilter(f)}>
            {label} <span className="lead-n">{count(f)}</span>
          </button>
        ))}
      </div>
      {error && <p className="bk-err">{error}</p>}
      {!list && !error && <p className="muted small">Memuat…</p>}
      {list && shown.length === 0 && <p className="muted small">{list.length ? "Tidak ada permintaan dengan status ini." : "Belum ada permintaan."}</p>}
      <ul className="lead-list">
        {shown.map((l) => (
          <LeadRow key={l.id} lead={l} onChange={replace} onToast={onToast} />
        ))}
      </ul>
    </div>
  );
}

function LeadRow({ lead: l, onChange, onToast }: { lead: Lead; onChange: (l: Lead) => void; onToast: (t: string) => void }) {
  const [note, setNote] = useState(l.orgNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [making, setMaking] = useState(false);
  const wa = waLink(l.phone);
  const wanted =
    l.kind === "booth"
      ? l.want
        ? [fair.fair.floors[l.want.floor]?.name ?? `Lantai ${l.want.floor + 1}`, standSlotName(standSlotIndex(l.want.x, l.want.y))].filter(Boolean).join(" · ")
        : null
      : l.wantSlot != null
        ? `Food Court · ${stallSide(l.wantSlot)}`
        : null;

  const patch = async (p: { status?: LeadStatus; orgNote?: string }, done: string) => {
    setBusy(true);
    setError("");
    const r = await editLead(l.id, p);
    setBusy(false);
    if (!r.ok) return setError(leadError(r.error));
    onChange(r.data);
    onToast(done);
  };

  return (
    <li className="lead" data-status={l.status}>
      <div className="lead-head">
        <span className="lead-icon" aria-hidden>
          {l.kind === "booth" ? <Store size={18} /> : <UtensilsCrossed size={18} />}
        </span>
        <div className="lead-title">
          <b>{l.name}</b>
          <span className="muted small">
            {l.kind === "booth" ? [l.industry, l.city].filter(Boolean).join(" · ") : l.sells} · masuk {when(l.at)}
          </span>
        </div>
        <span className="lead-status" data-status={l.status}>
          {LEAD_STATUS_LABEL[l.status]}
        </span>
      </div>

      <div className="lead-contact">
        <span>
          <b>{l.contactName}</b>
          {l.contactRole && <span className="muted"> · {l.contactRole}</span>}
        </span>
        <span className="lead-links">
          <a className="small-btn ghost cp-link" href={telLink(l.phone)}>
            <Phone size={14} aria-hidden /> {l.phone}
          </a>
          {wa && (
            <a className="small-btn ghost cp-link" href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={14} aria-hidden /> WhatsApp
            </a>
          )}
          <a className="small-btn ghost cp-link" href={`mailto:${l.email}`}>
            <Mail size={14} aria-hidden /> {l.email}
          </a>
          {l.website && (
            <a className="small-btn ghost cp-link" href={l.website} target="_blank" rel="noopener noreferrer">
              <Globe size={14} aria-hidden /> Website
            </a>
          )}
        </span>
      </div>
      {wanted && (
        <p className="small lead-want">
          <MapPin size={14} aria-hidden /> Ingin di {wanted}
        </p>
      )}
      {l.note && <p className="small lead-note">"{l.note}"</p>}

      {l.result && (
        <p className="small lead-result">
          <Check size={14} aria-hidden />{" "}
          {l.result.boothId ? (
            <>
              Stand dibuat · kode <code>{l.result.boothId}</code> · PIN <code>{l.result.pin}</code>
            </>
          ) : (
            <>Stan dibuka di Food Court</>
          )}{" "}
          · {when(l.result.at)}
        </p>
      )}

      <div className="lead-tools">
        <label className="lead-status-pick">
          <span className="small">Status</span>
          <select
            value={l.status}
            disabled={busy || !!l.result}
            onChange={(e) => void patch({ status: e.target.value as LeadStatus }, `${l.name}: ${LEAD_STATUS_LABEL[e.target.value as LeadStatus]}`)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {leadOpen(l) && !l.result && !making && (
          <button type="button" className="small-btn" onClick={() => setMaking(true)}>
            {l.kind === "booth" ? "Buat stand & kirim akses" : "Buat stan"}
          </button>
        )}
      </div>

      {making &&
        (l.kind === "booth" ? (
          <MakeBooth lead={l} onCancel={() => setMaking(false)} onDone={(x, t) => (setMaking(false), onChange(x), onToast(t))} />
        ) : (
          <MakeStall lead={l} onCancel={() => setMaking(false)} onDone={(x, t) => (setMaking(false), onChange(x), onToast(t))} />
        ))}

      <label className="lead-org-note">
        <span className="small">Catatan panitia (hanya terlihat panitia)</span>
        <textarea rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Hasil telepon, paket yang disepakati, jadwal follow-up" />
      </label>
      {note !== (l.orgNote ?? "") && (
        <div className="lead-tools">
          <button type="button" className="small-btn" disabled={busy} onClick={() => void patch({ orgNote: note }, "Catatan disimpan")}>
            Simpan catatan
          </button>
          <button type="button" className="small-btn ghost" disabled={busy} onClick={() => setNote(l.orgNote ?? "")}>
            Batal
          </button>
        </div>
      )}
      {error && <p className="bk-err">{error}</p>}
    </li>
  );
}

/** Pick the package and the place (the requested one when it's still free), then open the booth. */
function MakeBooth({ lead, onCancel, onDone }: { lead: Lead; onCancel: () => void; onDone: (l: Lead, toast: string) => void }) {
  const [tier, setTier] = useState<BoothTier>("regular");
  const [color, setColor] = useState(COLORS[0]!);
  const mini = tier === "mini";
  const free = mini ? fair.fair.floors.map((_, floor) => ({ floor, x: 0, y: 0 })) : fair.freeSlots();
  const preferred = lead.want ? free.findIndex((s) => (mini ? s.floor === lead.want!.floor : s.floor === lead.want!.floor && s.x === lead.want!.x && s.y === lead.want!.y)) : -1;
  const [pick, setPick] = useState<number | null>(null);
  const at = pick ?? Math.max(0, preferred);
  const spot = free[at];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = (s: { floor: number; x: number; y: number }) =>
    `${fair.fair.floors[s.floor]?.name ?? `Lantai ${s.floor + 1}`} · ${mini ? UMKM_CORNER : standSlotName(standSlotIndex(s.x, s.y))}`;
  return (
    <div className="lead-make">
      <label>
        <span className="small">Paket</span>
        <select value={tier} onChange={(e) => (setTier(e.target.value as BoothTier), setPick(null))}>
          {BOOTH_TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="small">{mini ? "Lantai (Pojok UMKM)" : "Tempat stand"}</span>
        {free.length ? (
          <select value={at} onChange={(e) => setPick(Number(e.target.value))}>
            {free.map((s, i) => (
              <option key={`${s.floor}-${s.x}-${s.y}`} value={i}>
                {name(s)}
                {i === preferred ? " (pilihan perusahaan)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted small">Tidak ada tempat stand kosong. Kosongkan atau tambah lantai dulu.</span>
        )}
      </label>
      {lead.want && preferred < 0 && !mini && <p className="muted small lead-span">Tempat yang diminta sudah terisi; pilih tempat lain.</p>}
      <div className="lead-span">
        <span className="small">Warna stand</span>
        <div className="bk-colors" role="radiogroup" aria-label="Warna stand">
          {COLORS.map((c) => (
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
      </div>
      {error && <p className="bk-err lead-span">{error}</p>}
      <div className="lead-tools lead-span">
        <button
          type="button"
          className="small-btn"
          disabled={busy || !spot}
          onClick={async () => {
            if (!spot || !confirm(`Buat ${TIER_LABEL[tier].toLowerCase()} ${lead.name} di ${name(spot)} dan kirim kode serta PIN ke ${lead.email}?`)) return;
            setBusy(true);
            setError("");
            const r = await fulfilBooth(lead, { ...spot, tier, color });
            setBusy(false);
            if (!r.ok) return setError(leadError(r.error));
            const now = Date.now();
            onDone(
              { ...lead, status: "done", result: { boothId: r.data.boothId, pin: r.data.pin, at: now, by: "" }, updatedAt: now },
              `Stand ${lead.name} dibuat · kode ${r.data.boothId} · PIN ${r.data.pin}`,
            );
          }}
        >
          {busy ? "Membuat…" : "Buat stand & kirim akses"}
        </button>
        <button type="button" className="small-btn ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </div>
  );
}

/** Pick a free food court slot (the requested one when it's still free), then open the stall. */
function MakeStall({ lead, onCancel, onDone }: { lead: Lead; onCancel: () => void; onDone: (l: Lead, toast: string) => void }) {
  const free = fair.freeStallSlots();
  const preferred = lead.wantSlot != null ? free.indexOf(lead.wantSlot) : -1;
  const [pick, setPick] = useState<number | null>(null);
  const at = pick ?? Math.max(0, preferred);
  const slot = free[at];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="lead-make">
      <label className="lead-span">
        <span className="small">Tempat stan</span>
        {free.length ? (
          <select value={at} onChange={(e) => setPick(Number(e.target.value))}>
            {free.map((s, i) => (
              <option key={s} value={i}>
                {stallSide(s)}
                {i === preferred ? " (pilihan usaha)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted small">Food court penuh. Lepas satu stan dulu.</span>
        )}
      </label>
      {lead.wantSlot != null && preferred < 0 && <p className="muted small lead-span">Tempat yang diminta sudah terisi; pilih tempat lain.</p>}
      {error && <p className="bk-err lead-span">{error}</p>}
      <div className="lead-tools lead-span">
        <button
          type="button"
          className="small-btn"
          disabled={busy || slot === undefined}
          onClick={async () => {
            if (slot === undefined || !confirm(`Buka stan ${lead.name} di ${stallSide(slot)}?`)) return;
            setBusy(true);
            setError("");
            const r = await fulfilStall(lead, slot);
            setBusy(false);
            if (!r.ok) return setError(leadError(r.error));
            const now = Date.now();
            onDone(
              { ...lead, status: "done", result: { stallId: r.data.stallId, at: now, by: "" }, updatedAt: now },
              `Stan ${lead.name} dibuka di Food Court. Ketuk Ubah di daftar stan untuk melengkapi menu dan voucher.`,
            );
          }}
        >
          {busy ? "Membuka…" : "Buat stan"}
        </button>
        <button type="button" className="small-btn ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </div>
  );
}
