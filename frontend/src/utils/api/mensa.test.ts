import { beforeEach, describe, expect, it, vi } from "vitest"
import dayjs from "dayjs"
import { fetchMensaMeals } from "./mensa"

const mockFind = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ find: mockFind }),
  },
  strapiUrl: "http://localhost:1337",
}))

describe("fetchMensaMeals", () => {
  beforeEach(() => {
    mockFind.mockReset()
  })

  it("passes the date formatted as YYYY-MM-DD to the filter", async () => {
    mockFind.mockResolvedValue({ data: [] })
    const date = dayjs("2026-04-15")

    await fetchMensaMeals(date)

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { date: { $eq: "2026-04-15" } },
      })
    )
  })

  it("includes allergens in the populate list", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchMensaMeals(dayjs("2026-04-15"))

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ populate: ["allergens"] }))
  })

  it("returns the data array from the API response", async () => {
    const meals = [
      {
        id: "1",
        name: "Pasta",
        location: "Feki",
        priceStudents: 2.5,
        isVegan: false,
        isVegetarian: true,
      },
    ]
    mockFind.mockResolvedValue({ data: meals })

    const result = await fetchMensaMeals(dayjs("2026-04-15"))

    expect(result).toEqual(meals)
  })

  it("returns an empty array when data is null", async () => {
    mockFind.mockResolvedValue({ data: null })

    const result = await fetchMensaMeals(dayjs("2026-04-15"))

    expect(result).toEqual([])
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null) // null.data throws TypeError inside the try block

    const result = await fetchMensaMeals(dayjs("2026-04-15"))

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching Mensa meals", expect.any(TypeError))
    consoleSpy.mockRestore()
  })
})
