import prisma from "../prisma"
import type { Prisma } from "@/generated/prisma/client"
import { findPage } from "../pagination"
import { toMapLocation, type MapLocation } from "./locations"
import { EventCategory } from "@/generated/prisma/enums"
import type { EventModel, LocationModel } from "@/generated/prisma/models"

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

function toEvent(
  row: EventModel,
  extra?: {
    reports?: { id: string }[]
    mapLocation?: LocationModel | null
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

async function findEventPage(
  where: Prisma.EventWhereInput,
  orderBy: Prisma.EventOrderByWithRelationInput,
  page: number,
  pageSize: number
): Promise<EventPage> {
  const { rows, ...rest } = await findPage(
    page,
    pageSize,
    (window) => prisma.event.findMany({ where, orderBy, ...window }),
    () => prisma.event.count({ where })
  )
  return { events: rows.map((row) => toEvent(row)), ...rest }
}

export function fetchEventsPaginated(filter: EventsFilter = {}): Promise<EventPage> {
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

  return findEventPage(where, { start: "asc" }, page, pageSize)
}

export async function fetchOngoingOrUpcomingEvents(limit = 100): Promise<Event[]> {
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  const rows = await prisma.event.findMany({
    where: {
      hidden: false,
      OR: [{ start: { gte: now, lte: endOfToday } }, { start: { lte: now }, end: { gte: now } }],
    },
    orderBy: { start: "asc" },
    take: limit,
  })
  return rows.map((row) => toEvent(row))
}

/** Fetches the events that did not end, together with their map location, for the map page. */
export async function fetchUpcomingMapEvents(limit = 200): Promise<Event[]> {
  const rows = await prisma.event.findMany({
    where: { end: { gte: new Date() }, mapLocationId: { not: null }, hidden: false },
    include: { mapLocation: true },
    orderBy: { start: "asc" },
    take: limit,
  })
  return rows.map((row) => toEvent(row, { mapLocation: row.mapLocation }))
}

/** Fetches a published event. With `viewerId`, the viewer's own unpublished events are found too. */
export async function fetchEvent(slug: string, viewerId?: string): Promise<Event | null> {
  const row = await prisma.event.findFirst({
    where: viewerId
      ? { slug, OR: [{ hidden: false }, { ownerId: viewerId }] }
      : { slug, hidden: false },
    include: {
      reports: { where: { reviewStatus: { not: "dismissed" } }, select: { id: true } },
      mapLocation: true,
    },
  })
  return row && toEvent(row, { reports: row.reports, mapLocation: row.mapLocation })
}

/** Fetches the slugs of all published events, past and future, for the sitemap. */
export async function fetchAllPublishedEventSlugs(limit = 500): Promise<string[]> {
  const rows = await prisma.event.findMany({
    where: { hidden: false },
    select: { slug: true },
    take: limit,
  })
  return rows.map((row) => row.slug)
}

export function fetchMyEvents(
  ownerId: string,
  { page = 1, pageSize = 20, search }: { page?: number; pageSize?: number; search?: string } = {}
): Promise<EventPage> {
  const where: Prisma.EventWhereInput = { ownerId }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { organizer: { contains: search, mode: "insensitive" } },
    ]
  }
  return findEventPage(where, { start: "desc" }, page, pageSize)
}

/** Fetches one event for the admin editor, also if the event is hidden. */
export async function fetchEventForAdmin(slug: string): Promise<Event | null> {
  const row = await prisma.event.findFirst({
    where: { slug },
    include: { mapLocation: true },
  })
  return row && toEvent(row, { mapLocation: row.mapLocation })
}

/** Fetches all events for the admin overview, also the hidden events. */
export async function fetchAllEventsForAdmin(limit = 100): Promise<Event[]> {
  const rows = await prisma.event.findMany({
    orderBy: { start: "desc" },
    take: limit,
  })
  return rows.map((row) => toEvent(row))
}
