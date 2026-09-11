import { describe, expect, it, vi } from "vitest"
import { createWithUniqueSlug, slugify } from "./slugify"

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Sommerfest 2026")).toBe("sommerfest-2026")
  })

  it("transliterates German characters", () => {
    expect(slugify("Grüße aus Bamberg")).toBe("gruesse-aus-bamberg")
    expect(slugify("Öffnungszeiten")).toBe("oeffnungszeiten")
  })

  it("strips accents and trims stray hyphens", () => {
    expect(slugify("  Café -- Crème  ")).toBe("cafe-creme")
  })

  it.each([
    ["Japanese", "日本語のイベント"],
    ["Cyrillic", "Праздник"],
    ["Greek", "Πανηγύρι"],
    ["emoji only", "🎉🎉"],
    ["punctuation only", "!!! ???"],
    ["empty", ""],
  ])("returns a usable slug for a %s name", (_label, name) => {
    const slug = slugify(name)
    expect(slug).toMatch(/^entry-[a-z0-9]+$/)
  })

  it("is stable for the same name and differs between names", () => {
    expect(slugify("日本語のイベント")).toBe(slugify("日本語のイベント"))
    expect(slugify("日本語のイベント")).not.toBe(slugify("Праздник"))
  })
})

/** Makes the Prisma unique-constraint error that the database gives on a duplicate insert. */
function uniqueViolation(target?: string[] | string) {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target } })
}

describe("createWithUniqueSlug", () => {
  it("creates with the plain slug in a single attempt", async () => {
    const create = vi.fn(async (slug: string) => ({ slug }))

    await expect(createWithUniqueSlug("Sommerfest 2026", create)).resolves.toEqual({
      slug: "sommerfest-2026",
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("retries with a discriminator when the slug is taken", async () => {
    const create = vi
      .fn(async (slug: string) => ({ slug }))
      .mockRejectedValueOnce(uniqueViolation(["slug"]))

    const result = await createWithUniqueSlug("Stammtisch", create)

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0]).toBe("stammtisch")
    expect(result.slug).toMatch(/^stammtisch-[a-z0-9]{4}$/)
  })

  it.each(["event_slug_key", "Event_Slug_key"])(
    "recognises a conflict reported as the constraint name %s",
    async (constraint) => {
      const create = vi
        .fn(async (slug: string) => ({ slug }))
        .mockRejectedValueOnce(uniqueViolation(constraint))

      await expect(createWithUniqueSlug("Stammtisch", create)).resolves.toBeDefined()
      expect(create).toHaveBeenCalledTimes(2)
    }
  )

  it("retries when the driver reports no target", async () => {
    const create = vi
      .fn(async (slug: string) => ({ slug }))
      .mockRejectedValueOnce(uniqueViolation())

    await expect(createWithUniqueSlug("Stammtisch", create)).resolves.toBeDefined()
    expect(create).toHaveBeenCalledTimes(2)
  })

  it("rethrows a conflict on another unique column without retrying", async () => {
    const create = vi.fn().mockRejectedValue(uniqueViolation(["externalId"]))

    await expect(createWithUniqueSlug("Stammtisch", create)).rejects.toMatchObject({
      code: "P2002",
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("rethrows an unrelated error without retrying", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection lost"))

    await expect(createWithUniqueSlug("Stammtisch", create)).rejects.toThrow("connection lost")
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("gives up after a bounded number of attempts on a confirmed slug conflict", async () => {
    const create = vi.fn().mockRejectedValue(uniqueViolation(["slug"]))

    await expect(createWithUniqueSlug("Stammtisch", create)).rejects.toMatchObject({
      code: "P2002",
    })
    expect(create).toHaveBeenCalledTimes(6)
  })

  it("uses the non-Latin fallback base for its retries", async () => {
    const create = vi
      .fn(async (slug: string) => ({ slug }))
      .mockRejectedValueOnce(uniqueViolation(["slug"]))

    const result = await createWithUniqueSlug("日本語のイベント", create)

    expect(result.slug).toMatch(new RegExp(`^${slugify("日本語のイベント")}-[a-z0-9]{4}$`))
  })
})
