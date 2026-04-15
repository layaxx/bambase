import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchEvents, fetchEvent, updateEvent, deleteEvent, fetchMyEvents } from "./events"

const mockFind = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ find: mockFind }),
  },
  strapiUrl: "http://localhost:1337",
}))

const STRAPI_URL = "http://localhost:1337"

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
        populate: {
          owner: true,
          reports: {
            filters: { review_status: { $ne: "dismissed" } },
            fields: [],
          },
        },
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

describe("updateEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("sends a PUT request to the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "updated-slug" } }),
    } as Response)

    await updateEvent("doc-123", "token-abc", {
      title: "T",
      organizer: "O",
      description: "D",
      start: "s",
      end: "e",
    })

    expect(fetch).toHaveBeenCalledWith(
      `${STRAPI_URL}/api/events/doc-123`,
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("includes the Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "updated-slug" } }),
    } as Response)

    await updateEvent("doc-123", "my-token", {
      title: "T",
      organizer: "O",
      description: "D",
      start: "s",
      end: "e",
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    )
  })

  it("sends the event data wrapped in a data key", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "updated-slug" } }),
    } as Response)
    const eventData = {
      title: "New Title",
      organizer: "Org",
      description: "Desc",
      start: "2026-04-15T10:00:00Z",
      end: "2026-04-15T12:00:00Z",
      external_url: "https://example.com",
    }

    await updateEvent("doc-123", "token", eventData)

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ data: eventData }) })
    )
  })

  it("returns the slug on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "updated-slug" } }),
    } as Response)

    const result = await updateEvent("doc-123", "token", {
      title: "T",
      organizer: "O",
      description: "D",
      start: "s",
      end: "e",
    })

    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("returns null when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    const result = await updateEvent("doc-123", "token", {
      title: "T",
      organizer: "O",
      description: "D",
      start: "s",
      end: "e",
    })

    expect(result).toBeNull()
  })

  it("logs an error and returns null when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await updateEvent("doc-123", "token", {
      title: "T",
      organizer: "O",
      description: "D",
      start: "s",
      end: "e",
    })

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith("Error updating event", expect.any(Error))
    consoleSpy.mockRestore()
  })
})

describe("deleteEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("sends a DELETE request to the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await deleteEvent("doc-123", "token-abc")

    expect(fetch).toHaveBeenCalledWith(
      `${STRAPI_URL}/api/events/doc-123`,
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("returns true when the response is ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    const result = await deleteEvent("doc-123", "token")

    expect(result).toBe(true)
  })

  it("returns false when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      text: async () => "Forbidden",
    } as Response)

    const result = await deleteEvent("doc-123", "token")

    expect(result).toBe(false)
  })

  it("logs an error and returns false when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await deleteEvent("doc-123", "token")

    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith("Error deleting event", expect.any(Error))
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
