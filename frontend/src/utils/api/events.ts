import prisma from "../prisma"
import { withCache } from "./cache"
import type { ApiResult } from "./types"
import { toMapLocation, type MapLocation } from "./locations"
import { EventCategory } from "@/generated/prisma/enums"

export const EVENT_CATEGORIES = Object.values(EventCategory)

export type { EventCategory }

export type EventMapLocation = Pick<
  MapLocation,
  "id" | "slug" | "name" | "lat" | "lon" | "category"
> & {
  address?: MapLocation["address"]
}

export type EventCustomLocation = {
  name: string
  address?: string
  city?: string
}

export type Event = {
  id: string
  slug: string
  title: string
  description: string
  start: string
  end: string
  organizer: string
  category: EventCategory
  external_url?: string
  external_id?: string
  ownerId?: string | null
  reports?: { id: string }[]
  map_location?: EventMapLocation
  custom_location?: EventCustomLocation
}

type EventRow = {
  id: string
  slug: string
  title: string
  description: string
  category: EventCategory
  start: Date
  end: Date
  organizer: string
  externalUrl: string | null
  externalId: string | null
  ownerId: string | null
  customLocationName: string | null
  customLocationAddress: string | null
  customLocationCity: string | null
}

function toEvent(
  row: EventRow,
  extra?: {
    reports?: { id: string }[]
    mapLocation?: Parameters<typeof toMapLocation>[0] | null
  }
): Event {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    start: row.start.toISOString(),
    end: row.end.toISOString(),
    organizer: row.organizer,
    category: row.category,
    external_url: row.externalUrl ?? undefined,
    external_id: row.externalId ?? undefined,
    ownerId: row.ownerId,
    reports: extra?.reports,
    map_location: extra?.mapLocation ? toMapLocation(extra.mapLocation) : undefined,
    custom_location:
      row.customLocationName != null
        ? {
            name: row.customLocationName,
            address: row.customLocationAddress ?? undefined,
            city: row.customLocationCity ?? undefined,
          }
        : undefined,
  }
}

export async function fetchEvents(limit = 100): Promise<ApiResult<Event[]>> {
  const key = `events:all:${limit}`
  try {
    const rows = await withCache(key, () =>
      prisma.event.findMany({
        where: { end: { gte: new Date() }, hidden: false },
        orderBy: { start: "asc" },
        take: limit,
      })
    )
    return { data: rows.map((row) => toEvent(row)), apiDown: false }
  } catch (error) {
    console.error("Error fetching events", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchOngoingOrUpcomingEvents(limit = 100): Promise<ApiResult<Event[]>> {
  const key = `events:ongoing-or-upcoming:${limit}`
  try {
    const now = new Date()
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)

    const rows = await withCache(key, () =>
      prisma.event.findMany({
        where: {
          hidden: false,
          OR: [
            { start: { gte: now, lte: endOfToday } },
            { start: { lte: now }, end: { gte: now } },
          ],
        },
        orderBy: { start: "asc" },
        take: limit,
      })
    )
    return { data: rows.map((row) => toEvent(row)), apiDown: false }
  } catch (error) {
    console.error("Error fetching events", error)
    return { data: [], apiDown: true }
  }
}

/** Fetch all future events with their map_location populated (used by the map page). */
export async function fetchUpcomingMapEvents(limit = 200): Promise<ApiResult<Event[]>> {
  const key = `events:upcoming-map:${limit}`
  try {
    const rows = await withCache(key, () =>
      prisma.event.findMany({
        where: { end: { gte: new Date() }, mapLocationId: { not: null }, hidden: false },
        include: { mapLocation: true },
        orderBy: { start: "asc" },
        take: limit,
      })
    )
    return {
      data: rows.map((row) => toEvent(row, { mapLocation: row.mapLocation })),
      apiDown: false,
    }
  } catch (error) {
    console.error("Error fetching upcoming events", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchEvent(slug: string): Promise<ApiResult<Event | null>> {
  try {
    const row = await prisma.event.findFirst({
      where: { slug, hidden: false },
      include: {
        reports: { where: { reviewStatus: { not: "dismissed" } }, select: { id: true } },
        mapLocation: true,
      },
    })
    if (!row) return { data: null, apiDown: false }

    return {
      data: toEvent(row, { reports: row.reports, mapLocation: row.mapLocation }),
      apiDown: false,
    }
  } catch (error) {
    console.error("Error fetching event", error)
    return { data: null, apiDown: true }
  }
}

/** Fetch slugs for all published events (past and future) for use in the sitemap. */
export async function fetchAllPublishedEventSlugs(limit = 500): Promise<ApiResult<string[]>> {
  try {
    const rows = await prisma.event.findMany({
      where: { hidden: false },
      select: { slug: true },
      take: limit,
    })
    return { data: rows.map((row) => row.slug), apiDown: false }
  } catch (error) {
    console.error("Error fetching event slugs for sitemap", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchMyEvents(ownerId: string): Promise<ApiResult<Event[]>> {
  try {
    const rows = await prisma.event.findMany({
      where: { ownerId },
      orderBy: { start: "desc" },
    })
    return { data: rows.map((row) => toEvent(row)), apiDown: false }
  } catch (error) {
    console.error("Error fetching own events", error)
    return { data: [], apiDown: true }
  }
}
