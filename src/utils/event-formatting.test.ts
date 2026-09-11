import { describe, expect, it } from "vitest"
import { formatTime } from "./event-formatting"

// The datetimes are local and have no Z suffix, thus the local time zone cannot move them.
// 2026-04-15 is a Wednesday.
const ISO_WEDNESDAY_MORNING = "2026-04-15T10:30:00"
const ISO_MIDNIGHT = "2026-04-15T00:00:00"

describe("formatTime", () => {
  it("returns a non-empty string", () => {
    expect(formatTime(ISO_WEDNESDAY_MORNING, "de-DE")).toBeTruthy()
  })

  it("includes the hour and minute", () => {
    const result = formatTime(ISO_WEDNESDAY_MORNING, "de-DE")
    expect(result).toContain("10")
    expect(result).toContain("30")
  })

  it("does not include the weekday name", () => {
    expect(formatTime(ISO_WEDNESDAY_MORNING, "de-DE")).not.toContain("Mittwoch")
  })

  it("does not include the month name", () => {
    expect(formatTime(ISO_WEDNESDAY_MORNING, "de-DE")).not.toContain("April")
  })

  it("formats midnight as 00:00", () => {
    const result = formatTime(ISO_MIDNIGHT, "de-DE")
    expect(result).toContain("00:00")
  })
})
