import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchLocations, fetchLocationForAdmin, fetchAllLocationsForAdmin } from "./locations"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    location: { findMany: mockFindMany, findFirst: mockFindFirst },
  },
}))

vi.mock("./cache", () => ({
  withCache: (_key: string, fn: () => Promise<unknown>) => fn(),
}))

beforeEach(() => {
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
})

const sampleLocationRow = {
  id: "loc-1",
  slug: "audimax",
  name: "Audimax",
  description: null,
  lat: 49.8988,
  lon: 10.9028,
  category: "university",
  externalUrl: null,
  addressStreet: null,
  addressStreetNumber: null,
  addressCity: null,
  addressZip: null,
}

describe("fetchLocations", () => {
  it("sorts results by name ascending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchLocations()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: "asc" } }))
  })

  it("uses a high take limit to fetch all locations", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchLocations()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }))
  })

  it("sends no where clause when called without a category", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchLocations()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }))
  })

  it("filters by category when one is provided", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchLocations("university")

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: "university" } })
    )
  })

  it("maps rows to MapLocation, omitting the address when all fields are null", async () => {
    mockFindMany.mockResolvedValue([sampleLocationRow])

    const result = await fetchLocations()

    expect(result).toEqual({
      data: [
        {
          id: "loc-1",
          slug: "audimax",
          name: "Audimax",
          description: undefined,
          lat: 49.8988,
          lon: 10.9028,
          category: "university",
          external_url: undefined,
          address: undefined,
        },
      ],
      apiDown: false,
    })
  })

  it("builds an address object when at least one address field is present", async () => {
    mockFindMany.mockResolvedValue([
      { ...sampleLocationRow, addressStreet: "Feldkirchenstraße", addressStreetNumber: "21" },
    ])

    const result = await fetchLocations()

    expect(result.data[0].address).toEqual({
      street: "Feldkirchenstraße",
      streetNumber: "21",
      city: undefined,
      zip: undefined,
    })
  })

  it("returns an empty array when no rows are found", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await fetchLocations()

    expect(result).toEqual({ data: [], apiDown: false })
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null)

    const result = await fetchLocations()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching locations", expect.any(TypeError))
    consoleSpy.mockRestore()
  })
})

describe("fetchLocationForAdmin", () => {
  it("looks up the location by slug", async () => {
    mockFindFirst.mockResolvedValue(sampleLocationRow)

    await fetchLocationForAdmin("audimax")

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { slug: "audimax" } })
  })

  it("returns null when no location matches the slug", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await fetchLocationForAdmin("missing")

    expect(result).toEqual({ data: null, apiDown: false })
  })

  it("maps the found row to a MapLocation", async () => {
    mockFindFirst.mockResolvedValue(sampleLocationRow)

    const result = await fetchLocationForAdmin("audimax")

    expect(result.data).toMatchObject({ id: "loc-1", slug: "audimax", name: "Audimax" })
  })

  it("logs an error and returns apiDown when the lookup throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindFirst.mockRejectedValue(new Error("db error"))

    const result = await fetchLocationForAdmin("audimax")

    expect(result).toEqual({ data: null, apiDown: true })
    consoleSpy.mockRestore()
  })
})

describe("fetchAllLocationsForAdmin", () => {
  it("sorts results by name ascending with a default limit of 500", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllLocationsForAdmin()

    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { name: "asc" }, take: 500 })
  })

  it("uses a custom limit when provided", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllLocationsForAdmin(10)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
  })

  it("logs an error and returns an empty array when the query throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("db error"))

    const result = await fetchAllLocationsForAdmin()

    expect(result).toEqual({ data: [], apiDown: true })
    consoleSpy.mockRestore()
  })
})
