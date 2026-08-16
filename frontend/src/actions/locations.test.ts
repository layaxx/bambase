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

vi.mock("@/utils/api/locations", () => ({
  LOCATION_CATEGORIES: ["university", "mensa", "library", "sport", "venues", "other"] as const,
}))

const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/utils/prisma", () => ({
  default: {
    location: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const mockCanManageLocations = vi.hoisted(() => vi.fn())
vi.mock("@/utils/authz", () => ({
  canManageLocations: mockCanManageLocations,
}))

import { locations } from "./locations"

function makeContext(userId?: string) {
  return { locals: { user: userId ? { id: userId, role: "admin" } : null } }
}

const baseLocationInput = {
  name: "Test Location",
  category: "other",
  lat: 49.9,
  lon: 10.9,
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockCanManageLocations.mockReset()
  mockCanManageLocations.mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("locations.create", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null) // slug is always free
    mockCreate.mockResolvedValue({ slug: "test-location" })
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      locations.create(
        baseLocationInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user lacks the location:manage permission", async () => {
    mockCanManageLocations.mockResolvedValue(false)

    await expect(
      locations.create(
        baseLocationInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("appends -2 to the slug when the base slug is already taken", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "other-location" }).mockResolvedValueOnce(null)

    await locations.create(
      baseLocationInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("test-location-2")
  })

  it("returns slug from the created location", async () => {
    mockCreate.mockResolvedValue({ slug: "created-slug" })

    const result = await locations.create(
      baseLocationInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(result).toEqual({ slug: "created-slug" })
  })

  it("writes name, category, lat, and lon to the data", async () => {
    await locations.create(
      { ...baseLocationInput, category: "sport" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      name: "Test Location",
      category: "sport",
      lat: 49.9,
      lon: 10.9,
    })
  })

  it("falls back to null for optional fields when omitted", async () => {
    await locations.create(
      baseLocationInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.description).toBeNull()
    expect(data.externalUrl).toBeNull()
    expect(data.addressStreet).toBeNull()
    expect(data.addressStreetNumber).toBeNull()
    expect(data.addressCity).toBeNull()
    expect(data.addressZip).toBeNull()
  })

  it("throws BAD_REQUEST when the create fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db error"))

    await expect(
      locations.create(
        baseLocationInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("locations.update", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      locations.update(
        { ...baseLocationInput, id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user lacks the location:manage permission", async () => {
    mockCanManageLocations.mockResolvedValue(false)

    await expect(
      locations.update(
        { ...baseLocationInput, id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("throws NOT_FOUND when the location doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      locations.update(
        { ...baseLocationInput, id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("updates the location and returns its slug", async () => {
    mockFindUnique.mockResolvedValue({ id: "loc-1" })
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    const result = await locations.update(
      { ...baseLocationInput, id: "loc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "loc-1" } }))
    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("throws BAD_REQUEST when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ id: "loc-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      locations.update(
        { ...baseLocationInput, id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("locations.delete", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      locations.delete(
        { id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user lacks the location:manage permission", async () => {
    mockCanManageLocations.mockResolvedValue(false)

    await expect(
      locations.delete(
        { id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("throws NOT_FOUND when the location doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      locations.delete(
        { id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("deletes the location and returns {}", async () => {
    mockFindUnique.mockResolvedValue({ id: "loc-1" })

    const result = await locations.delete(
      { id: "loc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "loc-1" } })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ id: "loc-1" })
    mockDelete.mockRejectedValue(new Error("db error"))

    await expect(
      locations.delete(
        { id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
