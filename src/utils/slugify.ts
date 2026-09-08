/** Prefix for the slug of a name with no usable characters, for example "日本語のイベント". */
const FALLBACK_PREFIX = "entry"

/**
 * Calculates an FNV-1a hash. The same name always gives the same fallback slug,
 * thus seed runs stay reproducible.
 */
function shortHash(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Makes a URL-safe slug from `name`. The slug keeps only Latin letters and digits.
 * A name in a different script thus becomes an empty string. In that case the slug
 * uses a hash of the name, because an empty slug gives an unusable URL like `/event/`.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[äöü]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue" })[c] ?? c)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return base || `${FALLBACK_PREFIX}-${shortHash(name.trim())}`
}

/**
 * Number of attempts with a discriminator after the plain slug.
 * After the last attempt the conflict goes to the caller.
 */
const MAX_SLUG_ATTEMPTS = 5

/** Four base36 characters. This makes a second collision on the same title unlikely. */
function randomDiscriminator(): string {
  return Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0")
}

/**
 * Tells if a failed insert is a slug conflict that a retry can clear.
 * A P2002 error that names a different unique column is not a slug conflict, and the caller
 * rethrows it. Event and JobOffer also have a unique `externalId`. A P2002 error that names
 * no column does count as a slug conflict, because a retry is the safe action when the
 * column is unknown.
 *
 * The check reads the fields of the error and does not import PrismaClientKnownRequestError.
 * The seed script also loads this module, and it runs under plain Node, which cannot resolve
 * the `@/` alias. Some drivers put the column list in `meta.target`, other drivers put the
 * constraint name there (`Event_slug_key`). The check thus looks for the substring "slug" in
 * both forms, and ignores the case of the letters.
 */
function isSlugConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } }
  if (code !== "P2002") return false
  if (meta?.target === undefined) return true
  return JSON.stringify(meta.target).toLowerCase().includes("slug")
}

/**
 * Makes a slug from `name` and calls `create` with it. While the insert reports a slug
 * conflict, it does the insert again with a random discriminator (`sommerfest-k3f9`).
 *
 * The direct insert lets the unique index make the decision. A preliminary "is this slug
 * free?" query leaves a gap in which a concurrent create takes the same slug. This is
 * important, because the UnivIS sync creates events concurrently. The direct insert also
 * keeps the usual case at one round trip, and not one query for each taken suffix.
 */
export async function createWithUniqueSlug<T>(
  name: string,
  create: (slug: string) => Promise<T>
): Promise<T> {
  const base = slugify(name)

  for (let attempt = 0; ; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomDiscriminator()}`
    try {
      // eslint-disable-next-line no-await-in-loop -- retries are sequential by nature
      return await create(slug)
    } catch (error) {
      if (!isSlugConflict(error) || attempt >= MAX_SLUG_ATTEMPTS) throw error
    }
  }
}
