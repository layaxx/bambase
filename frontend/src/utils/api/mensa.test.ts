import { beforeEach, describe, expect, it, vi } from "vitest"
import dayjs from "dayjs"
import { Decimal } from "@/generated/prisma/internal/prismaNamespace"
import { fetchMensaMeals, fetchMensaMealsRange } from "./mensa"

const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    mensaMeal: { findMany: mockFindMany },
  },
}))

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "1",
    name: "Pasta",
    date: new Date("2026-04-15T00:00:00.000Z"),
    location: "Feki",
    priceStudents: new Decimal(2.5),
    isVegan: false,
    isVegetarian: true,
    allergens: [],
    ...overrides,
  }
}

describe("fetchMensaMeals", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it("queries by the date formatted as UTC midnight", async () => {
    mockFindMany.mockResolvedValue([])
    const date = dayjs("2026-04-15")

    await fetchMensaMeals(date)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { date: new Date("2026-04-15T00:00:00.000Z") },
    })
  })

  it("maps rows to MensaMeal, formatting the date back to YYYY-MM-DD", async () => {
    mockFindMany.mockResolvedValue([makeRow({ allergens: ["Gluten"] })])

    const result = await fetchMensaMeals(dayjs("2026-04-15"))

    expect(result).toEqual({
      data: [
        {
          id: "1",
          name: "Pasta",
          date: "2026-04-15",
          location: "Feki",
          priceStudents: 2.5,
          isVegan: false,
          isVegetarian: true,
          allergens: ["Gluten"],
        },
      ],
      apiDown: false,
    })
  })

  it("returns an empty array when no rows are found", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await fetchMensaMeals(dayjs("2026-04-15"))

    expect(result).toEqual({ data: [], apiDown: false })
  })

  it("logs an error and returns apiDown: true when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("connection refused"))

    const result = await fetchMensaMeals(dayjs("2026-04-15"))

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching Mensa meals", expect.any(Error))
    consoleSpy.mockRestore()
  })
})

describe("fetchMensaMealsRange", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it("returns early without querying when given no dates", async () => {
    const result = await fetchMensaMealsRange([])

    expect(result).toEqual({ data: [], apiDown: false })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("queries all dates as UTC midnight via an `in` filter", async () => {
    mockFindMany.mockResolvedValue([])
    const dates = [dayjs("2026-04-15"), dayjs("2026-04-16"), dayjs("2026-04-17")]

    await fetchMensaMealsRange(dates)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        date: {
          in: [
            new Date("2026-04-15T00:00:00.000Z"),
            new Date("2026-04-16T00:00:00.000Z"),
            new Date("2026-04-17T00:00:00.000Z"),
          ],
        },
      },
    })
  })

  it("returns all mapped meals from the query result", async () => {
    mockFindMany.mockResolvedValue([
      makeRow(),
      makeRow({ id: "2", name: "Salad", date: new Date("2026-04-16T00:00:00.000Z") }),
    ])

    const result = await fetchMensaMealsRange([dayjs("2026-04-15"), dayjs("2026-04-16")])

    expect(result.apiDown).toBe(false)
    expect(result.data).toHaveLength(2)
    expect(result.data.map((m) => m.name)).toEqual(["Pasta", "Salad"])
  })

  it("returns empty array and apiDown true on error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("connection refused"))

    const result = await fetchMensaMealsRange([dayjs("2026-04-15")])

    expect(result).toEqual({ data: [], apiDown: true })
    consoleSpy.mockRestore()
  })
})
