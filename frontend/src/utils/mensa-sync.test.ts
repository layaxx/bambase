import { beforeEach, describe, expect, it, vi } from "vitest"
import { syncMensaMeals } from "./mensa-sync"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockUpsert = vi.hoisted(() => vi.fn())
const mockDeleteMany = vi.hoisted(() => vi.fn())

vi.mock("./prisma", () => ({
  default: {
    mensaMeal: {
      findMany: mockFindMany,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
  },
}))

const CANTEEN_IDS = { Erba: 21, Feki: 7, Austraße: 5 } as const

function apiResponse(day: string, entries: Record<string, unknown>[]) {
  return {
    menu: [
      {
        year: 2026,
        week_number: 15,
        menu_per_day: { "1": { day, menu_entries: entries, empty_notices: null } },
      },
    ],
    additives: [{ identifier: "a1", name: "Gluten", label: "Gluten" }],
  }
}

function emptyResponse() {
  return { menu: [], additives: [] }
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body }
}

describe("syncMensaMeals", () => {
  beforeEach(() => {
    mockFindMany.mockReset().mockResolvedValue([])
    mockUpsert.mockReset().mockResolvedValue(undefined)
    mockDeleteMany.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal("fetch", vi.fn())
  })

  it("fetches from the Studentenwerk endpoint for all three canteens", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(emptyResponse()) as never)

    await syncMensaMeals()

    for (const id of Object.values(CANTEEN_IDS)) {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/api/menu/canteen/${id}`))
    }
  })

  it("upserts a meal with prices, flags, and allergens resolved from additive identifiers", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes(`/canteen/${CANTEEN_IDS.Feki}`)) {
        return jsonResponse(
          apiResponse("2026-04-15", [
            {
              name: "Veggie Burger",
              price: 2.5,
              price_servant: 3.5,
              price_guest: 4.5,
              food: 1,
              food_type: ["v", "fl"],
              additives: ["a1"],
            },
          ])
        ) as never
      }
      return jsonResponse(emptyResponse()) as never
    })

    await syncMensaMeals()

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name_date_location: {
            name: "Veggie Burger",
            date: new Date("2026-04-15"),
            location: "Feki",
          },
        },
        create: expect.objectContaining({
          name: "Veggie Burger",
          priceStudents: 2.5,
          priceStaff: 3.5,
          priceOther: 4.5,
          isVegan: true,
          isVegetarian: true,
          allergens: ["Gluten"],
        }),
      })
    )
  })

  it("skips meals with an empty or placeholder name", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes(`/canteen/${CANTEEN_IDS.Feki}`)) {
        return jsonResponse(
          apiResponse("2026-04-15", [
            {
              name: "-",
              price: 0,
              price_servant: 0,
              price_guest: 0,
              food: null,
              food_type: null,
              additives: null,
            },
          ])
        ) as never
      }
      return jsonResponse(emptyResponse()) as never
    })

    await syncMensaMeals()

    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("deletes meals that are no longer present for that day and location", async () => {
    mockFindMany.mockImplementation(async ({ where }) => {
      if (where.location === "Feki") return [{ id: "stale-id", name: "Old meal" }]
      return []
    })

    // Feki returns a day with zero entries this run, so any previously stored
    // meal for that day should be treated as stale and deleted.
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes(`/canteen/${CANTEEN_IDS.Feki}`)) {
        return jsonResponse(apiResponse("2026-04-15", [])) as never
      }
      return jsonResponse(emptyResponse()) as never
    })

    const result = await syncMensaMeals()

    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["stale-id"] } } })
    expect(result.Feki).toEqual({ created: 0, updated: 0, deleted: 1 })
  })

  it("continues syncing the remaining canteens if one request fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes(`/canteen/${CANTEEN_IDS.Erba}`)) {
        return jsonResponse(null, false) as never
      }
      if (String(url).includes(`/canteen/${CANTEEN_IDS.Feki}`)) {
        return jsonResponse(
          apiResponse("2026-04-15", [
            {
              name: "Soup",
              price: 1.5,
              price_servant: 1.6,
              price_guest: 1.8,
              food: 1,
              food_type: [],
              additives: [],
            },
          ])
        ) as never
      }
      return jsonResponse(emptyResponse()) as never
    })

    const result = await syncMensaMeals()

    expect(result.Erba).toBeNull()
    expect(result.Feki).toEqual({ created: 1, updated: 0, deleted: 0 })
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Erba"))
    consoleSpy.mockRestore()
  })
})
