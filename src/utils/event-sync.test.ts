import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCalendar = vi.hoisted(() => vi.fn())
vi.mock("univis-api", () => ({
  UnivISClient: class {
    getCalendar = mockGetCalendar
  },
}))

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockDeleteMany = vi.hoisted(() => vi.fn())
vi.mock("./prisma", () => ({
  default: {
    event: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
      deleteMany: mockDeleteMany,
    },
  },
}))

import { syncUnivisEvents } from "./event-sync"

function makeUnivisEvent(overrides: Record<string, unknown> = {}) {
  return {
    _key: "123",
    title: "Vorlesung Mathematik",
    startdate: "2026-08-20",
    enddate: "2026-08-20",
    starttime: "10:00:00",
    endtime: "12:00:00",
    orgname: "Fakultät WIAI",
    description: "Beschreibung",
    url: "https://univis.example/123",
    ...overrides,
  }
}

beforeEach(() => {
  mockGetCalendar.mockReset()
  mockFindMany.mockReset().mockResolvedValue([])
  mockFindUnique.mockReset().mockResolvedValue(null)
  mockUpdate.mockReset().mockResolvedValue({})
  mockCreate.mockReset().mockResolvedValue({})
  mockDeleteMany.mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("syncUnivisEvents", () => {
  it("throws when fetching the UniVis calendar fails", async () => {
    mockGetCalendar.mockRejectedValue(new Error("timeout"))

    await expect(syncUnivisEvents()).rejects.toThrow(/timeout/)

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("timeout"))
  })

  it("resolves without throwing when the fetch succeeds", async () => {
    mockGetCalendar.mockResolvedValue([])

    await expect(syncUnivisEvents()).resolves.toBeUndefined()
  })

  it("skips events missing required fields without creating or updating anything", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent({ title: "" })])

    await syncUnivisEvents()

    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("missing required fields"))
  })

  it("creates a new event with a slug derived from the title when no existing match is found", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])

    await syncUnivisEvents()

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Vorlesung Mathematik",
        category: "university",
        externalId: "univis:123",
        organizer: "Fakultät WIAI",
        slug: "vorlesung-mathematik",
      }),
    })
  })

  it("retries with a discriminated slug when the create hits the unique index", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate slug"), { code: "P2002", meta: { target: ["slug"] } })
    )

    await syncUnivisEvents()

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("vorlesung-mathematik")
    expect(mockCreate.mock.calls[1][0].data.slug).toMatch(/^vorlesung-mathematik-[a-z0-9]{4}$/)
  })

  it("updates an existing, non-hidden event that matches by externalId", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])
    mockFindMany.mockResolvedValue([{ id: "evt-1", externalId: "univis:123", hidden: false }])

    await syncUnivisEvents()

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: expect.objectContaining({ externalId: "univis:123" }),
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("does not update a matching event that has been hidden", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])
    mockFindMany.mockResolvedValue([{ id: "evt-1", externalId: "univis:123", hidden: true }])

    await syncUnivisEvents()

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("does not delete a hidden event as stale even though it was not seen in this run", async () => {
    mockGetCalendar.mockResolvedValue([])
    mockFindMany.mockResolvedValue([{ id: "evt-1", externalId: "univis:999", hidden: true }])

    await syncUnivisEvents()

    expect(mockDeleteMany).not.toHaveBeenCalled()
  })

  it("logs and continues (without throwing) when updating an event fails", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])
    mockFindMany.mockResolvedValue([{ id: "evt-1", externalId: "univis:123", hidden: false }])
    mockUpdate.mockRejectedValue(new Error("db unavailable"))

    await expect(syncUnivisEvents()).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("db unavailable"))
  })

  it("logs and continues (without throwing) when creating an event fails", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])
    mockCreate.mockRejectedValue(new Error("db unavailable"))

    await expect(syncUnivisEvents()).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("db unavailable"))
  })

  it("deletes non-hidden events that previously synced from UniVis but were not seen this run", async () => {
    mockGetCalendar.mockResolvedValue([])
    mockFindMany.mockResolvedValue([
      { id: "evt-1", externalId: "univis:111", hidden: false },
      { id: "evt-2", externalId: "univis:222", hidden: false },
    ])

    await syncUnivisEvents()

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["evt-1", "evt-2"] } },
    })
  })

  it("does not delete events that were seen again in this run", async () => {
    mockGetCalendar.mockResolvedValue([makeUnivisEvent()])
    mockFindMany.mockResolvedValue([{ id: "evt-1", externalId: "univis:123", hidden: false }])

    await syncUnivisEvents()

    expect(mockDeleteMany).not.toHaveBeenCalled()
  })
})
