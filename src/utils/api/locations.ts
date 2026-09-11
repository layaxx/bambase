import prisma from "../prisma"
import { withCache } from "./cache"
import { apiResult, type ApiResult } from "./types"
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

export function fetchLocations(
  category?: MapLocation["category"]
): Promise<ApiResult<MapLocation[]>> {
  return apiResult("Error fetching locations", [], async () => {
    const rows = await withCache(`locations:${category ?? "all"}`, () =>
      prisma.location.findMany({
        where: category ? { category } : undefined,
        orderBy: { name: "asc" },
        take: 500,
      })
    )
    return rows.map(toMapLocation)
  })
}

export function fetchLocationForAdmin(slug: string): Promise<ApiResult<MapLocation | null>> {
  return apiResult("Error fetching location for admin", null, async () => {
    const row = await prisma.location.findFirst({ where: { slug } })
    return row && toMapLocation(row)
  })
}

export function fetchAllLocationsForAdmin(limit = 500): Promise<ApiResult<MapLocation[]>> {
  return apiResult("Error fetching locations for admin", [], async () => {
    const rows = await prisma.location.findMany({
      orderBy: { name: "asc" },
      take: limit,
    })
    return rows.map(toMapLocation)
  })
}
