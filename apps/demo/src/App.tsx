import { useEffect, useState } from "react";
import { DEMO_VENUE } from "@vwo/shared";
import { AdminLive } from "./AdminLive";
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
    <>
      <div className="banner">
        Demo statis: semua data hanya ada di browser kamu, dan pelanggan lain adalah bot. Versi lengkap butuh server.
      </div>
      <nav className="top">
        <a href="#/" className={route === "" ? "active" : ""}>VWO</a>
        <a href={`#/${DEMO_VENUE.slug}`} className={route === DEMO_VENUE.slug ? "active" : ""}>Masuk {DEMO_VENUE.name}</a>
        <a href="#/admin" className={route === "admin" ? "active" : ""}>Live view admin</a>
      </nav>
      {route === DEMO_VENUE.slug ? <World /> : route === "admin" ? <AdminLive /> : <Home />}
    </>
  );
}

function Home() {
  return (
    <main>
      <h1>VWO Virtual Cafe</h1>
      <p className="muted">Cermin virtual dari cafe sungguhan: denah, kursi, siapa di dalam, rombongan, dan interaksi.</p>
      <ul>
        <li>
          <a href={`#/${DEMO_VENUE.slug}`}>Masuk ke {DEMO_VENUE.name}</a>: check-in, jalan dengan WASD atau tombol panah, klik kursi hijau untuk duduk.
        </li>
        <li>
          <a href="#/admin">Live view admin</a>: jumlah orang, rombongan, kursi kosong, dan riwayat datang/keluar.
        </li>
      </ul>
      <p className="muted">
        Kode: <a href="https://github.com/chalidade/vwo">github.com/chalidade/vwo</a>
      </p>
    </main>
  );
}
