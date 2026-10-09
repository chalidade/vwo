import { useEffect, useState } from "react";
import { JobFair } from "./JobFair";
import { InstallButton } from "./install";
import { JobFairAdmin } from "./JobFairAdmin";
import { CompanyPortal } from "./company/Portal";
import { SpeakerStage } from "./organizer/Speaker";

function useHash() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const route = hash.replace(/^#\/?/, "");
  // In a room the game takes the whole screen; the way back home is on the title screen.
  const game = route === "jobfair";
  return (
    <div className={game ? "app app-game" : "app"}>
      {!game && (
      <nav className="top">
        <a href="#/" className="brand">🌐 VWO</a>
        <a href="#/jobfair" className={route === "jobfair" ? "active" : ""}>🎪 Job Fair</a>
        <a href="#/jobfair/admin" className={route.startsWith("jobfair/admin") && route !== "jobfair/admin/ads" ? "active" : ""}>Panitia job fair</a>
        <a href="#/jobfair/admin/ads" className={route === "jobfair/admin/ads" ? "active" : ""}>📣 Kelola iklan</a>
        <a href="#/jobfair/company" className={route.startsWith("jobfair/company") ? "active" : ""}>🏢 Portal perusahaan</a>
        <a href="#/jobfair/speaker" className={route === "jobfair/speaker" ? "active" : ""}>🎤 Pembicara</a>
        <span className="demo-tag" title="Semua data hanya ada di browser kamu, dan pelamar lain adalah bot. Versi lengkap butuh server.">
          Demo · pengunjung lain bot
        </span>
      </nav>
      )}
      {route === "jobfair" ? (
        <JobFair />
      ) : route.startsWith("jobfair/admin") ? (
        <JobFairAdmin tab={route.split("/")[2]} />
      ) : route === "jobfair/speaker" ? (
        <SpeakerStage />
      ) : route.startsWith("jobfair/company") ? (
        <CompanyPortal boothId={route.split("/")[2]} />
      ) : (
        <Home />
      )}
    </div>
  );
}

function Home() {
  return (
    <main className="home">
      <div className="rpg-box home-card">
        <h1>VWO - Virtual World Job</h1>
        <InstallButton className="home-install" />
        <p>Job fair virtual yang dijelajahi dengan karakter. Mulai di Aula, naik lift ke lantai booth, jalan dari stand ke stand, tanya recruiter, baca banner lowongan, lalu kirim lamaran. Ada juga seminar, psikotes, lounge konsultasi, dan food court.</p>
        <div className="home-actions">
          <a className="btn" href="#/jobfair">
            ▶ Masuk Job Fair
          </a>
          <a className="btn ghost" href="#/jobfair/admin">
            Dashboard panitia
          </a>
          <a className="btn ghost" href="#/jobfair/company">
            Portal perusahaan
          </a>
          <a className="btn ghost" href="#/jobfair/speaker">
            Halaman pembicara
          </a>
        </div>
        <p className="muted small">
          Demo statis: semua data hanya ada di browser kamu dan pelamar lain adalah bot. Kode: <a href="https://github.com/chalidade/vwo">github.com/chalidade/vwo</a>
        </p>
      </div>
    </main>
  );
}
