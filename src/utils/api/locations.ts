import prisma from "../prisma"
import { LocationCategory } from "@/generated/prisma/enums"
import type { LocationModel } from "@/generated/prisma/models"

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

export function toMapLocation(row: LocationModel): MapLocation {
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

export async function fetchLocations(category?: MapLocation["category"]): Promise<MapLocation[]> {
  const rows = await prisma.location.findMany({
    where: category ? { category } : undefined,
    orderBy: { name: "asc" },
    take: 500,
  })
  return rows.map(toMapLocation)
}

export async function fetchLocationForAdmin(slug: string): Promise<MapLocation | null> {
  const row = await prisma.location.findFirst({ where: { slug } })
  return row && toMapLocation(row)
}

export async function fetchAllLocationsForAdmin(limit = 500): Promise<MapLocation[]> {
  const rows = await prisma.location.findMany({
    orderBy: { name: "asc" },
    take: limit,
  })
  return rows.map(toMapLocation)
}
