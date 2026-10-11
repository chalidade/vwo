import { Minus, Plus } from "lucide-react";
import { ANOMALY_CAP_MAX, ANOMALY_KINDS, ANOMALY_LIVE_MS, ANOMALY_NAMES, ANOMALY_SLOT_MS, price } from "@vwo/shared";
import { fair, useFair } from "../useFair";

/** The organiser's switch for random anomalies (a cat, fireflies...) and how many a seeker may catch a day. */
export function OrgAnomalies({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const s = fair.anomalySettings();
  const kinds = ANOMALY_KINDS.map((k) => ANOMALY_NAMES[k].toLowerCase()).join(", ");
  const setCap = (cap: number) => {
    fair.setAnomalySettings({ cap });
    onToast(`Maksimal ${Math.min(ANOMALY_CAP_MAX, Math.max(1, cap))} kejutan per pencari kerja per hari`);
  };
  return (
    <div className="card" id="pr-anomalies">
      <h2 className="cp-h2">Kejutan acak di lantai</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {kinds.charAt(0).toUpperCase() + kinds.slice(1)} muncul di lantai acak sekitar tiap {ANOMALY_SLOT_MS / 60_000} menit selama{" "}
        {(ANOMALY_LIVE_MS / 60_000).toLocaleString("id-ID")} menit. Pencari kerja yang mengetuknya dapat 2–4 koin atau voucher lamar ({price("coin.apply")} koin, cukup untuk 1
        lamaran). Server yang menentukan hadiahnya.
      </p>
      <label className="cp-check">
        <input
          type="checkbox"
          checked={s.on}
          onChange={(e) => {
            fair.setAnomalySettings({ on: e.target.checked });
            onToast(e.target.checked ? "Kejutan acak dinyalakan" : "Kejutan acak dimatikan");
          }}
        />{" "}
        Tampilkan kejutan acak
      </label>
      <div className="org-walkers anom-cap">
        <span className="small">Maksimal per orang per hari</span>
        <button type="button" className="small-btn" disabled={!s.on || s.cap <= 1} onClick={() => setCap(s.cap - 1)} aria-label="Kurangi batas harian">
          <Minus size={14} aria-hidden />
        </button>
        <b className="org-walkers-n" aria-live="polite">
          {s.cap}
        </b>
        <button type="button" className="small-btn" disabled={!s.on || s.cap >= ANOMALY_CAP_MAX} onClick={() => setCap(s.cap + 1)} aria-label="Tambah batas harian">
          <Plus size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
