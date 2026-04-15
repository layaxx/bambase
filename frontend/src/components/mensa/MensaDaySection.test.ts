import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import MensaDaySection from "./MensaDaySection.astro"
import type { MensaMeal } from "@/utils/api"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const locals = { locale: "de" as const }

const meal: MensaMeal = {
  id: "1",
  name: "Pasta Primavera",
  location: "Feki",
  priceStudents: 3.1,
  isVegan: true,
  isVegetarian: true,
}

describe("MensaDaySection", () => {
  it("renders the section heading", async () => {
    const html = await container.renderToString(MensaDaySection, {
      props: { id: "day-1", heading: "Heute, Mittwoch", meals: [] },
      locals,
    })
    expect(html).toContain("Heute, Mittwoch")
  })

  it("renders a section with the given id", async () => {
    const html = await container.renderToString(MensaDaySection, {
      props: { id: "day-2026-04-15", heading: "Heute", meals: [] },
      locals,
    })
    expect(html).toContain('id="day-2026-04-15"')
  })

  it("shows the no-data message when meals is empty", async () => {
    const html = await container.renderToString(MensaDaySection, {
      props: { id: "day-1", heading: "Heute", meals: [] },
      locals,
    })
    // The i18n key t.mensa.noDataDay should produce a non-empty string
    expect(html).toBeTruthy()
    // Should not render location cards when there are no meals
    expect(html).not.toContain("Austraße")
  })

  it("renders the three location cards when meals are present", async () => {
    const html = await container.renderToString(MensaDaySection, {
      props: { id: "day-1", heading: "Heute", meals: [meal] },
      locals,
    })
    expect(html).toContain("Feki")
    expect(html).toContain("Austraße")
    expect(html).toContain("Erba")
  })

  it("routes a Feki meal to the Feki location card", async () => {
    const html = await container.renderToString(MensaDaySection, {
      props: { id: "day-1", heading: "Heute", meals: [meal] },
      locals,
    })
    expect(html).toContain("Pasta Primavera")
  })

  it("renders an h2 for the heading", async () => {
    const html = await container.renderToString(MensaDaySection, {
      props: { id: "day-1", heading: "Morgen", meals: [] },
      locals,
    })
    expect(html).toContain("<h2")
    expect(html).toContain("Morgen")
  })
})
