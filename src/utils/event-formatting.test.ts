import { describe, expect, it } from "vitest"
import { formatDateTime, formatTime } from "./event-formatting"

// Use a fixed local datetime (no Z suffix) to avoid timezone-dependent offsets.
// 2026-04-15 is a Wednesday.
const ISO_WEDNESDAY_MORNING = "2026-04-15T10:30:00"
const ISO_MIDNIGHT = "2026-04-15T00:00:00"
const ISO_NOON = "2026-04-15T12:00:00"

describe("formatDateTime", () => {
  it("returns a non-empty string", () => {
    expect(formatDateTime(ISO_WEDNESDAY_MORNING, "de-DE")).toBeTruthy()
  })

  it("includes the weekday name for de-DE locale", () => {
    expect(formatDateTime(ISO_WEDNESDAY_MORNING, "de-DE")).toContain("Mittwoch")
  })

  it("includes the month name for de-DE locale", () => {
    expect(formatDateTime(ISO_WEDNESDAY_MORNING, "de-DE")).toContain("April")
  })

  it("includes the hour and minute", () => {
    const result = formatDateTime(ISO_WEDNESDAY_MORNING, "de-DE")
    expect(result).toContain("10")
    expect(result).toContain("30")
  })

  it("includes the weekday name for en-US locale", () => {
    expect(formatDateTime(ISO_WEDNESDAY_MORNING, "en-US")).toContain("Wednesday")
  })

  it("formats midnight correctly", () => {
    const result = formatDateTime(ISO_MIDNIGHT, "de-DE")
    expect(result).toContain("00:00")
  })

  it("formats noon correctly", () => {
    const result = formatDateTime(ISO_NOON, "de-DE")
    expect(result).toContain("12")
  })
})

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

  it("produces a shorter string than formatDateTime for the same input", () => {
    const dt = formatDateTime(ISO_WEDNESDAY_MORNING, "de-DE")
    const t = formatTime(ISO_WEDNESDAY_MORNING, "de-DE")
    expect(t.length).toBeLessThan(dt.length)
  })
})
