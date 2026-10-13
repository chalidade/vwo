import "server-only";

/**
 * The old cafe venue pages (/admin, /admin/<slug>, /vwo/<slug> and their /api/venues reads) have no
 * sign-in yet and show who is checked in. The job fair doesn't use them, so in production they
 * answer 404 unless VENUE_PAGES=1.
 */
export const venuePagesOn = () => process.env.NODE_ENV !== "production" || process.env.VENUE_PAGES === "1";
