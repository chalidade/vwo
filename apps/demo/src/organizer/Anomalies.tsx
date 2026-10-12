import { Clock, MapPin, Minus, Moon, Plus, Sparkles, Sun } from "lucide-react";
import { ANOMALY_CAP_MAX, ANOMALY_INFO, ANOMALY_KINDS, ANOMALY_LIVE_MS, ANOMALY_RARE_COINS, ANOMALY_SLOT_MS, price } from "@vwo/shared";
import { fair, useFair } from "../useFair";

/** The organiser's switch for random anomalies (a cat, fireflies...) and how many a seeker may catch a day. */
export function OrgAnomalies({ onToast }: { onToast: (t: string) => void }) {
  useFair();
  const s = fair.anomalySettings();
  const total = ANOMALY_KINDS.reduce((n, k) => n + ANOMALY_INFO[k].weight, 0);
  const hh = (h: number) => `${String(h).padStart(2, "0")}.00`;
  const setCap = (cap: number) => {
    fair.setAnomalySettings({ cap });
    onToast(`Maksimal ${Math.min(ANOMALY_CAP_MAX, Math.max(1, cap))} kejutan per pencari kerja per hari`);
  };
  return (
    <div className="card" id="pr-anomalies">
      <h2 className="cp-h2">Kejutan acak di lantai</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Satu kejutan muncul di lantai acak sekitar tiap {ANOMALY_SLOT_MS / 60_000} menit selama {(ANOMALY_LIVE_MS / 60_000).toLocaleString("id-ID")} menit. Pencari kerja yang
        mengetuknya dapat 2–4 koin atau voucher lamar ({price("coin.apply")} koin, cukup untuk 1 lamaran); yang langka {ANOMALY_RARE_COINS[0]}–{ANOMALY_RARE_COINS[1]} koin. Bonus
        hanya untuk tangkapan pertama tiap jenis, setelah itu masuk koleksi saja. Server yang menentukan jenis dan hadiahnya.
      </p>
      <ul className="anom-kinds" aria-label="Jenis kejutan">
        {ANOMALY_KINDS.map((k) => {
          const info = ANOMALY_INFO[k];
          return (
            <li key={k}>
              <b>{info.name}</b>
              <span className="anom-kind-tag" data-rare={info.rare ? "" : undefined}>
                {info.rare && <Sparkles size={12} aria-hidden />}
                {info.rare ? "Langka" : "Biasa"}
              </span>
              <span className="muted small">
                Peluang ±{Math.max(0.1, Math.round((info.weight / total) * 1000) / 10).toLocaleString("id-ID")}%
                {info.hours && (
                  <>
                    {" · "}
                    <Clock size={12} aria-hidden /> {hh(info.hours[0])}–{hh(info.hours[1])} WIB
                  </>
                )}
                {info.place && (
                  <>
                    {" · "}
                    <MapPin size={12} aria-hidden /> {info.place === "foodcourt" ? "Food Court" : info.place === "park" ? "Taman" : "Aula"}
                  </>
                )}
                {info.phase && (
                  <>
                    {" · "}
                    {info.phase === "night" ? <Moon size={12} aria-hidden /> : <Sun size={12} aria-hidden />}{" "}
                    {info.phase === "night" ? "Malam (18.30–05.00 WIB)" : "Siang (06.00–17.30 WIB)"}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
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
