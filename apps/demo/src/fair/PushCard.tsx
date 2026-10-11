import { usePush } from "./push";

/** Turn notifications outside the app on or off for this device; says what to do when it can't. */
export function PushCard({ who }: { who: "seeker" | "company" }) {
  const { state, enable, disable } = usePush();
  if (state === "unsupported" || state === "off" || state === "busy") return null;
  const what = who === "company" ? "lamaran baru dan balasan pelamar" : "balasan HR, undangan dan pengingat interview, dan ajakan berteman";
  return (
    <div className="push-card" data-on={state === "on" ? "" : undefined}>
      {state === "on" ? (
        <>
          <span>✅ Notifikasi HP aktif di perangkat ini.</span>
          <button type="button" className="small-btn ghost" onClick={disable}>
            Matikan
          </button>
        </>
      ) : state === "denied" ? (
        <span>🔕 Notifikasi diblokir di browser ini. Izinkan lewat ikon gembok di kolom alamat, lalu buka lagi.</span>
      ) : state === "install" ? (
        <span>📲 Di iPhone, tambahkan dulu ke Layar Utama (Bagikan → Tambah ke Layar Utama), lalu buka dari sana untuk menerima notifikasi {what}.</span>
      ) : (
        <>
          <span>📲 Dapat notifikasi di HP walau aplikasi ditutup: {what}.</span>
          <button type="button" className="small-btn" onClick={enable}>
            Aktifkan
          </button>
        </>
      )}
    </div>
  );
}
