import type { APIRoute } from "astro"
import { fetchLocations, LOCATION_CATEGORIES, type MapLocation } from "@/utils/api/locations"

export const GET: APIRoute = async ({ url }) => {
  const raw = url.searchParams.get("category") ?? ""
  const category = (LOCATION_CATEGORIES as string[]).includes(raw)
    ? (raw as MapLocation["category"])
    : undefined

  const locations = await fetchLocations(category)

  return new Response(JSON.stringify(locations), {
    // Staff-curated data that the map fetches on each filter click; 5 min staleness is fine.
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  })
}
