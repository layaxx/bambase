import { strapi } from "@strapi/client"
import dayjs from "dayjs"

export const strapiUrl = import.meta.env.STRAPI_URL ?? "http://localhost:1337"

export const client = strapi({
  baseURL: `${strapiUrl}/api`,
  auth: import.meta.env.STRAPI_TOKEN,
})

export type JobOffer = {
  documentId: string
  uuid: string
  title: string
  description: string
  company: string
  location: string
  online_status: "submitted" | "published" | "expired" | "rejected"
  working_hours: number
  offline_after?: string
  external_url?: string
  contact: {
    name?: string
    mail?: string
    phone?: string
  }
}

export async function fetchJobOffers(limit = 100): Promise<JobOffer[]> {
  try {
    const result = await client.collection("job-offers").find({
      filters: { online_status: { $eq: "published" } },
      populate: ["contact"],
      pagination: { limit },
    })
    return (result.data ?? []) as unknown as JobOffer[]
  } catch (error) {
    console.error("Error fetching job offers", error)
    return []
  }
}

export async function fetchJobOffer(
  slug: string,
  token = import.meta.env.STRAPI_TOKEN
): Promise<JobOffer | null> {
  try {
    const headers: Record<string, string> = {}
    headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(
      `${strapiUrl}/api/job-offers?filters[uuid][$eq]=${encodeURIComponent(slug)}&populate[0]=contact`,
      {
        headers,
      }
    )

    if (!res.ok) return null
    const result = await res.json()

    return (result?.data?.[0] ?? null) as unknown as JobOffer | null
  } catch (error) {
    console.error("Error fetching job offer", error)
    return null
  }
}

export type MensaMeal = {
  name: string
  priceStudents: number
  location: "Feki" | "Austraße" | "Erba"
  isVegan: boolean
  isVegetarian: boolean
  allergens?: { name: string }[]
}

export async function fetchMensaMeals(date: dayjs.Dayjs): Promise<MensaMeal[]> {
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
