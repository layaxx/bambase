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
  owner?: { id: number }
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
      `${strapiUrl}/api/job-offers?filters[uuid][$eq]=${encodeURIComponent(slug)}&populate[0]=contact&populate[1]=owner`,
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

export type Event = {
  documentId: string
  slug: string
  title: string
  description: string
  start: string
  end: string
  organizer: string
  external_url?: string
  owner?: { id: number }
}

export async function fetchEvents(limit = 100): Promise<Event[]> {
  try {
    const result = await client.collection("events").find({
      sort: ["start:asc"],
      pagination: { limit },
    })
    return (result.data ?? []) as unknown as Event[]
  } catch (error) {
    console.error("Error fetching events", error)
    return []
  }
}

export async function fetchEvent(slug: string): Promise<Event | null> {
  try {
    const result = await client.collection("events").find({
      filters: { slug: { $eq: slug } },
      populate: ["owner"],
      pagination: { limit: 1 },
    })
    return ((result.data ?? [])[0] ?? null) as unknown as Event | null
  } catch (error) {
    console.error("Error fetching event", error)
    return null
  }
}

export async function updateEvent(
  documentId: string,
  token: string,
  data: {
    title: string
    organizer: string
    description: string
    start: string
    end: string
    external_url?: string
  }
): Promise<{ slug: string } | null> {
  try {
    const res = await fetch(`${strapiUrl}/api/events/${documentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }),
    })
    if (!res.ok) return null
    const result = await res.json()
    return { slug: result?.data?.slug ?? null }
  } catch (error) {
    console.error("Error updating event", error)
    return null
  }
}

export async function deleteEvent(documentId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${strapiUrl}/api/events/${documentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.warn("Failed to delete event:", errorText)
      return false
    }

    return res.ok
  } catch (error) {
    console.error("Error deleting event", error)
    return false
  }
}

export async function fetchMyJobOffers(token: string, userId: number): Promise<JobOffer[]> {
  try {
    const res = await fetch(
      `${strapiUrl}/api/job-offers?filters[owner][id][$eq]=${userId}&populate[0]=contact&sort=createdAt:desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return []
    const result = await res.json()
    return (result?.data ?? []) as unknown as JobOffer[]
  } catch (error) {
    console.error("Error fetching own job offers", error)
    return []
  }
}

export async function fetchMyEvents(token: string, userId: number): Promise<Event[]> {
  try {
    const res = await fetch(
      `${strapiUrl}/api/events?filters[owner][id][$eq]=${userId}&sort=start:desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      console.warn("Failed to fetch own events:", await res.text())
      return []
    }
    const result = await res.json()
    return (result?.data ?? []) as unknown as Event[]
  } catch (error) {
    console.error("Error fetching own events", error)
    return []
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
