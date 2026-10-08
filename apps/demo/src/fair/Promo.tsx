import { type Promoter, safeUrl } from "@vwo/shared";
import { type Look, Person } from "@vwo/ui";
import { Modal } from "./Modal";

/** A promoter's pitch: the brand, the offer, a promo code and a link. A paid ad placement. */
export function PromoCard({ promoter: p, look, saved, onSave, onVisit, onJobs, onClose }: { promoter: Promoter; look: Look; saved: boolean; onSave: () => void; onVisit: () => void; onJobs?: () => void; onClose: () => void }) {
  return (
    <Modal title={<>📣 {p.brand}</>} onClose={onClose} className="fx-promo">
      <div className="pc-hero" style={{ ["--c" as string]: p.color }}>
        <span className="pc-ad">{p.boothId ? "REKRUTMEN" : "IKLAN"}</span>
        <span className="pc-emoji">{p.emoji}</span>
        <b className="pc-headline">{p.headline}</b>
      </div>
      <div className="pc-pitch">
        <div className="pc-person">
          <Person look={look} size={1.2} />
        </div>
        <p>
          <b>{p.name}:</b> "Halo! Aku dari {p.brand}. {p.offer}"
        </p>
      </div>
      {p.code && (
        <div className="pc-code">
          <span>Kode promo</span>
          <b>{p.code}</b>
          <button type="button" className="mb-order" disabled={saved} onClick={onSave}>
            {saved ? "✓ Tersimpan di dompet" : "Simpan kode"}
          </button>
        </div>
      )}
      {p.boothId && onJobs ? (
        <button
          type="button"
          className="mb-order jb-apply pc-cta"
          style={{ ["--c" as string]: p.color }}
          onClick={() => {
            onVisit();
            onJobs();
          }}
        >
          💼 {p.cta}
        </button>
      ) : (
      <a className="mb-order jb-apply pc-cta" href={safeUrl(p.url)} target="_blank" rel="noopener noreferrer" onClick={onVisit} style={{ ["--c" as string]: p.color }}>
        {p.cta} ↗
      </a>
      )}
      <p className="sp-muted pc-note">{p.boothId ? "Promotor dari perusahaan peserta job fair." : "Konten bersponsor. Merek dan situs ini fiktif untuk demo."}</p>
    </Modal>
  );
}
