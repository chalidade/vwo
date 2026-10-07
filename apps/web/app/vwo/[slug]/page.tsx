import { notFound } from "next/navigation";
import { getVenueBySlug, getVenueLayout } from "@vwo/db";
import { db } from "@/lib/db";
import { World } from "./World";

export const dynamic = "force-dynamic";

export default async function VenueWorld({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getVenueBySlug(db, slug);
  if (!venue) notFound();
  const floors = await getVenueLayout(db, venue.id);
  return (
    <main>
      <h1>{venue.name}</h1>
      <World
        slug={venue.slug}
        floors={floors}
        realtimeUrl={process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001"}
        devCheckin={process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_CHECKIN === "1"}
      />
    </main>
  );
}
