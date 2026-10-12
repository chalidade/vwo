// The seeker's collection of anomalies: every kind, the caught ones with when and where, the rest
// as ??? with a hint when they only come at some hours or in one room. Each kind pays only once.
import { useEffect } from "react";
import { ANOMALY_INFO, ANOMALY_KINDS } from "@vwo/shared";
import { AnomalyIcon } from "@vwo/ui";
import { loadAnomalyCollection, useAnomalyCollection } from "../anomaly-sync";
import { anomalyHint } from "./anomaly";

const when = (at: number) => new Date(at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The collection, in the seeker's bag. */
export function AnomalyCollection() {
  const caught = useAnomalyCollection();
  useEffect(() => void loadAnomalyCollection(), []);
  return (
    <section className="sp-floor ac">
      <h4 className="sp-floor-title">
        Koleksi anomali{" "}
        <span className="sp-muted">
          {caught.size}/{ANOMALY_KINDS.length}
        </span>
      </h4>
      <p className="sp-muted ac-note">Tangkap kejutan yang muncul di lantai. Bonus koin hanya untuk tangkapan pertama tiap jenis.</p>
      <div className="ac-grid">
        {ANOMALY_KINDS.map((k) => {
          const info = ANOMALY_INFO[k];
          const got = caught.get(k);
          const hint = got ? null : anomalyHint(info);
          return (
            <div key={k} className="ac-item" data-got={got ? "" : undefined} data-rare={info.rare ? "" : undefined}>
              <div className="ac-pic" aria-hidden>
                <AnomalyIcon kind={k} />
              </div>
              <b>{got ? info.name : "???"}</b>
              {info.rare && <span className="ac-rare">Langka</span>}
              {got ? (
                <span className="sp-muted">
                  {when(got.at)}
                  {got.where ? ` · ${got.where}` : ""}
                </span>
              ) : (
                <span className="sp-muted">{hint ?? "Belum ditemukan"}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
