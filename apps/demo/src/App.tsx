import { Suspense, lazy, useEffect, useState } from "react";
import { Landing } from "./Landing";
import { LIVE } from "./mode";
import { fair } from "./useFair";
import { ACCOUNT_EVENT, checkSession, currentAccount } from "./account";
import { startCoinSync } from "./coin-sync";
import { startPaymentSync } from "./payments";
import { syncPlayer } from "./player-sync";
import { preregWelcome } from "./prereg";
import { startPriceSync } from "./prices-sync";
import { startReviewSync } from "./review-sync";
import { startStatsSync } from "./stats-sync";
import { startSharedSync } from "./shared-state";
import { claimStoredRef } from "./fair/viral";
import { pullSeminarRegs } from "./fair/seminar-reg";
import { startConsultSync } from "./consult";
import { loadRuntimeConfig } from "./runtime-config";

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
    // The server's polling limits; until they come, the defaults.
    void loadRuntimeConfig();
    const on = () => {
      const a = currentAccount();
      setAccount(a);
      startSharedSync(!!a?.fairAdmin, a?.booths ?? []);
      if (a) startCoinSync();
      syncPlayer(a);
      if (a) startPaymentSync();
      startReviewSync();
      startStatsSync(!!a, !!a?.fairAdmin || !!a?.booths?.length);
      // Registered seminars feed the game's reminders ("15 menit lagi").
      void pullSeminarRegs(true);
      void claimStoredRef(a).then((msg) => msg && fair.notices.push(msg));
      void preregWelcome(a).then((msg) => msg && fair.notices.push(msg));
    };
    window.addEventListener(ACCOUNT_EVENT, on);
    void checkSession().then((a) => {
      startSharedSync(!!a?.fairAdmin, a?.booths ?? []);
      if (a) startCoinSync();
      syncPlayer(a);
      if (a) startPaymentSync();
      startReviewSync();
      startStatsSync(!!a, !!a?.fairAdmin || !!a?.booths?.length);
      // Registered seminars feed the game's reminders ("15 menit lagi").
      void pullSeminarRegs(true);
      void claimStoredRef(a).then((msg) => msg && fair.notices.push(msg));
      void preregWelcome(a).then((msg) => msg && fair.notices.push(msg));
    });
    return () => window.removeEventListener(ACCOUNT_EVENT, on);
  }, []);
  return account;
}

// The game and the dashboards load only when opened, so the home page and the light mode stay small
// on cheap phones and slow connections.
const JobFair = lazy(() => import("./JobFair").then((m) => ({ default: m.JobFair })));
const JobFairAdmin = lazy(() => import("./JobFairAdmin").then((m) => ({ default: m.JobFairAdmin })));
const CompanyPortal = lazy(() => import("./company/Portal").then((m) => ({ default: m.CompanyPortal })));
const InvoicePage = lazy(() => import("./fair/Invoices").then((m) => ({ default: m.InvoicePage })));
const InvoicesPage = lazy(() => import("./fair/Invoices").then((m) => ({ default: m.InvoicesPage })));
const SpeakerStage = lazy(() => import("./organizer/Speaker").then((m) => ({ default: m.SpeakerStage })));
const LiteMode = lazy(() => import("./lite/Lite").then((m) => ({ default: m.LiteMode })));
const ConsultantPage = lazy(() => import("./fair/Consultant").then((m) => ({ default: m.ConsultantPage })));

export function App() {
  const hash = useHash();
  const account = useLiveAccount();
  useEffect(startPriceSync, []);
  // The offline demo seats this browser's consultants in the lounge (live: the shared setup does).
  useEffect(startConsultSync, []);
  // On the live site only event admins run the organiser pages; companies use their portal.
  const organizer = !LIVE || !!account?.fairAdmin;
  const route = hash.replace(/^#\/?/, "");
  // In a room the game takes the whole screen; the way back home is on the title screen.
  const game = route === "jobfair";
  const lite = route === "ringan";
  const home = !route.startsWith("jobfair") && !lite;
  // The organiser pages and the company portal use the light dashboard look.
  const dash =
    route.startsWith("jobfair/admin") || route.startsWith("jobfair/company") || route.startsWith("jobfair/invoice") || route === "jobfair/speaker" || route === "jobfair/konsultan";
  return (
    <div className={game ? "app app-game" : home ? "app app-home" : dash ? "app app-dash" : lite ? "app app-lite" : "app"}>
      <Suspense fallback={<p className="app-loading">Memuat…</p>}>
        {lite ? (
          <LiteMode />
        ) : route === "jobfair" ? (
          <JobFair />
        ) : (route.startsWith("jobfair/admin") || route === "jobfair/speaker") && !organizer ? (
          <main className="cp">
            <p className="card cp-server-note">
              Halaman ini khusus panitia. Masuk dengan akun panitia di halaman Job Fair, lalu buka lagi. <a href="#/jobfair">Ke Job Fair</a>
            </p>
          </main>
        ) : route.startsWith("jobfair/admin") ? (
          <JobFairAdmin tab={route.split("/")[2]} />
        ) : route === "jobfair/speaker" ? (
          <SpeakerStage />
        ) : route === "jobfair/konsultan" ? (
          <ConsultantPage />
        ) : route.startsWith("jobfair/invoice/") ? (
          <InvoicePage id={route.split("/")[2] ?? ""} />
        ) : route === "jobfair/invoices" ? (
          <InvoicesPage />
        ) : route.startsWith("jobfair/company") ? (
          <CompanyPortal boothId={route.split("/")[2]} />
        ) : (
          <Landing />
        )}
      </Suspense>
    </div>
  );
}
