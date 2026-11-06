import { afterEach, describe, expect, it, vi } from "vitest"
import { formatJobLocation, formatRelativeDate } from "./job-formatting"
import type { JobOffer } from "./api/job-offers"

const labels = { remote: "Remote", hybrid: "Hybrid" }

function makeJob(work_mode: JobOffer["work_mode"], location = "Bamberg"): JobOffer {
  return { work_mode, location } as JobOffer
}

describe("formatJobLocation", () => {
  it("returns the remote label for remote jobs, ignoring location", () => {
    expect(formatJobLocation(makeJob("remote", "Bamberg"), labels)).toBe("Remote")
  })

  it("returns location with hybrid label in parentheses for hybrid jobs", () => {
    expect(formatJobLocation(makeJob("hybrid", "Bamberg"), labels)).toBe("Bamberg (Hybrid)")
  })

  it("returns just the location for on-site jobs", () => {
    expect(formatJobLocation(makeJob("on_site", "Bamberg"), labels)).toBe("Bamberg")
  })

  it("uses the provided remote label string", () => {
    expect(formatJobLocation(makeJob("remote"), { remote: "Fernarbeit", hybrid: "Hybrid" })).toBe(
      "Fernarbeit"
    )
  })

  it("uses the provided hybrid label string", () => {
    expect(
      formatJobLocation(makeJob("hybrid", "Nürnberg"), { remote: "Remote", hybrid: "Gemischt" })
    ).toBe("Nürnberg (Gemischt)")
  })
})

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("picks the largest unit that fits", () => {
    vi.useFakeTimers({ now: new Date("2026-04-15T12:00:00Z") })
    expect(formatRelativeDate("2026-04-12T12:00:00Z", "de")).toBe("vor 3 Tagen")
    expect(formatRelativeDate(new Date("2026-04-15T10:00:00Z"), "en")).toBe("2 hours ago")
  })

  it("does not round into the next unit", () => {
    vi.useFakeTimers({ now: new Date("2026-04-15T12:00:00Z") })
    const ago = (seconds: number) => new Date(Date.now() - seconds * 1000)
    expect(formatRelativeDate(ago(59.6 * 60), "de")).toBe("vor 1 Stunde")
    expect(formatRelativeDate(ago(23.6 * 60 * 60), "de")).toBe("vor 1 Tag")
    expect(formatRelativeDate(ago(364 * 24 * 60 * 60), "de")).toBe("vor 1 Jahr")
  })

  it("never says 0 seconds", () => {
    vi.useFakeTimers({ now: new Date("2026-04-15T12:00:00Z") })
    expect(formatRelativeDate(new Date(Date.now() + 200), "de")).toBe("vor 1 Sekunde")
    expect(formatRelativeDate(new Date(Date.now() - 200), "de")).toBe("vor 1 Sekunde")
    expect(formatRelativeDate(new Date(Date.now() + 2000), "de")).toBe("vor 1 Sekunde")
  })

  it("returns an empty string for an invalid date", () => {
    expect(formatRelativeDate("not a date", "de")).toBe("")
  })
})
