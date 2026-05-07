import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJobOffers, fetchJobOffer, fetchMyJobOffers } from "./job-offers"

const mockFind = vi.hoisted(() => vi.fn())
const mockCollection = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: { collection: mockCollection },
  withTimeout: (p: Promise<unknown>) => p,
  fetchWithTimeout: (url: string, opts: RequestInit) => fetch(url, opts),
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

const STRAPI_URL = "http://localhost:1337"

const sampleJob = {
  documentId: "job-123",
  slug: "developer-1",
  title: "Developer",
  description: "Build things",
  company: "ACME",
  location: "Remote",
  online_status: "published" as const,
  working_hours: 20,
  contact: { name: "HR", mail: "hr@acme.com" },
}

describe("fetchJobOffers", () => {
  it("filters by published status", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchJobOffers()

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { online_status: { $eq: "published" } },
      })
    )
  })

  it("uses the default limit of 100", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchJobOffers()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 100 } }))
  })

  it("respects a custom limit", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchJobOffers(10)

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 10 } }))
  })

  it("returns the data array from the response", async () => {
    mockFind.mockResolvedValue({ data: [sampleJob] })

    const result = await fetchJobOffers()

    expect(result).toEqual({ data: [sampleJob], apiDown: false })
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null) // null.data throws TypeError inside the try block

    const result = await fetchJobOffers()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching job offers", expect.any(TypeError))
  })
})

describe("fetchJobOffer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("URL-encodes the slug in the query string", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [sampleJob] }),
    } as Response)
    const slugWithSpecialChars = "test slug & more"

    await fetchJobOffer(slugWithSpecialChars, "token")

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(slugWithSpecialChars)),
      expect.any(Object)
    )
  })

  it("includes the Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [sampleJob] }),
    } as Response)

    await fetchJobOffer("some-slug", "my-token")

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    )
  })

  it("queries the correct Strapi endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [sampleJob] }),
    } as Response)

    await fetchJobOffer("some-slug", "token")

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`${STRAPI_URL}/api/job-offers`),
      expect.any(Object)
    )
  })

  it("filters reports to non-dismissed in the URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [sampleJob] }),
    } as Response)

    await fetchJobOffer("some-slug", "token")

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("populate[reports][filters][review_status][$ne]=dismissed"),
      expect.any(Object)
    )
  })

  it("returns the first job from the response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [sampleJob] }),
    } as Response)

    const result = await fetchJobOffer("some-slug", "token")

    expect(result).toEqual({ data: sampleJob, apiDown: false })
  })

  it("returns null when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    const result = await fetchJobOffer("some-slug", "token")

    expect(result).toEqual({ data: null, apiDown: false })
  })

  it("returns null when the data array is empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await fetchJobOffer("no-such-slug", "token")

    expect(result).toEqual({ data: null, apiDown: false })
  })

  it("logs an error and returns null when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await fetchJobOffer("some-slug", "token")

    expect(result).toEqual({ data: null, apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching job offer", expect.any(Error))
  })

  it("retries with the public token when a custom token returns 401", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [sampleJob] }),
      } as Response)

    const result = await fetchJobOffer("some-slug", "custom-token")

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ data: sampleJob, apiDown: false })
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("retrying"))
  })

  it("does NOT retry when the default public token itself returns 401", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    const result = await fetchJobOffer("some-slug")

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: null, apiDown: false })
  })
})

describe("fetchMyJobOffers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("filters by the given userId", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    await fetchMyJobOffers("token-abc", 42)

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

    await fetchMyJobOffers("my-token", 1)

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
      json: async () => ({ data: [sampleJob] }),
    } as Response)

    const result = await fetchMyJobOffers("token", 1)

    expect(result).toEqual({ data: [sampleJob], apiDown: false })
  })

  it("returns an empty array when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, text: async () => "Unauthorized" } as Response)

    const result = await fetchMyJobOffers("bad-token", 1)

    expect(result).toEqual({ data: [], apiDown: false })
  })

  it("logs an error and returns an empty array when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await fetchMyJobOffers("token", 1)

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching own job offers", expect.any(Error))
  })
})
