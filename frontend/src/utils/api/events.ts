import { client, strapiUrl } from "./client"
import type { MapLocation } from "./locations"

export const EVENT_CATEGORIES = [
  "university",
  "sport",
  "party",
  "culture",
  "social",
  "other",
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export type EventMapLocation = Pick<
  MapLocation,
  "documentId" | "slug" | "name" | "lat" | "lon" | "category"
> & {
  address?: MapLocation["address"]
}

export type EventCustomLocation = {
  name: string
  address?: string
  city?: string
}

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
  map_location?: EventMapLocation
  custom_location?: EventCustomLocation
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

/** Fetch all future events with their map_location populated (used by the map page). */
export async function fetchUpcomingMapEvents(limit = 200): Promise<Event[]> {
  try {
    const result = await client.collection("events").find({
      sort: ["start:asc"],
      filters: { end: { $gte: new Date().toISOString() }, map_location: { $ne: null } },
      populate: { map_location: true },
      pagination: { limit },
    })
    return (result.data ?? []) as unknown as Event[]
  } catch (error) {
    console.error("Error fetching upcoming events", error)
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
        map_location: { populate: ["address"] },
        custom_location: true,
      },
      pagination: { limit: 1 },
    })
    return ((result.data ?? [])[0] ?? null) as unknown as Event | null
  } catch (error) {
    console.error("Error fetching event", error)
    return null
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
