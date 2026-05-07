import { client, withTimeout } from "./client"
import type { ApiResult } from "./types"

export type MapLocation = {
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

export async function fetchLocations(): Promise<ApiResult<MapLocation[]>> {
  try {
    const result = await withTimeout(
      client.collection("locations").find({
        sort: ["name:asc"],
        pagination: { limit: 500 },
        populate: ["address"],
      })
    )
    return { data: (result.data ?? []) as unknown as MapLocation[], apiDown: false }
  } catch (error) {
    console.error("Error fetching locations", error)
    return { data: [], apiDown: true }
  }
}
