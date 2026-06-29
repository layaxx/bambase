import type z from "zod"
import type { Modules } from "@strapi/types"
import { SWCanteenMenuResponseSchema } from "./schema"

type MensaMealInput = Modules.Documents.Params.Data.Input<"api::mensa-meal.mensa-meal">

const mensaplanApiBase = process.env.SWERK_API_BASE ?? "https://www.swerk-wue.de"

const mensas = [
  { id: 21, location: "Erba" },
  { id: 7, location: "Feki" },
  { id: 5, location: "Austraße" },
] as const

type Mensa = (typeof mensas)[number]
type Location = Mensa["location"]

type MensaResponse = z.infer<typeof SWCanteenMenuResponseSchema>

async function fetchFromAPI(mensa: Mensa): Promise<MensaResponse> {
  const response = await fetch(`${mensaplanApiBase}/api/menu/canteen/${mensa.id}`)

  if (!response.ok) {
    throw new Error(`Received status code ${response.status}`)
  }

  const parsed = SWCanteenMenuResponseSchema.parse(await response.json())

  return parsed
}

async function load() {
  for (const mensa of mensas) {
    try {
      // fetch data from API and validate it
      const apiResponse = await fetchFromAPI(mensa)

      // transform to day -> meals mapping
      const transformed = transformApiResponse(apiResponse, mensa.location)

      // add or update meals in Strapi
      for (const day of Object.keys(transformed)) {
        try {
          await updateStrapi(day, transformed[day], mensa.location)
        } catch (error) {
          strapi.log.error(
            `Failed to update Strapi for ${day} at ${mensa.location}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      strapi.log.info(`Successfully loaded mensa data for ${mensa.location}`)
    } catch (error) {
      strapi.log.error(
        `Failed to load mensa data for ${mensa.location}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

async function updateStrapi(date: string, meals: MensaMealInput[], location: Location) {
  const existing = await strapi.documents("api::mensa-meal.mensa-meal").findMany({
    filters: {
      date,
      location,
    },
  })

  const existingMap = new Map(existing.map((meal) => [meal.name, meal]))

  const updates: Promise<unknown>[] = []
  const creates: Promise<unknown>[] = []

  for (const meal of meals) {
    if (!meal.name || meal.name.trim() === "-") {
      strapi.log.warn(`Skipping meal with empty name on ${date} at ${location}`)
      continue
    }

    const match = existingMap.get(meal.name)

    if (match) {
      updates.push(
        strapi
          .documents("api::mensa-meal.mensa-meal")
          .update({ documentId: match.documentId, data: meal })
      )
      existingMap.delete(meal.name)
    } else {
      creates.push(strapi.documents("api::mensa-meal.mensa-meal").create({ data: meal }))
    }
  }

  const deletes = [...existingMap.values()].map((meal) =>
    strapi.documents("api::mensa-meal.mensa-meal").delete({ documentId: meal.documentId })
  )

  await Promise.all([...updates, ...creates, ...deletes])

  return { updated: updates.length, created: creates.length, deleted: deletes.length }
}

function transformApiResponse(
  data: MensaResponse,
  location: Location
): Record<string, MensaMealInput[]> {
  const transformed: Record<string, MensaMealInput[]> = {}
  const additiveMap = new Map(data.additives.map((a) => [a.identifier, a.label]))

  for (const week of data.menu) {
    if (!week.menu_per_day) continue

    for (const day of Object.values(week.menu_per_day)) {
      if (!day.menu_entries) continue

      transformed[day.day] = []

      for (const food of day.menu_entries) {
        const allergens = []

        for (const id of food.additives ?? []) {
          const name = additiveMap.get(id)

          if (name) {
            allergens.push({
              name,
            })
          } else {
            strapi.log.warn(
              `Unknown additive identifier "${id}" for food "${food.name}" on ${day.day} at ${location}`
            )
          }
        }

        const foodTypes = food.food_type ?? []
        const entry = {
          name: food.name,
          priceStudents: food.price,
          priceStaff: food.price_servant,
          priceOther: food.price_guest,
          isVegan: foodTypes.includes("v"),
          isVegetarian: foodTypes.includes("fl"),
          date: day.day,
          location: location,
          allergens,
        }
        transformed[day.day].push(entry)
      }
    }
  }
  return transformed
}

export default () => ({
  load,
})
