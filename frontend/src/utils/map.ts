import type { MapLocation } from "./api/locations"

export type MapEvent = {
  title: string
  slug: string
  start: string
  locationId: string
}

/**
 * Formats a `MapLocation` address object into a single human-readable string.
 * Returns `null` when the address is absent or all fields are empty.
 *
 * Example: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: 96052 }
 *       → "Feldkirchenstraße 21, 96052 Bamberg"
 */
export function formatAddress(addr: MapLocation["address"]): string | null {
  if (!addr) return null
  const line1 = [addr.street, addr.streetNumber].filter(Boolean).join(" ")
  const line2 = [addr.zip, addr.city].filter(Boolean).join(" ")
  return [line1, line2].filter(Boolean).join(", ") || null
}

/**
 * Returns the inclusive upper-bound `Date` for the given event time-filter key,
 * relative to `now`.  Returns `null` for the "all" key (no upper bound).
 *
 * Keys:
 *  - `"today"`  → end of the current calendar day (23:59:59.999)
 *  - `"week"`   → `now` + 7 days
 *  - `"month"`  → `now` + 31 days
 *  - `"all"`    → `null`
 *
 * `now` defaults to `new Date()` but can be injected for deterministic testing.
 */
export function timeFilterBound(
  key: "today" | "week" | "month" | "all",
  now: Date = new Date()
): Date | null {
  if (key === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  }
  if (key === "week") return new Date(now.getTime() + 7 * 86_400_000)
  if (key === "month") return new Date(now.getTime() + 31 * 86_400_000)
  return null
}

/**
 * Filters `events` to those whose `start` datetime falls on or before the
 * upper bound for `timeKey`.  Events already filtered to `start >= now`
 * server-side, so only the upper bound is applied here.
 */
export function filterEventsByTime(
  events: MapEvent[],
  timeKey: "today" | "week" | "month" | "all",
  now: Date = new Date()
): MapEvent[] {
  const bound = timeFilterBound(timeKey, now)
  if (!bound) return events
  return events.filter((ev) => new Date(ev.start) <= bound)
}

/**
 * Groups a flat array of `MapEvent`s into a record keyed by `locationId`.
 */
export function groupByLocation(events: MapEvent[]): Record<string, MapEvent[]> {
  const result: Record<string, MapEvent[]> = {}
  for (const ev of events) {
    if (!result[ev.locationId]) result[ev.locationId] = []
    result[ev.locationId].push(ev)
  }
  return result
}

/**
 * Formats an ISO datetime string for display in a map popup.
 * Example (de-DE): "Mi., 15. Apr., 18:00"
 */
export function formatEventDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
