export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" })[c] ?? c)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Appends -2, -3, ... to `base` until `exists` reports the slug is free.
 * Kept independent of any specific data layer so both the Prisma seed script
 * and the live app can supply their own existence check.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = base
  let suffix = 2
  // eslint-disable-next-line no-await-in-loop -- each check depends on the previous suffix
  while (await exists(slug)) {
    slug = `${base}-${suffix}`
    suffix++
  }
  return slug
}

/**
 * Slugifies `name` and appends -2, -3, ... until `findBySlug` reports no match.
 */
export async function createUniqueSlug(
  findBySlug: (slug: string) => Promise<unknown>,
  name: string
): Promise<string> {
  return uniqueSlug(slugify(name), async (candidate) => (await findBySlug(candidate)) != null)
}
