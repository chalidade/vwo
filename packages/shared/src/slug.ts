export const SLUG_PATTERN = /^[a-z0-9-]{3,48}$/;

/** Paths that would collide with app routes if used as a venue slug. */
export const RESERVED_SLUGS = new Set(["admin", "api", "vwo", "login", "logout", "static", "assets", "new"]);

export function isValidVenueSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug) && !slug.startsWith("-") && !slug.endsWith("-");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
