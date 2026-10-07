import type { getLiveSnapshot, getVenueLayout } from "@vwo/db";

export type VenueLayout = Awaited<ReturnType<typeof getVenueLayout>>;
export type FloorLayout = VenueLayout[number];
export type LiveSnapshot = Awaited<ReturnType<typeof getLiveSnapshot>>;
