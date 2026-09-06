import type { APIRoute } from "astro"
import { fetchLocations, type MapLocation } from "@/utils/api"

const VALID_CATEGORIES: MapLocation["category"][] = [
  "university",
  "library",
  "mensa",
  "sport",
  "venues",
  "other",
]

export const GET: APIRoute = async ({ url }) => {
  const raw = url.searchParams.get("category") ?? ""
  const category = (VALID_CATEGORIES as string[]).includes(raw)
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
