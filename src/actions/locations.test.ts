import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@/generated/prisma/client"

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

const mockCreate = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/utils/prisma", () => ({
  default: {
    location: {
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

/** The error that Prisma gives when an update or a delete finds no row. */
function recordNotFound() {
  return new Prisma.PrismaClientKnownRequestError("Record to update not found", {
    code: "P2025",
    clientVersion: "test",
  })
}

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

  it("retries with a discriminated slug when the create hits the unique index", async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate slug"), { code: "P2002", meta: { target: ["slug"] } })
    )

    await locations.create(
      baseLocationInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("test-location")
    expect(mockCreate.mock.calls[1][0].data.slug).toMatch(/^test-location-[a-z0-9]{4}$/)
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

  it("throws INTERNAL_SERVER_ERROR when the create fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db error"))

    await expect(
      locations.create(
        baseLocationInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the create fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )

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
    mockUpdate.mockRejectedValue(recordNotFound())

    await expect(
      locations.update(
        { ...baseLocationInput, id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("updates the location and returns its slug", async () => {
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    const result = await locations.update(
      { ...baseLocationInput, id: "loc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "loc-1" } }))
    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      locations.update(
        { ...baseLocationInput, id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the update fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )

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
    mockDelete.mockRejectedValue(recordNotFound())

    await expect(
      locations.delete(
        { id: "loc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("deletes the location and returns {}", async () => {
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
