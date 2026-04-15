import { describe, expect, it } from "vitest"
import dayjs from "dayjs"
import { getRelevantDay, groupMealsByDay, MENSA_CLOSING_HOUR } from "./mensa"
import type { GroupLabels } from "./mensa"

// ─── getRelevantDay ───────────────────────────────────────────────────────────

// Dates used across tests (verified day-of-week):
// 2026-04-13 Monday, 2026-04-14 Tuesday, 2026-04-17 Friday
// 2026-04-18 Saturday, 2026-04-19 Sunday, 2026-04-20 Monday

describe("getRelevantDay", () => {
  describe("weekday before closing time", () => {
    it("returns today on a Monday morning", () => {
      const now = dayjs("2026-04-13T09:00:00")
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-13")
    })

    it("returns today one minute before closing (14:59)", () => {
      const now = dayjs(`2026-04-13T${MENSA_CLOSING_HOUR - 1}:59:00`)
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-13")
    })
  })

  describe("weekday at/after closing time", () => {
    it("returns tomorrow on a Monday at exactly 15:00", () => {
      const now = dayjs("2026-04-13T15:00:00")
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-14")
    })

    it("returns tomorrow on a Tuesday afternoon", () => {
      const now = dayjs("2026-04-14T16:30:00")
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-15")
    })

    it("returns Monday (+3 days) on a Friday after closing", () => {
      const now = dayjs("2026-04-17T15:30:00")
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-20")
    })
  })

  describe("weekend", () => {
    it("returns Monday (+2 days) on a Saturday", () => {
      const now = dayjs("2026-04-18T10:00:00")
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-20")
    })

    it("returns Monday (+1 day) on a Sunday", () => {
      const now = dayjs("2026-04-19T10:00:00")
      expect(getRelevantDay(now).format("YYYY-MM-DD")).toBe("2026-04-20")
    })
  })
})

// ─── groupMealsByDay ──────────────────────────────────────────────────────────

const labels: GroupLabels = {
  today: "Heute",
  tomorrow: "Morgen",
  weekdays: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  weekendHeading: (sat, sun) => `Wochenende ${sat} – ${sun}`,
  dateLocale: "de-DE",
}

function day(iso: string) {
  return { day: dayjs(iso), meals: [] }
}

describe("groupMealsByDay", () => {
  it("labels index-0 weekday as 'today'", () => {
    const result = groupMealsByDay([day("2026-04-13")], labels) // Monday
    expect(result[0].type).toBe("weekday")
    expect(result[0].heading).toMatch(/^Heute,/)
  })

  it("labels index-1 weekday as 'tomorrow'", () => {
    const result = groupMealsByDay([day("2026-04-13"), day("2026-04-14")], labels)
    expect(result[1].heading).toMatch(/^Morgen,/)
  })

  it("labels index-2+ weekday with its weekday name", () => {
    const result = groupMealsByDay(
      [
        day("2026-04-13"), // Monday → today
        day("2026-04-14"), // Tuesday → tomorrow
        day("2026-04-15"), // Wednesday → weekday name
      ],
      labels
    )
    expect(result[2].heading).toMatch(/^Mittwoch,/)
  })

  it("merges consecutive Saturday+Sunday into a single weekend entry", () => {
    const result = groupMealsByDay([day("2026-04-18"), day("2026-04-19")], labels) // Sat + Sun
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("weekend")
    expect(result[0].heading).toMatch(/^Wochenende/)
  })

  it("uses the weekendHeading formatter for a merged weekend", () => {
    const result = groupMealsByDay([day("2026-04-18"), day("2026-04-19")], labels)
    expect(result[0].heading).toContain("Wochenende")
  })

  it("treats an isolated Saturday as a weekend entry", () => {
    const result = groupMealsByDay([day("2026-04-18")], labels) // Saturday only
    expect(result[0].type).toBe("weekend")
    expect(result[0].heading).toMatch(/^Samstag,/)
  })

  it("treats an isolated Sunday as a weekend entry", () => {
    const result = groupMealsByDay([day("2026-04-19")], labels) // Sunday only
    expect(result[0].type).toBe("weekend")
    expect(result[0].heading).toMatch(/^Sonntag,/)
  })

  it("uses the Saturday date as the id for a merged weekend", () => {
    const result = groupMealsByDay([day("2026-04-18"), day("2026-04-19")], labels)
    expect(result[0].id).toBe("2026-04-18")
  })

  it("sets the correct YYYY-MM-DD id on each entry", () => {
    const result = groupMealsByDay([day("2026-04-13")], labels)
    expect(result[0].id).toBe("2026-04-13")
  })

  it("returns an empty array for empty input", () => {
    expect(groupMealsByDay([], labels)).toEqual([])
  })

  it("attaches meals to weekday entries", () => {
    const meals = [
      {
        id: "1",
        name: "Pasta",
        location: "Feki" as const,
        priceStudents: 2.5,
        isVegan: false,
        isVegetarian: true,
      },
    ]
    const result = groupMealsByDay([{ day: dayjs("2026-04-13"), meals }], labels)
    expect(result[0].type).toBe("weekday")
    if (result[0].type === "weekday") {
      expect(result[0].meals).toEqual(meals)
    }
  })

  it("handles a week starting on Friday correctly (Fri today, Sat+Sun weekend, Mon)", () => {
    const input = [
      day("2026-04-17"), // Friday → today
      day("2026-04-18"), // Saturday
      day("2026-04-19"), // Sunday → merged with Saturday
      day("2026-04-20"), // Monday → weekday name (index 3)
    ]
    const result = groupMealsByDay(input, labels)
    expect(result).toHaveLength(3)
    expect(result[0].heading).toMatch(/^Heute,/) // Friday
    expect(result[1].type).toBe("weekend") // Sat+Sun merged
    expect(result[2].heading).toMatch(/^Montag,/) // Monday
  })
})
