import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:actions", () => ({
  defineAction: ({ handler }: never) => handler,
  ActionError: class extends Error {
    code: string
    constructor({ code, message }: { code: string; message: string }) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock("astro/zod", async () => await import("zod"))

vi.mock("@/utils/api", () => ({ strapiUrl: "http://localhost:1337" }))

vi.mock("@/utils/api/events", () => ({
  EVENT_CATEGORIES: ["university", "sport", "party", "culture", "social", "other"] as const,
}))

import { events } from "./events"
import { getFetchBody, makeCookies } from "./test-helpers"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const baseEventInput = {
  documentId: "doc-ev-1",
  title: "Test Event",
  organizer: "Uni",
  description: "A test event",
  start: "2026-06-01T10:00:00Z",
  end: "2026-06-01T12:00:00Z",
  category: "other",
  location_type: "none",
}

describe("events.create — location data in request body", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("location_type 'none' → map_location and custom_location are both null", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      { ...baseEventInput, location_type: "none" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body.map_location).toBeNull()
    expect(body.custom_location).toBeNull()
  })

  it("location_type 'linked' with map_location_id → sets map_location.connect", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      { ...baseEventInput, location_type: "linked", map_location_id: "loc-doc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body.map_location).toEqual({ connect: [{ documentId: "loc-doc-1" }] })
    expect(body.custom_location).toBeNull()
  })

  it("location_type 'linked' without map_location_id → falls back to null for both", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      { ...baseEventInput, location_type: "linked", map_location_id: undefined },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body.map_location).toBeNull()
    expect(body.custom_location).toBeNull()
  })

  it("location_type 'custom' with name → sets custom_location object", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      {
        ...baseEventInput,
        location_type: "custom",
        custom_location_name: "Main Hall",
        custom_location_address: "Hauptstraße 1",
        custom_location_city: "Bamberg",
      },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body.custom_location).toEqual({
      name: "Main Hall",
      address: "Hauptstraße 1",
      city: "Bamberg",
    })
    expect(body.map_location).toBeNull()
  })

  it("location_type 'custom' without name → falls back to null for both", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      { ...baseEventInput, location_type: "custom", custom_location_name: undefined },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body.map_location).toBeNull()
    expect(body.custom_location).toBeNull()
  })

  it("location_type 'custom' with name but no address or city → omits optional fields", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      { ...baseEventInput, location_type: "custom", custom_location_name: "Hall" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body.custom_location.name).toBe("Hall")
    expect(body.custom_location.address).toBeUndefined()
    expect(body.custom_location.city).toBeUndefined()
  })
})

describe("events.delete", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      events.delete(
        { documentId: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sends DELETE to the correct endpoint URL", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await events.delete(
      { documentId: "ev-abc" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/events/ev-abc",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("includes the Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await events.delete(
      { documentId: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("my-token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    )
  })

  it("throws FORBIDDEN when the API returns a non-ok response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      events.delete(
        { documentId: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("returns {} on success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    const result = await events.delete(
      { documentId: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )
    expect(result).toEqual({})
  })
})

describe("events.update", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      events.update(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("sends PUT to the correct documentId URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "updated-slug" } }),
    } as Response)

    await events.update(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/events/doc-ev-1",
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("returns slug from the API response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "my-event-slug" } }),
    } as Response)

    const result = await events.update(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(result).toEqual({ slug: "my-event-slug" })
  })

  it("throws BAD_REQUEST when the API returns an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      events.update(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("events.create", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      events.create(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sends POST to /api/events", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "new-slug" } }),
    } as Response)

    await events.create(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/events",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("returns slug from the API response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "created-slug" } }),
    } as Response)

    const result = await events.create(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(result).toEqual({ slug: "created-slug" })
  })

  it("throws BAD_REQUEST when the API rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      events.create(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("includes title, organizer, start, end, and category in the body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "s" } }),
    } as Response)

    await events.create(
      { ...baseEventInput, category: "sport" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody().data
    expect(body).toMatchObject({
      title: "Test Event",
      organizer: "Uni",
      start: "2026-06-01T10:00:00Z",
      end: "2026-06-01T12:00:00Z",
      category: "sport",
    })
  })
})
