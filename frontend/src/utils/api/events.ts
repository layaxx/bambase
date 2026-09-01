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
  hidden: boolean
  rejection_reason?: string
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
  hidden: boolean
  rejectionReason: string | null
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
    hidden: row.hidden,
    rejection_reason: row.rejectionReason ?? undefined,
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

export type EventDateFilter = "upcoming" | "week" | "month"

export type EventsFilter = {
  category?: EventCategory
  dateFilter?: EventDateFilter
  page?: number
  pageSize?: number
}

export type EventPage = {
  events: Event[]
  total: number
  page: number
  pageCount: number
}

export async function fetchEventsPaginated(
  filter: EventsFilter = {}
): Promise<ApiResult<EventPage>> {
  const { category, dateFilter = "upcoming", page = 1, pageSize = 15 } = filter

  const now = new Date()
  const where = { hidden: false, end: { gte: now } } as {
    hidden: boolean
    end: { gte: Date }
    category?: EventCategory
    start?: { lte: Date }
  }
  if (category) where.category = category
  if (dateFilter === "week") where.start = { lte: new Date(now.getTime() + 7 * 86_400_000) }
  else if (dateFilter === "month") where.start = { lte: new Date(now.getTime() + 31 * 86_400_000) }

  const key = `events:paginated:${JSON.stringify({ category, dateFilter, page, pageSize })}`
  try {
    const { rows, total } = await withCache(key, async () => {
      const [rows, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: { start: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.event.count({ where }),
      ])
      return { rows, total }
    })
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    return {
      data: { events: rows.map((row) => toEvent(row)), total, page, pageCount },
      apiDown: false,
    }
  } catch (error) {
    console.error("Error fetching events (paginated)", error)
    return { data: { events: [], total: 0, page: 1, pageCount: 1 }, apiDown: true }
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

/** Fetch a single event regardless of hidden status, for admin editing. */
export async function fetchEventForAdmin(slug: string): Promise<ApiResult<Event | null>> {
  try {
    const row = await prisma.event.findFirst({
      where: { slug },
      include: { mapLocation: true },
    })
    if (!row) return { data: null, apiDown: false }

    return { data: toEvent(row, { mapLocation: row.mapLocation }), apiDown: false }
  } catch (error) {
    console.error("Error fetching event for admin", error)
    return { data: null, apiDown: true }
  }
}

/** Fetch all events regardless of hidden status, for the admin overview. */
export async function fetchAllEventsForAdmin(limit = 100): Promise<ApiResult<Event[]>> {
  try {
    const rows = await prisma.event.findMany({
      orderBy: { start: "desc" },
      take: limit,
    })
    return { data: rows.map((row) => toEvent(row)), apiDown: false }
  } catch (error) {
    console.error("Error fetching events for admin", error)
    return { data: [], apiDown: true }
  }
}
