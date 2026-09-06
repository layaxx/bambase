import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchAllPublishedEventSlugs,
  fetchEvents,
  fetchEvent,
  fetchMyEvents,
  fetchOngoingOrUpcomingEvents,
  fetchUpcomingMapEvents,
} from "./events"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    event: { findMany: mockFindMany, findFirst: mockFindFirst },
  },
}))

vi.mock("./cache", () => ({
  withCache: (_key: string, fn: () => Promise<unknown>) => fn(),
}))

beforeEach(() => {
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
})

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "abc123",
    slug: "test-event",
    title: "Test Event",
    description: "A test",
    category: "other",
    start: new Date("2026-04-15T10:00:00Z"),
    end: new Date("2026-04-15T12:00:00Z"),
    organizer: "Test Org",
    externalUrl: null,
    externalId: null,
    ownerId: null,
    customLocationName: null,
    customLocationAddress: null,
    customLocationCity: null,
    ...overrides,
  }
}

const mappedSampleEvent = {
  id: "abc123",
  slug: "test-event",
  title: "Test Event",
  description: "A test",
  start: "2026-04-15T10:00:00.000Z",
  end: "2026-04-15T12:00:00.000Z",
  organizer: "Test Org",
  category: "other",
  external_url: undefined,
  external_id: undefined,
  ownerId: null,
  reports: undefined,
  map_location: undefined,
  custom_location: undefined,
}

describe("fetchEvents", () => {
  it("sorts results by start ascending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchEvents()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { start: "asc" } })
    )
  })

  it("excludes hidden events", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchEvents()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ hidden: false }) })
    )
  })

  it("uses the default limit of 100", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchEvents()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
  })

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchEvents(25)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }))
  })

  it("returns mapped events from the response", async () => {
    mockFindMany.mockResolvedValue([makeRow()])

    const result = await fetchEvents()

    expect(result).toEqual({ data: [mappedSampleEvent], apiDown: false })
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null) // null.map throws TypeError inside the try block

    const result = await fetchEvents()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching events", expect.any(TypeError))
  })
})

describe("fetchEvent", () => {
  it("filters by the given slug and excludes hidden events", async () => {
    mockFindFirst.mockResolvedValue(makeRow())

    await fetchEvent("test-event")

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "test-event", hidden: false } })
    )
  })

  it("filters reports to non-dismissed and includes the map location", async () => {
    mockFindFirst.mockResolvedValue(makeRow())

    await fetchEvent("test-event")

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          reports: { where: { reviewStatus: { not: "dismissed" } }, select: { id: true } },
          mapLocation: true,
        }),
      })
    )
  })

  it("returns the mapped event", async () => {
    mockFindFirst.mockResolvedValue(makeRow())

    const result = await fetchEvent("test-event")

    expect(result).toEqual({ data: mappedSampleEvent, apiDown: false })
  })

  it("returns null when no event matches", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await fetchEvent("no-such-event")

    expect(result).toEqual({ data: null, apiDown: false })
  })

  it("logs an error and returns null when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindFirst.mockRejectedValue(new Error("connection refused"))

    const result = await fetchEvent("test-event")

    expect(result).toEqual({ data: null, apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching event", expect.any(Error))
  })
})

describe("fetchOngoingOrUpcomingEvents", () => {
  it("sorts results by start ascending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchOngoingOrUpcomingEvents()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { start: "asc" } })
    )
  })

  it("uses the default limit of 100", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchOngoingOrUpcomingEvents()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
  })

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchOngoingOrUpcomingEvents(50)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it("returns mapped events from the response", async () => {
    mockFindMany.mockResolvedValue([makeRow()])

    const result = await fetchOngoingOrUpcomingEvents()

    expect(result).toEqual({ data: [mappedSampleEvent], apiDown: false })
  })

  it("uses an OR filter combining today's events and currently-ongoing events", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchOngoingOrUpcomingEvents()

    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR[0].start.gte).toBeInstanceOf(Date)
    expect(call.where.OR[0].start.lte).toBeInstanceOf(Date)
    expect(call.where.OR[1].start.lte).toBeInstanceOf(Date)
    expect(call.where.OR[1].end.gte).toBeInstanceOf(Date)
  })

  it("excludes hidden events", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchOngoingOrUpcomingEvents()

    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.hidden).toBe(false)
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null)

    const result = await fetchOngoingOrUpcomingEvents()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching events", expect.any(TypeError))
  })
})

describe("fetchUpcomingMapEvents", () => {
  it("sorts results by start ascending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchUpcomingMapEvents()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { start: "asc" } })
    )
  })

  it("uses the default limit of 200", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchUpcomingMapEvents()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }))
  })

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchUpcomingMapEvents(50)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it("filters to events where end >= now, map location is set, and not hidden", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchUpcomingMapEvents()

    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.end.gte).toBeInstanceOf(Date)
    expect(call.where.mapLocationId).toEqual({ not: null })
    expect(call.where.hidden).toBe(false)
  })

  it("includes the map location", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchUpcomingMapEvents()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { mapLocation: true } })
    )
  })

  it("returns mapped events including the map location when present", async () => {
    mockFindMany.mockResolvedValue([
      makeRow({
        mapLocation: {
          id: "loc-1",
          slug: "audimax",
          name: "Audimax",
          description: null,
          lat: 49.9,
          lon: 10.9,
          category: "university",
          externalUrl: null,
          addressStreet: null,
          addressStreetNumber: null,
          addressCity: null,
          addressZip: null,
        },
      }),
    ])

    const result = await fetchUpcomingMapEvents()

    expect(result.apiDown).toBe(false)
    expect(result.data[0].map_location).toEqual(
      expect.objectContaining({ id: "loc-1", slug: "audimax", name: "Audimax" })
    )
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null)

    const result = await fetchUpcomingMapEvents()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching upcoming events", expect.any(TypeError))
  })
})

describe("fetchAllPublishedEventSlugs", () => {
  it("selects only the slug field", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllPublishedEventSlugs()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ select: { slug: true } }))
  })

  it("uses the default limit of 500", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllPublishedEventSlugs()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }))
  })

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllPublishedEventSlugs(50)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it("returns plain slug strings", async () => {
    mockFindMany.mockResolvedValue([{ slug: "test-event" }, { slug: "another-event" }])

    const result = await fetchAllPublishedEventSlugs()

    expect(result).toEqual({ data: ["test-event", "another-event"], apiDown: false })
  })

  it("excludes hidden events", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllPublishedEventSlugs()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hidden: false } }))
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null)

    const result = await fetchAllPublishedEventSlugs()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching event slugs for sitemap",
      expect.any(TypeError)
    )
  })
})

describe("fetchMyEvents", () => {
  it("filters by the given ownerId and sorts by start descending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchMyEvents("user-42")

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ownerId: "user-42" },
      orderBy: { start: "desc" },
    })
  })

  it("returns mapped events from the response", async () => {
    mockFindMany.mockResolvedValue([makeRow()])

    const result = await fetchMyEvents("user-42")

    expect(result).toEqual({ data: [mappedSampleEvent], apiDown: false })
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("connection refused"))

    const result = await fetchMyEvents("user-42")

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching own events", expect.any(Error))
  })
})
