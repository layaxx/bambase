import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchLocations } from "./locations"

const mockFind = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ find: mockFind }),
  },
  strapiUrl: "http://localhost:1337",
}))

const sampleLocation = {
  documentId: "loc-1",
  slug: "audimax",
  name: "Audimax",
  lat: 49.8988,
  lon: 10.9028,
  category: "university",
}

describe("fetchLocations", () => {
  beforeEach(() => mockFind.mockReset())

  it("sorts results by name ascending", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchLocations()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ sort: ["name:asc"] }))
  })

  it("uses a high pagination limit to fetch all locations", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchLocations()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 500 } }))
  })

  it("populates the address relation", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchLocations()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ populate: ["address"] }))
  })

  it("returns the data array from the response", async () => {
    mockFind.mockResolvedValue({ data: [sampleLocation] })

    const result = await fetchLocations()

    expect(result).toEqual([sampleLocation])
  })

  it("returns an empty array when data is null", async () => {
    mockFind.mockResolvedValue({ data: null })

    const result = await fetchLocations()

    expect(result).toEqual([])
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null)

    const result = await fetchLocations()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching locations", expect.any(TypeError))
    consoleSpy.mockRestore()
  })
})
