import { client, withTimeout } from "./client"
import { withCache } from "./cache"
import type { ApiResult } from "./types"

/**
 * Locations that can be linked to an event via Strapi's map_location relation.
 * Kept Strapi-backed (unlike the Prisma-backed `MapLocation`) until events
 * themselves move off Strapi, since the relation is stored by Strapi documentId.
 */
export type LinkableLocation = {
  documentId: string
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

export async function fetchLinkableLocations(
  category?: LinkableLocation["category"]
): Promise<ApiResult<LinkableLocation[]>> {
  const key = `linkable-locations:${category ?? "all"}`
  try {
    const result = await withCache(key, () =>
      withTimeout(
        client.collection("locations").find({
          sort: ["name:asc"],
          pagination: { limit: 500 },
          populate: ["address"],
          ...(category ? { filters: { category: { $eq: category } } } : {}),
        })
      )
    )
    return { data: (result.data ?? []) as unknown as LinkableLocation[], apiDown: false }
  } catch (error) {
    console.error("Error fetching linkable locations", error)
    return { data: [], apiDown: true }
  }
}
