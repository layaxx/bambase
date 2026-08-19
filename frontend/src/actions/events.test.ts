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

vi.mock("@/utils/api/events", () => ({
  EVENT_CATEGORIES: ["university", "sport", "party", "culture", "social", "other"] as const,
}))

const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/utils/prisma", () => ({
  default: {
    event: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const mockCanModerateEvents = vi.hoisted(() => vi.fn())

vi.mock("@/utils/authz", () => ({
  canModerateEvents: mockCanModerateEvents,
}))

import { events } from "./events"

function makeContext(userId?: string, role: string | null = null) {
  return { locals: { user: userId ? { id: userId, role } : null } }
}

const baseEventInput = {
  title: "Test Event",
  organizer: "Uni",
  description: "A test event",
  start: "2026-06-01T10:00:00Z",
  end: "2026-06-01T12:00:00Z",
  category: "other",
  location_type: "none",
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockCanModerateEvents.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("events.create — location data written to Prisma", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null) // slug is always free
    mockCreate.mockResolvedValue({ slug: "test-event" })
  })

  it("location_type 'none' → mapLocationId and custom location fields are all null", async () => {
    await events.create(
      { ...baseEventInput, location_type: "none" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.mapLocationId).toBeNull()
    expect(data.customLocationName).toBeNull()
  })

  it("location_type 'linked' with map_location_id → sets mapLocationId", async () => {
    await events.create(
      { ...baseEventInput, location_type: "linked", map_location_id: "loc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.mapLocationId).toBe("loc-1")
    expect(data.customLocationName).toBeNull()
  })

  it("location_type 'linked' without map_location_id → falls back to null for both", async () => {
    await events.create(
      { ...baseEventInput, location_type: "linked", map_location_id: undefined },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.mapLocationId).toBeNull()
    expect(data.customLocationName).toBeNull()
  })

  it("location_type 'custom' with name → sets custom location fields", async () => {
    await events.create(
      {
        ...baseEventInput,
        location_type: "custom",
        custom_location_name: "Main Hall",
        custom_location_address: "Hauptstraße 1",
        custom_location_city: "Bamberg",
      },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.customLocationName).toBe("Main Hall")
    expect(data.customLocationAddress).toBe("Hauptstraße 1")
    expect(data.customLocationCity).toBe("Bamberg")
    expect(data.mapLocationId).toBeNull()
  })

  it("location_type 'custom' without name → falls back to null for both", async () => {
    await events.create(
      { ...baseEventInput, location_type: "custom", custom_location_name: undefined },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.mapLocationId).toBeNull()
    expect(data.customLocationName).toBeNull()
  })
})

describe("events.create", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ slug: "test-event" })
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      events.create(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sets ownerId to the current user's id", async () => {
    await events.create(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.ownerId).toBe("user-1")
  })

  it("appends -2 to the slug when the base slug is already taken", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "other-event" }).mockResolvedValueOnce(null)

    await events.create(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("test-event-2")
  })

  it("returns slug from the created event", async () => {
    mockCreate.mockResolvedValue({ slug: "created-slug" })

    const result = await events.create(
      baseEventInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(result).toEqual({ slug: "created-slug" })
  })

  it("throws INTERNAL_SERVER_ERROR when the create fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db error"))

    await expect(
      events.create(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the create fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "test",
      })
    )

    await expect(
      events.create(
        baseEventInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("includes title, organizer, start, end, and category in the data", async () => {
    await events.create(
      { ...baseEventInput, category: "sport" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      title: "Test Event",
      organizer: "Uni",
      category: "sport",
    })
    expect(data.start).toBeInstanceOf(Date)
    expect(data.end).toBeInstanceOf(Date)
  })
})

describe("events.update", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      events.update(
        { ...baseEventInput, id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws NOT_FOUND when the event doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      events.update(
        { ...baseEventInput, id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws FORBIDDEN when the current user does not own the event", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })

    await expect(
      events.update(
        { ...baseEventInput, id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("updates the event and returns its slug when the user is the owner", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    const result = await events.update(
      { ...baseEventInput, id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ev-1" } }))
    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      events.update(
        { ...baseEventInput, id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the update fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "test",
      })
    )

    await expect(
      events.update(
        { ...baseEventInput, id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("events.delete", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      events.delete(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws NOT_FOUND when the event doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      events.delete(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws FORBIDDEN when the current user does not own the event", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })

    await expect(
      events.delete(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("deletes the event and returns {} when the user is the owner", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })

    const result = await events.delete(
      { id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ev-1" } })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockDelete.mockRejectedValue(new Error("db error"))

    await expect(
      events.delete(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("events.unpublish", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      events.unpublish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws NOT_FOUND when the event doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      events.unpublish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws FORBIDDEN when the user neither owns the event nor can moderate events", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })
    mockCanModerateEvents.mockResolvedValue(false)

    await expect(
      events.unpublish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("hides the event and returns {} when the user is the owner", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockResolvedValue({})

    const result = await events.unpublish(
      { id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { hidden: true, rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("stores the given reason", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockResolvedValue({})

    await events.unpublish(
      { id: "ev-1", reason: "Duplicate listing" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { hidden: true, rejectionReason: "Duplicate listing" },
    })
  })

  it("hides the event and returns {} when the user is a moderator (not the owner)", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })
    mockCanModerateEvents.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await events.unpublish(
      { id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("mod-1", "eventModerator")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { hidden: true, rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      events.unpublish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("events.publish", () => {
  it("throws FORBIDDEN when the user neither owns the event nor can moderate events", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })
    mockCanModerateEvents.mockResolvedValue(false)

    await expect(
      events.publish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("unhides the event and returns {} when the user is a moderator", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })
    mockCanModerateEvents.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await events.publish(
      { id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("mod-1", "eventModerator")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { hidden: false, rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("unhides the event and returns {} when the owner republishes their own, non-moderated event", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1", rejectionReason: null })
    mockUpdate.mockResolvedValue({})

    const result = await events.publish(
      { id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { hidden: false, rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("throws FORBIDDEN when the owner tries to republish an event a moderator unpublished with a reason", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1", rejectionReason: "Spam" })
    mockCanModerateEvents.mockResolvedValue(false)

    await expect(
      events.publish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("lets a moderator republish an event that was unpublished with a reason", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else", rejectionReason: "Spam" })
    mockCanModerateEvents.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await events.publish(
      { id: "ev-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("mod-1", "eventModerator")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "ev-1" },
      data: { hidden: false, rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      events.publish(
        { id: "ev-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
