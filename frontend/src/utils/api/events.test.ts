import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchEvents, fetchEvent, fetchMyEvents } from "./events"

const mockFind = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ find: mockFind }),
  },
  strapiUrl: "http://localhost:1337",
}))

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
  beforeEach(() => mockFind.mockReset())

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
    consoleSpy.mockRestore()
  })
})

describe("fetchEvent", () => {
  beforeEach(() => mockFind.mockReset())

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
    consoleSpy.mockRestore()
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
    consoleSpy.mockRestore()
  })
})
