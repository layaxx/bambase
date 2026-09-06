import prisma from "../prisma"
import { withCache } from "./cache"
import type { ApiResult } from "./types"
import { LocationCategory } from "@/generated/prisma/enums"

export const LOCATION_CATEGORIES = Object.values(LocationCategory)

export type MapLocation = {
  id: string
  slug: string
  name: string
  description?: string
  lat: number
  lon: number
  category: LocationCategory
  external_url?: string
  address?: {
    street?: string
    streetNumber?: string
    city?: string
    zip?: string
  }
}

export function toMapLocation(row: {
  id: string
  slug: string
  name: string
  description: string | null
  lat: number
  lon: number
  category: LocationCategory
  externalUrl: string | null
  addressStreet: string | null
  addressStreetNumber: string | null
  addressCity: string | null
  addressZip: string | null
}): MapLocation {
  const hasAddress =
    row.addressStreet != null ||
    row.addressStreetNumber != null ||
    row.addressCity != null ||
    row.addressZip != null

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    lat: row.lat,
    lon: row.lon,
    category: row.category,
    external_url: row.externalUrl ?? undefined,
    address: hasAddress
      ? {
          street: row.addressStreet ?? undefined,
          streetNumber: row.addressStreetNumber ?? undefined,
          city: row.addressCity ?? undefined,
          zip: row.addressZip ?? undefined,
        }
      : undefined,
  }
}

export async function fetchLocations(
  category?: MapLocation["category"]
): Promise<ApiResult<MapLocation[]>> {
  const key = `locations:${category ?? "all"}`
  try {
    const rows = await withCache(key, () =>
      prisma.location.findMany({
        where: category ? { category } : undefined,
        orderBy: { name: "asc" },
        take: 500,
      })
    )
    return { data: rows.map(toMapLocation), apiDown: false }
  } catch (error) {
    console.error("Error fetching locations", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchLocationForAdmin(slug: string): Promise<ApiResult<MapLocation | null>> {
  try {
    const row = await prisma.location.findFirst({ where: { slug } })
    if (!row) return { data: null, apiDown: false }
    return { data: toMapLocation(row), apiDown: false }
  } catch (error) {
    console.error("Error fetching location for admin", error)
    return { data: null, apiDown: true }
  }
}

/** Fetch all locations for the admin overview. */
export async function fetchAllLocationsForAdmin(limit = 500): Promise<ApiResult<MapLocation[]>> {
  try {
    const rows = await prisma.location.findMany({
      orderBy: { name: "asc" },
      take: limit,
    })
    return { data: rows.map(toMapLocation), apiDown: false }
  } catch (error) {
    console.error("Error fetching locations for admin", error)
    return { data: [], apiDown: true }
  }
}
