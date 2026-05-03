import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchAllPublishedEventSlugs,
  fetchEvents,
  fetchEvent,
  fetchMyEvents,
  fetchOngoingOrUpcomingEvents,
  fetchUpcomingMapEvents,
} from "./events"

const mockFind = vi.hoisted(() => vi.fn())
const mockCollection = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: { collection: mockCollection },
  strapiUrl: "http://localhost:1337",
}))

beforeEach(() => {
  mockFind.mockReset()
  mockCollection.mockReturnValue({ find: mockFind })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const sampleEvent = {
  documentId: "abc123",
  slug: "test-event",
  title: "Test Event",
  description: "A test",
  start: "2026-04-15T10:00:00Z",
  end: "2026-04-15T12:00:00Z",
  organizer: "Test Org",
}

describe("fetchEvents", () => {
  it("sorts results by start ascending", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchEvents()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ sort: ["start:asc"] }))
  })

  it("uses the default limit of 100", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchEvents()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 100 } }))
  })

  it("respects a custom limit", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchEvents(25)

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 25 } }))
  })

  it("returns the data array from the response", async () => {
    mockFind.mockResolvedValue({ data: [sampleEvent] })

    const result = await fetchEvents()

    expect(result).toEqual([sampleEvent])
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null) // null.data throws TypeError inside the try block

    const result = await fetchEvents()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching events", expect.any(TypeError))
  })
})

describe("fetchEvent", () => {
  it("filters by the given slug", async () => {
    mockFind.mockResolvedValue({ data: [sampleEvent] })

    await fetchEvent("test-event")

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { slug: { $eq: "test-event" } },
      })
    )
  })

  it("populates owner and filters reports to non-dismissed with empty fields", async () => {
    mockFind.mockResolvedValue({ data: [sampleEvent] })

    await fetchEvent("test-event")

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        populate: expect.objectContaining({
          owner: true,
          reports: {
            filters: { review_status: { $ne: "dismissed" } },
            fields: [],
          },
        }),
      })
    )
  })

  it("returns the first item from the data array", async () => {
    mockFind.mockResolvedValue({ data: [sampleEvent] })

    const result = await fetchEvent("test-event")

    expect(result).toEqual(sampleEvent)
  })

  it("returns null when no event matches", async () => {
    mockFind.mockResolvedValue({ data: [] })

    const result = await fetchEvent("no-such-event")

    expect(result).toBeNull()
  })

  it("logs an error and returns null when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null) // null.data throws TypeError inside the try block

    const result = await fetchEvent("test-event")

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching event", expect.any(TypeError))
  })
})

describe("fetchOngoingOrUpcomingEvents", () => {
  it("sorts results by start ascending", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchOngoingOrUpcomingEvents()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ sort: ["start:asc"] }))
  })

  it("uses the default limit of 100", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchOngoingOrUpcomingEvents()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 100 } }))
  })

  it("respects a custom limit", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchOngoingOrUpcomingEvents(50)

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 50 } }))
  })

  it("returns the data array from the response", async () => {
    mockFind.mockResolvedValue({ data: [sampleEvent] })

    const result = await fetchOngoingOrUpcomingEvents()

    expect(result).toEqual([sampleEvent])
  })

  it("uses a $or filter combining today's events and currently-ongoing events", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchOngoingOrUpcomingEvents()

    const call = mockFind.mock.calls[0][0]
    expect(call.filters.$or).toHaveLength(2)
    expect(call.filters.$or[0].start.$gte).toBeDefined()
    expect(call.filters.$or[0].start.$lte).toBeDefined()
    expect(call.filters.$or[1].start.$lte).toBeDefined()
    expect(call.filters.$or[1].end.$gte).toBeDefined()
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null)

    const result = await fetchOngoingOrUpcomingEvents()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching events", expect.any(TypeError))
  })
})

describe("fetchUpcomingMapEvents", () => {
  it("sorts results by start ascending", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchUpcomingMapEvents()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ sort: ["start:asc"] }))
  })

  it("uses the default limit of 200", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchUpcomingMapEvents()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 200 } }))
  })

  it("respects a custom limit", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchUpcomingMapEvents(50)

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 50 } }))
  })

  it("filters to events where end >= now", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchUpcomingMapEvents()

    const call = mockFind.mock.calls[0][0]
    expect(call.filters.end.$gte).toBeDefined()
  })

  it("filters to events where map_location is not null", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchUpcomingMapEvents()

    const call = mockFind.mock.calls[0][0]
    expect(call.filters.map_location).toEqual({ $ne: null })
  })

  it("populates map_location", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchUpcomingMapEvents()

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ populate: { map_location: true } })
    )
  })

  it("returns the data array from the response", async () => {
    mockFind.mockResolvedValue({ data: [sampleEvent] })

    const result = await fetchUpcomingMapEvents()

    expect(result).toEqual([sampleEvent])
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null)

    const result = await fetchUpcomingMapEvents()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching upcoming events", expect.any(TypeError))
  })
})

describe("fetchAllPublishedEventSlugs", () => {
  it("requests only the slug field", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchAllPublishedEventSlugs()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ fields: ["slug"] }))
  })

  it("uses the default limit of 500", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchAllPublishedEventSlugs()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 500 } }))
  })

  it("respects a custom limit", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchAllPublishedEventSlugs(50)

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 50 } }))
  })

  it("returns plain slug strings", async () => {
    mockFind.mockResolvedValue({ data: [{ slug: "test-event" }, { slug: "another-event" }] })

    const result = await fetchAllPublishedEventSlugs()

    expect(result).toEqual(["test-event", "another-event"])
  })

  it("applies no date filter", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchAllPublishedEventSlugs()

    const call = mockFind.mock.calls[0][0]
    expect(call.filters).toBeUndefined()
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null)

    const result = await fetchAllPublishedEventSlugs()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching event slugs for sitemap",
      expect.any(TypeError)
    )
  })
})

describe("fetchMyEvents", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("filters by the given userId", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    await fetchMyEvents("token-abc", 42)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("filters[owner][id][$eq]=42"),
      expect.any(Object)
    )
  })

  it("includes the Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    await fetchMyEvents("my-token", 1)

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    )
  })

  it("returns the data array on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [sampleEvent] }),
    } as Response)

    const result = await fetchMyEvents("token", 1)

    expect(result).toEqual([sampleEvent])
  })

  it("returns an empty array when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      text: async () => "Unauthorized",
    } as Response)

    const result = await fetchMyEvents("bad-token", 1)

    expect(result).toEqual([])
  })

  it("logs an error and returns an empty array when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await fetchMyEvents("token", 1)

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching own events", expect.any(Error))
  })
})
