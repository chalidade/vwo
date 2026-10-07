import Link from "next/link";
import { getLiveSnapshot, schema } from "@vwo/db";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// TODO(auth): only super_admin and venue members should see this.
export default async function AdminHome() {
  const venues = await db.select().from(schema.venues).orderBy(schema.venues.name);
  const rows = await Promise.all(venues.map(async (v) => ({ venue: v, live: await getLiveSnapshot(db, v.id) })));
  return (
    <main>
      <h1>Admin panel</h1>
      <table className="list">
        <thead>
          <tr>
            <th>Cafe</th>
            <th>Link publik</th>
            <th>Orang di dalam</th>
            <th>Kursi kosong</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ venue, live }) => (
            <tr key={venue.id}>
              <td>
                <Link href={`/admin/${venue.slug}`}>{venue.name}</Link>
              </td>
              <td>
                <Link href={`/vwo/${venue.slug}`}>/vwo/{venue.slug}</Link>
              </td>
              <td>{live.peopleInside}</td>
              <td>
                {live.seatsFree} / {live.seatsTotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
