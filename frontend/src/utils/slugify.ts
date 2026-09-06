/** Prefix for slugs of names that contain nothing slugifiable, e.g. "日本語のイベント". */
const FALLBACK_PREFIX = "entry"

/** FNV-1a, so the same name always yields the same fallback slug (seed runs stay reproducible). */
function shortHash(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Turns `name` into a URL-safe slug. Characters outside the Latin alphabet are
 * dropped, so names written in other scripts fall back to a hash of the name
 * rather than reducing to the empty string, which would produce an unreachable
 * URL like `/event/`.
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

/** Attempts after the plain slug before giving up and surfacing a confirmed slug conflict. */
const MAX_SLUG_ATTEMPTS = 5

/**
 * Attempts after the plain slug for a conflict the driver did not attribute to a column.
 * One retry is enough to tell the cases apart: a genuine slug conflict is resolved by the
 * first discriminator (1.6M candidates), so a second identical failure means another column.
 */
const MAX_UNATTRIBUTED_ATTEMPTS = 1

/** Four base36 characters, enough to make a repeat collision on the same title unlikely. */
function randomDiscriminator(): string {
  return Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0")
}

/**
 * How a failed insert relates to the slug column:
 * `"slug"` when the driver blamed one, `"unattributed"` for a unique-constraint violation it
 * did not attribute, and `null` for anything that retrying cannot fix.
 *
 * Duck-typed on Prisma's P2002 rather than importing PrismaClientKnownRequestError, because
 * this module is also loaded by the seed script, which runs under plain Node and cannot
 * resolve the `@/` alias. `meta.target` is the column list on some drivers and the constraint
 * name on others (`Event_slug_key`), so both are matched case-insensitively by substring.
 */
function classifyConflict(error: unknown): "slug" | "unattributed" | null {
  if (typeof error !== "object" || error === null) return null
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } }
  if (code !== "P2002") return null
  if (meta?.target === undefined) return "unattributed"
  return JSON.stringify(meta.target).toLowerCase().includes("slug") ? "slug" : null
}

/**
 * Slugifies `name` and calls `create` with it, retrying with a random discriminator
 * (`sommerfest-k3f9`) while the insert reports a slug conflict.
 *
 * Inserting optimistically lets the unique index arbitrate: a pre-flight "is this slug free?"
 * query leaves a gap in which a concurrent create can take the slug, which matters because
 * the UnivIS sync creates events concurrently. It also keeps the common case at a single
 * round trip instead of one query per already-taken suffix.
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
      const conflict = classifyConflict(error)
      if (conflict === null) throw error
      const limit = conflict === "slug" ? MAX_SLUG_ATTEMPTS : MAX_UNATTRIBUTED_ATTEMPTS
      if (attempt >= limit) throw error
    }
  }
}
