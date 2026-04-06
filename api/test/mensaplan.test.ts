import mensaService from "../src/api/mensa/services/mensa"
import { mockApiResponse } from "./mensaplan.data"

// 9 days with non-null menu_entries across the two weeks in the fixture:
// week 15: days 2-5 (day 1 is a holiday with null menu_entries)
// week 16: days 1-5
const DAYS_WITH_MEALS = 9

// meals per day across weeks in the fixture
const MEALS_PER_DAY: Record<string, number> = {
  "2026-04-07": 4,
  "2026-04-08": 4,
  "2026-04-09": 3,
  "2026-04-10": 4,
  "2026-04-13": 4,
  "2026-04-14": 4,
  "2026-04-15": 5,
  "2026-04-16": 4,
  "2026-04-17": 4,
}
const TOTAL_MEALS_PER_MENSA = Object.values(MEALS_PER_DAY).reduce((a, b) => a + b, 0)

const MENSAS = [
  { id: 21, location: "Erba" },
  { id: 7, location: "Feki" },
  { id: 5, location: "Austraße" },
]

describe("mensa service", () => {
  let mockDocuments: {
    findMany: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }

  beforeEach(() => {
    mockDocuments = {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ documentId: "new-id" }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    }
    global.strapi = {
      log: { error: jest.fn(), warn: jest.fn() },
      documents: jest.fn().mockReturnValue(mockDocuments),
    } as any
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    } as any)
  })

  afterEach(() => {
    delete (global as any).strapi
    jest.restoreAllMocks()
  })

  describe("API fetching", () => {
    it("fetches data for each of the 3 mensas", async () => {
      await mensaService().load()

      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it("fetches from the correct URL for each mensa", async () => {
      await mensaService().load()

      for (const mensa of MENSAS) {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/menu/canteen/${mensa.id}`)
        )
      }
    })

    it("logs an error and continues when one mensa API call fails", async () => {
      let callCount = 0
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++
        // fail the first mensa only
        if (callCount === 1) return Promise.resolve({ ok: false, status: 503 } as any)
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue(mockApiResponse),
        } as any)
      })

      await mensaService().load()

      expect((global as any).strapi.log.error).toHaveBeenCalledTimes(1)
      // the remaining two mensas still created their meals
      expect(mockDocuments.create).toHaveBeenCalledTimes(TOTAL_MEALS_PER_MENSA * 2)
    })

    it("logs an error for every failing mensa", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as any)

      await mensaService().load()

      expect((global as any).strapi.log.error).toHaveBeenCalledTimes(3)
    })
  })

  describe("meal transformation", () => {
    it("marks vegan meals with isVegan=true and isVegetarian=false", async () => {
      await mensaService().load()

      // "Karottencremesuppe..." on 2026-04-07 has food_type ["v"]
      expect(mockDocuments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Karottencremesuppe mit gerösteten Sonnenblumenkernen",
            isVegan: true,
            isVegetarian: false,
          }),
        })
      )
    })

    it("marks vegetarian (meatless) meals with isVegan=false and isVegetarian=true", async () => {
      await mensaService().load()

      // Spaghetti "Aglio Olio" on 2026-04-07 has food_type ["fl"]
      expect(mockDocuments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Spaghetti "Aglio Olio" mit Chili & Knoblauch in Olivenöl und griebenem Grana Padano',
            isVegan: false,
            isVegetarian: true,
          }),
        })
      )
    })

    it("marks meat-containing meals with both flags false", async () => {
      await mensaService().load()

      // "Hähnchenschnitzel..." on 2026-04-07 has food_type ["g"] (poultry)
      expect(mockDocuments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Hähnchenschnitzel im Knuspermantel mit Super Crunch Pommes frites",
            isVegan: false,
            isVegetarian: false,
          }),
        })
      )
    })

    it("maps additive identifiers to their German labels as allergens", async () => {
      await mensaService().load()

      // "Karottencremesuppe..." has additives ["z1", "a1", "a9", "a15", "a17"]
      // z1 → "mit Farbstoff", a1 → "glutenhaltiges Getreide", etc.
      expect(mockDocuments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Karottencremesuppe mit gerösteten Sonnenblumenkernen",
            allergens: expect.arrayContaining([
              { name: "mit Farbstoff" },
              { name: "glutenhaltiges Getreide" },
              { name: "Sellerie" },
              { name: "Weizen" },
              { name: "Gerste" },
            ]),
          }),
        })
      )
    })

    it("correctly maps the three price fields", async () => {
      await mensaService().load()

      expect(mockDocuments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Karottencremesuppe mit gerösteten Sonnenblumenkernen",
            priceStudents: 1.5,
            priceStaff: 1.6,
            priceOther: 1.8,
          }),
        })
      )
    })

    it("sets the correct date on each meal", async () => {
      await mensaService().load()

      expect(mockDocuments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Karottencremesuppe mit gerösteten Sonnenblumenkernen",
            date: "2026-04-07",
          }),
        })
      )
    })

    it("sets the correct location for each mensa", async () => {
      await mensaService().load()

      for (const mensa of MENSAS) {
        expect(mockDocuments.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ location: mensa.location }),
          })
        )
      }
    })

    it("skips days where menu_entries is null", async () => {
      await mensaService().load()

      // 2026-04-06 (week 15 day 1) has null menu_entries → should never appear
      const createCalls: any[] = mockDocuments.create.mock.calls
      const datesCreated = createCalls.map((args) => args[0].data.date)
      expect(datesCreated).not.toContain("2026-04-06")
    })

    it("warns about unknown additive identifiers", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ...mockApiResponse,
          additives: [], // clear all known additives
        }),
      } as any)

      await mensaService().load()

      // every additive in every meal is now unknown → many warnings
      expect((global as any).strapi.log.warn).toHaveBeenCalled()
      expect((global as any).strapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown additive identifier")
      )
    })
  })

  describe("Strapi sync", () => {
    it("queries Strapi once per day per mensa with the correct filters", async () => {
      await mensaService().load()

      // 3 mensas × 9 non-null days = 27 findMany calls
      expect(mockDocuments.findMany).toHaveBeenCalledTimes(MENSAS.length * DAYS_WITH_MEALS)

      expect(mockDocuments.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { date: "2026-04-07", location: "Erba" },
        })
      )
    })

    it("creates all meals when Strapi has no existing entries", async () => {
      await mensaService().load()

      expect(mockDocuments.create).toHaveBeenCalledTimes(TOTAL_MEALS_PER_MENSA * MENSAS.length)
      expect(mockDocuments.update).not.toHaveBeenCalled()
      expect(mockDocuments.delete).not.toHaveBeenCalled()
    })

    it("updates a meal that already exists in Strapi instead of creating it", async () => {
      // one meal already exists on 2026-04-07 at Erba
      mockDocuments.findMany.mockImplementation(({ filters }) => {
        if (filters.date === "2026-04-07" && filters.location === "Erba") {
          return Promise.resolve([
            {
              documentId: "existing-id",
              name: "Karottencremesuppe mit gerösteten Sonnenblumenkernen",
            },
          ])
        }
        return Promise.resolve([])
      })

      await mensaService().load()

      expect(mockDocuments.update).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: "existing-id" })
      )
      // total creates = all meals minus the one that was updated
      const expectedCreates = TOTAL_MEALS_PER_MENSA * MENSAS.length - 1
      expect(mockDocuments.create).toHaveBeenCalledTimes(expectedCreates)
    })

    it("deletes meals that are in Strapi but no longer in the API response", async () => {
      const staleDocumentId = "stale-id"
      mockDocuments.findMany.mockImplementation(({ filters }) => {
        if (filters.date === "2026-04-07" && filters.location === "Erba") {
          return Promise.resolve([{ documentId: staleDocumentId, name: "Stale Old Meal" }])
        }
        return Promise.resolve([])
      })

      await mensaService().load()

      expect(mockDocuments.delete).toHaveBeenCalledWith({ documentId: staleDocumentId })
    })

    it("does not delete meals that are still present in the API response", async () => {
      // return the existing meal only for the day/location where it actually appears in the API data
      mockDocuments.findMany.mockImplementation(({ filters }) => {
        if (filters.date === "2026-04-07" && filters.location === "Erba") {
          return Promise.resolve([
            {
              documentId: "existing-id",
              name: "Karottencremesuppe mit gerösteten Sonnenblumenkernen",
            },
          ])
        }
        return Promise.resolve([])
      })

      await mensaService().load()

      expect(mockDocuments.delete).not.toHaveBeenCalledWith({ documentId: "existing-id" })
    })
  })
})
