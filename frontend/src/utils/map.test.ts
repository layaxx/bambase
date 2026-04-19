import { describe, expect, it } from "vitest"
import {
  filterEventsByTime,
  formatAddress,
  formatEventDate,
  groupByLocation,
  timeFilterBound,
  type MapEvent,
} from "./map"

// Fixed reference point: Wednesday 15 April 2026, noon (local time, no Z suffix
// to avoid timezone-dependent shifts that would change the calendar date).
const NOW = new Date("2026-04-15T12:00:00")

// ── formatAddress ─────────────────────────────────────────────────────────────

describe("formatAddress", () => {
  it("returns null for undefined", () => {
    expect(formatAddress(undefined)).toBeNull()
  })

  it("returns null for an empty object", () => {
    expect(formatAddress({})).toBeNull()
  })

  it("formats a full address", () => {
    expect(
      formatAddress({
        street: "Feldkirchenstraße",
        streetNumber: "21",
        city: "Bamberg",
        zip: 96052,
      })
    ).toBe("Feldkirchenstraße 21, 96052 Bamberg")
  })

  it("omits missing street number", () => {
    expect(formatAddress({ street: "Ludwigstraße", city: "Bamberg", zip: 96052 })).toBe(
      "Ludwigstraße, 96052 Bamberg"
    )
  })

  it("omits missing zip", () => {
    expect(
      formatAddress({ street: "An der Universität", streetNumber: "2", city: "Bamberg" })
    ).toBe("An der Universität 2, Bamberg")
  })

  it("returns only the city when street is absent", () => {
    expect(formatAddress({ city: "Bamberg" })).toBe("Bamberg")
  })
})

// ── timeFilterBound ───────────────────────────────────────────────────────────

describe("timeFilterBound", () => {
  it("returns end of the current calendar day for 'today'", () => {
    const bound = timeFilterBound("today", NOW)!
    expect(bound.getFullYear()).toBe(2026)
    expect(bound.getMonth()).toBe(3) // April = 3 (0-indexed)
    expect(bound.getDate()).toBe(15)
    expect(bound.getHours()).toBe(23)
    expect(bound.getMinutes()).toBe(59)
    expect(bound.getSeconds()).toBe(59)
    expect(bound.getMilliseconds()).toBe(999)
  })

  it("returns now + 7 days for 'week'", () => {
    const bound = timeFilterBound("week", NOW)!
    expect(bound.getTime()).toBe(NOW.getTime() + 7 * 86_400_000)
  })

  it("returns now + 31 days for 'month'", () => {
    const bound = timeFilterBound("month", NOW)!
    expect(bound.getTime()).toBe(NOW.getTime() + 31 * 86_400_000)
  })

  it("returns null for 'all'", () => {
    expect(timeFilterBound("all", NOW)).toBeNull()
  })

  it("returns null for an unknown key", () => {
    // @ts-expect-error Expected Error for the test case of an invalid key
    expect(timeFilterBound("unknown", NOW)).toBeNull()
  })
})

// ── filterEventsByTime ────────────────────────────────────────────────────────

const EVENTS: MapEvent[] = [
  // Same day as NOW (afternoon) — within "today", "week", "month", "all"
  { title: "Today", slug: "today", start: "2026-04-15T18:00:00", locationId: "loc1" },
  // Next day — within "week", "month", "all" but NOT "today"
  { title: "Tomorrow", slug: "tomorrow", start: "2026-04-16T10:00:00", locationId: "loc1" },
  // 10 days out — within "month" and "all" but NOT "today" or "week"
  { title: "10 days", slug: "ten-days", start: "2026-04-25T10:00:00", locationId: "loc2" },
  // 35 days out — only within "all"
  { title: "35 days", slug: "thirty-five-days", start: "2026-05-20T10:00:00", locationId: "loc2" },
]

describe("filterEventsByTime", () => {
  it("'today' keeps only same-day events", () => {
    const slugs = filterEventsByTime(EVENTS, "today", NOW).map((e) => e.slug)
    expect(slugs).toEqual(["today"])
  })

  it("'week' keeps events within 7 days", () => {
    const slugs = filterEventsByTime(EVENTS, "week", NOW).map((e) => e.slug)
    expect(slugs).toContain("today")
    expect(slugs).toContain("tomorrow")
    expect(slugs).not.toContain("ten-days")
    expect(slugs).not.toContain("thirty-five-days")
  })

  it("'month' keeps events within 31 days", () => {
    const slugs = filterEventsByTime(EVENTS, "month", NOW).map((e) => e.slug)
    expect(slugs).toContain("today")
    expect(slugs).toContain("tomorrow")
    expect(slugs).toContain("ten-days")
    expect(slugs).not.toContain("thirty-five-days")
  })

  it("'all' returns every event", () => {
    expect(filterEventsByTime(EVENTS, "all", NOW)).toHaveLength(4)
  })

  it("returns an empty array when the input is empty", () => {
    expect(filterEventsByTime([], "week", NOW)).toEqual([])
  })

  it("includes an event whose start equals the bound exactly", () => {
    // The week bound is NOW + 7 days; an event starting exactly then is included.
    const bound = new Date(NOW.getTime() + 7 * 86_400_000)
    const edgeEvent: MapEvent = {
      title: "Edge",
      slug: "edge",
      start: bound.toISOString(),
      locationId: "loc1",
    }
    const result = filterEventsByTime([edgeEvent], "week", NOW)
    expect(result).toHaveLength(1)
  })
})

// ── groupByLocation ───────────────────────────────────────────────────────────

describe("groupByLocation", () => {
  it("returns an empty object for an empty array", () => {
    expect(groupByLocation([])).toEqual({})
  })

  it("groups events by locationId", () => {
    const events: MapEvent[] = [
      { title: "A", slug: "a", start: "2026-04-15T10:00:00", locationId: "loc1" },
      { title: "B", slug: "b", start: "2026-04-16T10:00:00", locationId: "loc1" },
      { title: "C", slug: "c", start: "2026-04-17T10:00:00", locationId: "loc2" },
    ]
    const result = groupByLocation(events)
    expect(result["loc1"]).toHaveLength(2)
    expect(result["loc1"].map((e) => e.slug)).toEqual(["a", "b"])
    expect(result["loc2"]).toHaveLength(1)
    expect(result["loc2"][0].slug).toBe("c")
  })

  it("handles a single event", () => {
    const events: MapEvent[] = [
      { title: "Solo", slug: "solo", start: "2026-04-15T10:00:00", locationId: "loc-x" },
    ]
    const result = groupByLocation(events)
    expect(Object.keys(result)).toEqual(["loc-x"])
    expect(result["loc-x"]).toHaveLength(1)
  })
})

// ── formatEventDate ───────────────────────────────────────────────────────────

describe("formatEventDate", () => {
  // 2026-04-15 is a Wednesday.
  const ISO = "2026-04-15T18:30:00"

  it("returns a non-empty string", () => {
    expect(formatEventDate(ISO, "de-DE")).toBeTruthy()
  })

  it("includes the day number", () => {
    expect(formatEventDate(ISO, "de-DE")).toContain("15")
  })

  it("includes the hour", () => {
    expect(formatEventDate(ISO, "de-DE")).toContain("18")
  })

  it("includes the minute", () => {
    expect(formatEventDate(ISO, "de-DE")).toContain("30")
  })

  it("includes a locale-specific weekday abbreviation for de-DE", () => {
    expect(formatEventDate(ISO, "de-DE")).toMatch(/Mi|Wed/i)
  })
})
