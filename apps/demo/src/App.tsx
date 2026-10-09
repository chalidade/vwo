import { useEffect, useState } from "react";
import { JobFair } from "./JobFair";
import { Landing } from "./Landing";
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
  const home = !route.startsWith("jobfair");
  return (
    <div className={game ? "app app-game" : home ? "app app-home" : "app"}>
      {!game && !home && (
      <nav className="top">
        <a href="#/" className="brand"><img src={`${import.meta.env.BASE_URL}brand/jobfair-logo.png`} alt="jobfair" className="brand-logo" /></a>
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
        <Landing />
      )}
    </div>
  );
}
