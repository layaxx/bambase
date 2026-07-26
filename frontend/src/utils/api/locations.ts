import prisma from "../prisma"
import { withCache } from "./cache"
import type { ApiResult } from "./types"

export type MapLocation = {
  id: string
  slug: string
  name: string
  description?: string
  lat: number
  lon: number
  category: "university" | "mensa" | "library" | "sport" | "venues" | "other"
  external_url?: string
  address?: {
    street?: string
    streetNumber?: string
    city?: string
    zip?: number
  }
}

function toMapLocation(row: {
  id: string
  slug: string
  name: string
  description: string | null
  lat: number
  lon: number
  category: string
  externalUrl: string | null
  addressStreet: string | null
  addressStreetNumber: string | null
  addressCity: string | null
  addressZip: number | null
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
    category: row.category as MapLocation["category"],
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
