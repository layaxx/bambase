import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchJobOffers, fetchJobOffer, fetchMyJobOffers } from "./job-offers"

const mockFind = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ find: mockFind }),
  },
  strapiUrl: "http://localhost:1337",
}))

const STRAPI_URL = "http://localhost:1337"

const sampleJob = {
  documentId: "job-123",
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  title: "Developer",
  description: "Build things",
  company: "ACME",
  location: "Remote",
  online_status: "published" as const,
  working_hours: 20,
  contact: { name: "HR", mail: "hr@acme.com" },
}

describe("fetchJobOffers", () => {
  beforeEach(() => mockFind.mockReset())

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

    expect(result).toEqual([sampleJob])
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null) // null.data throws TypeError inside the try block

    const result = await fetchJobOffers()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching job offers", expect.any(TypeError))
    consoleSpy.mockRestore()
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

    await fetchJobOffer("some-uuid", "my-token")

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

    await fetchJobOffer("some-uuid", "token")

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

    await fetchJobOffer("some-uuid", "token")

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

    const result = await fetchJobOffer("some-uuid", "token")

    expect(result).toEqual(sampleJob)
  })

  it("returns null when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    const result = await fetchJobOffer("some-uuid", "token")

    expect(result).toBeNull()
  })

  it("returns null when the data array is empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await fetchJobOffer("no-such-uuid", "token")

    expect(result).toBeNull()
  })

  it("logs an error and returns null when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await fetchJobOffer("some-uuid", "token")

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching job offer", expect.any(Error))
    consoleSpy.mockRestore()
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

    expect(result).toEqual([sampleJob])
  })

  it("returns an empty array when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    const result = await fetchMyJobOffers("bad-token", 1)

    expect(result).toEqual([])
  })

  it("logs an error and returns an empty array when fetch throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("network error"))

    const result = await fetchMyJobOffers("token", 1)

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching own job offers", expect.any(Error))
    consoleSpy.mockRestore()
  })
})
