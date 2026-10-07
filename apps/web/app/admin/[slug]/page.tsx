import { notFound } from "next/navigation";
import { getVenueBySlug, getVenueLayout } from "@vwo/db";
import { db } from "@/lib/db";
import { LiveView } from "./LiveView";

export const dynamic = "force-dynamic";

export default async function VenueAdmin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getVenueBySlug(db, slug);
  if (!venue) notFound();
  const floors = await getVenueLayout(db, venue.id);
  return (
    <main>
      <h1>{venue.name} · Live</h1>
      <LiveView slug={venue.slug} floors={floors} />
    </main>
  );
}
