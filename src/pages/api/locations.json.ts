import type { APIRoute } from "astro"
import { fetchLocations, LOCATION_CATEGORIES, type MapLocation } from "@/utils/api/locations"

export const GET: APIRoute = async ({ url }) => {
  const raw = url.searchParams.get("category") ?? ""
  const category = (LOCATION_CATEGORIES as string[]).includes(raw)
    ? (raw as MapLocation["category"])
    : undefined

  const { data: locations, apiDown } = await fetchLocations(category)

  if (apiDown) {
    return new Response(null, { status: 503 })
  }

  return new Response(JSON.stringify(locations), {
    headers: { "Content-Type": "application/json" },
  })
}
