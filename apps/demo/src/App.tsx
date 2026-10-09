import { useEffect, useState } from "react";
import { JobFair } from "./JobFair";
import { Landing } from "./Landing";
import { JobFairAdmin } from "./JobFairAdmin";
import { CompanyPortal } from "./company/Portal";
import { SpeakerStage } from "./organizer/Speaker";
import { LIVE } from "./mode";
import { ACCOUNT_EVENT, checkSession, currentAccount } from "./account";
import { syncPlayer } from "./player-sync";
import { startPriceSync } from "./prices-sync";
import { startSharedSync } from "./shared-state";

function useHash() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

/** Live site: who is signed in, kept fresh, with the shared event setup and their own progress synced. */
function useLiveAccount() {
  const [account, setAccount] = useState(currentAccount);
  useEffect(() => {
    if (!LIVE) return;
    const on = () => {
      const a = currentAccount();
      setAccount(a);
      startSharedSync(!!a?.fairAdmin, a?.booths ?? []);
      syncPlayer(a);
    };
    window.addEventListener(ACCOUNT_EVENT, on);
    void checkSession().then((a) => {
      startSharedSync(!!a?.fairAdmin, a?.booths ?? []);
      syncPlayer(a);
    });
    return () => window.removeEventListener(ACCOUNT_EVENT, on);
  }, []);
  return account;
}

export function App() {
  const hash = useHash();
  const account = useLiveAccount();
  useEffect(startPriceSync, []);
  // On the live site only event admins run the organiser pages; companies use their portal.
  const organizer = !LIVE || !!account?.fairAdmin;
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
        {organizer && (
          <>
            <a href="#/jobfair/admin" className={route.startsWith("jobfair/admin") && route !== "jobfair/admin/ads" ? "active" : ""}>Panitia job fair</a>
            <a href="#/jobfair/admin/ads" className={route === "jobfair/admin/ads" ? "active" : ""}>📣 Kelola iklan</a>
          </>
        )}
        <a href="#/jobfair/company" className={route.startsWith("jobfair/company") ? "active" : ""}>🏢 Portal perusahaan</a>
        {organizer && <a href="#/jobfair/speaker" className={route === "jobfair/speaker" ? "active" : ""}>🎤 Pembicara</a>}
        {LIVE ? (
          <span className="demo-tag" title="Akun dan lamaran tersimpan di server. Fitur lain masih disambungkan bertahap.">
            Trial
          </span>
        ) : (
          <span className="demo-tag" title="Semua data hanya ada di browser kamu, dan pelamar lain adalah bot. Versi lengkap butuh server.">
            Demo · pengunjung lain bot
          </span>
        )}
      </nav>
      )}
      {route === "jobfair" ? (
        <JobFair />
      ) : (route.startsWith("jobfair/admin") || route === "jobfair/speaker") && !organizer ? (
        <main className="cp">
          <p className="card cp-server-note">Halaman ini khusus panitia. Masuk dengan akun panitia di halaman Job Fair, lalu buka lagi.</p>
        </main>
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
