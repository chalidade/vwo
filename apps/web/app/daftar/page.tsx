import { openPreregEvents } from "@vwo/db";
import { db } from "@/lib/db";
import { publicEvent } from "@/lib/prereg";
import { EventList } from "./EventList";
import "../soon.css";
import "./daftar.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daftar event · jobfair" };

/** jobfair.co.id/daftar: every event taking pre-registrations now. */
export default async function Page() {
  const events = (await openPreregEvents(db).catch(() => [])).map((r) => publicEvent(r.event, r.count));
  return (
    <div className="cs">
      <div className="cs-glow a" />
      <div className="cs-glow b" />
      <div className="rg pr">
        <header className="cs-top">
          <a href="/">
            <img className="cs-logo" src="/brand/jobfair-logo.png" alt="jobfair.co.id" width={74} height={79} />
          </a>
          <span className="cs-pill">Pra-registrasi pelamar</span>
        </header>
        <h1 className="cs-h1" style={{ fontSize: "clamp(30px, 5vw, 46px)", marginTop: 26 }}>
          Daftar <span className="cs-shine">event</span>
        </h1>
        <p className="cs-sub" style={{ margin: "12px 0 0" }}>
          Daftar sekarang, simpan kodenya, lalu saat acara dibuka cukup masuk dengan akun Google yang sama. Tidak perlu daftar ulang.
        </p>
        {events.length ? (
          <EventList events={events} />
        ) : (
          <p className="rg-card cs-sub" style={{ fontSize: 15 }}>
            Belum ada event yang membuka pendaftaran. Cek lagi nanti, ya.
          </p>
        )}
      </div>
    </div>
  );
}
