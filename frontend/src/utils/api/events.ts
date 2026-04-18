import { client, strapiUrl } from "./client"

export const EVENT_CATEGORIES = [
  "university",
  "sport",
  "party",
  "culture",
  "social",
  "other",
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export type Event = {
  documentId: string
  slug: string
  title: string
  description: string
  start: string
  end: string
  organizer: string
  category: EventCategory
  external_url?: string
  owner?: { id: number }
  reports?: { documentId: string }[]
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

export async function fetchOngoingOrUpcomingEvents(limit = 100): Promise<Event[]> {
  try {
    const result = await client.collection("events").find({
      sort: ["start:asc"],
      filters: {
        $or: [
          {
            start: {
              $gte: new Date().toISOString(),
              $lte: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
            },
          },
          {
            start: { $lte: new Date().toISOString() },
            end: { $gte: new Date().toISOString() },
          },
        ],
      },
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
      populate: {
        owner: true,
        reports: {
          filters: { review_status: { $ne: "dismissed" } },
          fields: [],
        },
      },
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
