import { useState } from "react";
import type { CompanyBooth } from "@vwo/shared";
import { PROMOTER_PRODUCT, coinText } from "../fair/company";
import { fair } from "../useFair";
import type { PortalTab } from "./Portal";

/** The company's own walking promoter: who it is and what it tells job seekers. */
export function PromoterEditor({ booth, onTab }: { booth: CompanyBooth; onTab: (t: PortalTab) => void }) {
  const c = booth.promoter ?? {};
  const live = fair.fair.promoters.find((p) => p.boothId === booth.id);
  const [name, setName] = useState(c.name ?? "");
  const [emoji, setEmoji] = useState(c.emoji ?? "");
  const [headline, setHeadline] = useState(c.headline ?? "");
  const [offer, setOffer] = useState(c.offer ?? "");
  const [code, setCode] = useState(c.code ?? "");
  const [callouts, setCallouts] = useState((c.callouts ?? []).join("\n"));
  const [saved, setSaved] = useState(false);
  const stats = fair.ads.get(`promo:co-${booth.id}`);

  if (!fair.owns(booth.id, PROMOTER_PRODUCT.id))
    return (
      <div className="card">
        <h2 className="cp-h2">📣 NPC promotor keliling</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          {PROMOTER_PRODUCT.about}
        </p>
        <button type="button" onClick={() => onTab("billing")}>
          🛒 Beli promotor · {coinText(PROMOTER_PRODUCT.price)}
        </button>
      </div>
    );

  return (
    <form
      className="card cp-form"
      onSubmit={(e) => {
        e.preventDefault();
        fair.editBooth(booth.id, {
          promoter: {
            name: name.trim(),
            emoji: emoji.trim(),
            headline: headline.trim(),
            offer: offer.trim(),
            code: code.trim().toUpperCase(),
            callouts: callouts
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 5),
          },
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }}
    >
      <h2 className="cp-h2 cp-span">📣 Promotor keliling kamu</h2>
      <p className="muted small cp-span" style={{ margin: 0 }}>
        Berkeliling di {fair.fair.floors[booth.floor]?.name}, mendatangi pelamar, lalu tombolnya membuka lowonganmu. Didatangi {stats?.views ?? 0} kali · {stats?.clicks ?? 0} klik.
      </p>
      <label>
        Nama promotor
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={live?.name} />
      </label>
      <label>
        Emoji
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} placeholder="💼" />
      </label>
      <label className="cp-span">
        Judul ajakan
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={60} placeholder={live?.headline} />
      </label>
      <label className="cp-span">
        Isi ajakan
        <textarea rows={2} value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={240} placeholder={live?.offer} />
      </label>
      <label>
        Kode (opsional, mis. walk-in interview)
        <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} />
      </label>
      <label>
        Sapaan saat berjalan (satu per baris)
        <textarea rows={2} value={callouts} onChange={(e) => setCallouts(e.target.value)} />
      </label>
      <div className="row cp-span">
        <button type="submit">Simpan promotor</button>
        {saved && <span className="cp-saved">✓ Tersimpan, langsung tampil di job fair</span>}
      </div>
    </form>
  );
}
