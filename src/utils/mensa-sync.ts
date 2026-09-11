import { z } from "astro/zod"
import prisma from "./prisma"
import { errorMessage } from "./error-message"

const SWCanteenMenuFoodSchema = z.object({
  name: z.string(),
  price: z.number(),
  price_servant: z.number(),
  price_guest: z.number(),
  food: z.number().nullable(),
  food_type: z.array(z.string()).nullable(),
  additives: z.array(z.string()).nullable(),
})

const SWCanteenMenuDaySchema = z.object({
  day: z.string(),
  menu_entries: z.array(SWCanteenMenuFoodSchema).nullish(),
  empty_notices: z.array(z.object({ message: z.string() })).nullable(),
})

const SWCanteenMenuWeekSchema = z.object({
  year: z.number(),
  week_number: z.number(),
  menu_per_day: z.record(z.string(), SWCanteenMenuDaySchema).optional(),
})

const SWCanteenMenuResponseSchema = z.object({
  menu: z.array(SWCanteenMenuWeekSchema),
  additives: z.array(
    z.object({
      identifier: z.string(),
      name: z.string(),
      label: z.string(),
    })
  ),
})

type MensaResponse = z.infer<typeof SWCanteenMenuResponseSchema>

const mensaplanApiBase = process.env.SWERK_API_BASE ?? "https://www.swerk-wue.de"

const mensas = [
  { id: 21, location: "Erba" },
  { id: 7, location: "Feki" },
  { id: 5, location: "Austraße" },
] as const

type Mensa = (typeof mensas)[number]
type Location = Mensa["location"]

type MealInput = {
  name: string
  priceStudents: number
  priceStaff: number
  priceOther: number
  isVegan: boolean
  isVegetarian: boolean
  date: string
  location: Location
  allergens: string[]
}

async function fetchFromAPI(mensa: Mensa): Promise<MensaResponse> {
  const response = await fetch(`${mensaplanApiBase}/api/menu/canteen/${mensa.id}`)

  if (!response.ok) {
    throw new Error(`Received status code ${response.status}`)
  }

  return SWCanteenMenuResponseSchema.parse(await response.json())
}

function transformApiResponse(
  data: MensaResponse,
  location: Location
): Record<string, MealInput[]> {
  const transformed: Record<string, MealInput[]> = {}
  const additiveMap = new Map(data.additives.map((a) => [a.identifier, a.label]))

  for (const week of data.menu) {
    if (!week.menu_per_day) continue

    for (const day of Object.values(week.menu_per_day)) {
      if (!day.menu_entries) continue

      transformed[day.day] = []

      for (const food of day.menu_entries) {
        const allergens: string[] = []

        for (const id of food.additives ?? []) {
          const name = additiveMap.get(id)

          if (name) {
            allergens.push(name)
          } else {
            console.warn(
              `Unknown additive identifier "${id}" for food "${food.name}" on ${day.day} at ${location}`
            )
          }
        }

        const foodTypes = food.food_type ?? []
        transformed[day.day].push({
          name: food.name,
          priceStudents: food.price,
          priceStaff: food.price_servant,
          priceOther: food.price_guest,
          isVegan: foodTypes.includes("v"),
          isVegetarian: foodTypes.includes("fl"),
          date: day.day,
          location,
          allergens,
        })
      }
    }
  }
  return transformed
}

type DaySummary = { created: number; updated: number; deleted: number }

async function upsertDay(
  date: string,
  meals: MealInput[],
  location: Location
): Promise<DaySummary> {
  const existing = await prisma.mensaMeal.findMany({ where: { date: new Date(date), location } })
  const existingByName = new Map(existing.map((meal) => [meal.name, meal]))

  const outcomes = await Promise.all(
    meals.map(async (meal) => {
      if (!meal.name || meal.name.trim() === "-") {
        console.warn(`Skipping meal with empty name on ${date} at ${location}`)
        return null
      }

      const isUpdate = existingByName.has(meal.name)
      existingByName.delete(meal.name)

      await prisma.mensaMeal.upsert({
        where: { name_date_location: { name: meal.name, date: new Date(date), location } },
        create: { ...meal, date: new Date(date) },
        update: { ...meal, date: new Date(date) },
      })

      return isUpdate ? "updated" : "created"
    })
  )

  const stale = [...existingByName.values()]
  if (stale.length > 0) {
    await prisma.mensaMeal.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } })
  }

  return {
    created: outcomes.filter((o) => o === "created").length,
    updated: outcomes.filter((o) => o === "updated").length,
    deleted: stale.length,
  }
}

function sumDaySummaries(summaries: DaySummary[]): DaySummary {
  return summaries.reduce(
    (acc, s) => ({
      created: acc.created + s.created,
      updated: acc.updated + s.updated,
      deleted: acc.deleted + s.deleted,
    }),
    { created: 0, updated: 0, deleted: 0 }
  )
}

export async function syncMensaMeals(): Promise<Record<Location, DaySummary | null>> {
  const entries = await Promise.all(
    mensas.map(async (mensa): Promise<[Location, DaySummary | null, string | null]> => {
      try {
        const apiResponse = await fetchFromAPI(mensa)
        const transformed = transformApiResponse(apiResponse, mensa.location)

        const dayResults = await Promise.all(
          Object.keys(transformed).map((day) => upsertDay(day, transformed[day], mensa.location))
        )

        return [mensa.location, sumDaySummaries(dayResults), null]
      } catch (error) {
        const message = errorMessage(error)
        console.error(`Failed to sync mensa data for ${mensa.location}: ${message}`)
        return [mensa.location, null, message]
      }
    })
  )

  const failures = entries.filter(([, , error]) => error !== null)
  const result = Object.fromEntries(
    entries.map(([location, summary]) => [location, summary])
  ) as Record<Location, DaySummary | null>

  if (failures.length > 0) {
    const details = failures.map(([location, , message]) => `${location} (${message})`).join(", ")
    throw new Error(`Failed to sync ${failures.length}/${mensas.length} canteen(s): ${details}`)
  }

  return result
}
