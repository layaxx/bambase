import { client } from "./client"

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

export async function fetchLocations(): Promise<MapLocation[]> {
  try {
    const result = await client.collection("locations").find({
      sort: ["name:asc"],
      pagination: { limit: 500 },
      populate: ["address"],
    })
    return (result.data ?? []) as unknown as MapLocation[]
  } catch (error) {
    console.error("Error fetching locations", error)
    return []
  }
}
