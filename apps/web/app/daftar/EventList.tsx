import type { PublicPreregEvent } from "@vwo/shared";

/** Events taking sign-ups, each with its "Daftar" button: on the landing page and on /daftar. */
export function EventList({ events }: { events: PublicPreregEvent[] }) {
  return (
    <ul className="pr-events">
      {events.map((e) => (
        <li key={e.slug} className="pr-event">
          {e.banner && <img src={e.banner} alt="" />}
          <div>
            <b>{e.name}</b>
            <span>{[e.date, e.location].filter(Boolean).join(" · ")}</span>
            {e.about && <p>{e.about}</p>}
          </div>
          <a className="cs-btn primary" href={`/daftar/${e.slug}`}>
            Daftar →
          </a>
        </li>
      ))}
    </ul>
  );
}
