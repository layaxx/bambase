import { describe, expect, it } from "vitest"
import { formatJobLocation } from "./job-formatting"
import type { JobOffer } from "./api"

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
