import type { Dayjs } from "dayjs"
import { client } from "./client"

export type MensaMeal = {
  name: string
  priceStudents: number
  location: "Feki" | "Austraße" | "Erba"
  isVegan: boolean
  isVegetarian: boolean
  allergens?: { name: string }[]
}

export async function fetchMensaMeals(date: Dayjs): Promise<MensaMeal[]> {
  try {
    const result = await client.collection("mensa-meals").find({
      filters: { date: { $eq: date.toISOString().split("T")[0] } },
      populate: ["allergens"],
      pagination: { limit: 100 },
    })
    return (result.data ?? []) as unknown as MensaMeal[]
  } catch (error) {
    console.error("Error fetching Mensa meals", error)
    return []
  }
}
