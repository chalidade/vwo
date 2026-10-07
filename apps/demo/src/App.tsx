import { useEffect, useState } from "react";
import { DEMO_VENUE } from "@vwo/shared";
import { AdminLive } from "./AdminLive";
import { JobFair } from "./JobFair";
import { JobFairAdmin } from "./JobFairAdmin";
import { World } from "./World";

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
  return (
    <div className={route === DEMO_VENUE.slug || route === "jobfair" ? "app app-game" : "app"}>
      <nav className="top">
        <a href="#/" className="brand">☕ VWO</a>
        <a href={`#/${DEMO_VENUE.slug}`} className={route === DEMO_VENUE.slug ? "active" : ""}>Masuk {DEMO_VENUE.name}</a>
        <a href="#/admin" className={route === "admin" ? "active" : ""}>Live view admin</a>
        <a href="#/jobfair" className={route === "jobfair" ? "active" : ""}>🎪 Job Fair</a>
        <a href="#/jobfair/admin" className={route === "jobfair/admin" ? "active" : ""}>Panitia job fair</a>
        <span className="demo-tag" title="Semua data hanya ada di browser kamu, dan pelanggan lain adalah bot. Versi lengkap butuh server.">
          Demo · pengunjung lain bot
        </span>
      </nav>
      {route === DEMO_VENUE.slug ? (
        <World />
      ) : route === "admin" ? (
        <AdminLive />
      ) : route === "jobfair" ? (
        <JobFair />
      ) : route === "jobfair/admin" ? (
        <JobFairAdmin />
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
        <h1>VWO Virtual Cafe</h1>
        <p>Cermin virtual dari cafe sungguhan. Buat karaktermu, check-in, jalan keliling cafe, dan duduk di kursi yang benar-benar kosong.</p>
        <div className="home-actions">
          <a className="btn" href={`#/${DEMO_VENUE.slug}`}>
            ▶ Masuk ke {DEMO_VENUE.name}
          </a>
          <a className="btn ghost" href="#/admin">
            Live view admin
          </a>
        </div>
        <h2 className="home-sub">🎪 Job Fair</h2>
        <p>Ruangan lain di dunia yang sama: aula pameran kerja dengan stand perusahaan. Jalan dari stand ke stand, tanya recruiter, baca banner lowongan, lalu kirim lamaran.</p>
        <div className="home-actions">
          <a className="btn" href="#/jobfair">
            ▶ Masuk Job Fair
          </a>
          <a className="btn ghost" href="#/jobfair/admin">
            Dashboard panitia
          </a>
        </div>
        <p className="muted small">
          Demo statis: semua data hanya ada di browser kamu dan pelanggan lain adalah bot. Kode: <a href="https://github.com/chalidade/vwo">github.com/chalidade/vwo</a>
        </p>
      </div>
    </main>
  );
}
