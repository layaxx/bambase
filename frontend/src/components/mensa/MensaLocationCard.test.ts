import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import MensaLocationCard from "./MensaLocationCard.astro"
import type { MensaMeal } from "@/utils/api"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const meal: MensaMeal = {
  id: "1",
  name: "Currywurst",
  location: "Feki",
  priceStudents: 2.8,
  isVegan: false,
  isVegetarian: false,
}

describe("MensaLocationCard", () => {
  it("renders the location label", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: { id: "loc-feki", label: "Feki", meals: [] },
    })
    expect(html).toContain("Feki")
  })

  it("shows 'Keine Gerichte' when there are no meals", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: { id: "loc-feki", label: "Feki", meals: [] },
    })
    expect(html).toContain("Keine Gerichte")
  })

  it("shows 'Keine Daten verfügbar' when meals array is empty", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: { id: "loc-feki", label: "Feki", meals: [] },
    })
    expect(html).toContain("Keine Daten verfügbar")
  })

  it("shows the meal count for a single meal", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: { id: "loc-feki", label: "Feki", meals: [meal] },
    })
    expect(html).toContain("1 Gericht")
  })

  it("uses plural 'Gerichte' for multiple meals", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: {
        id: "loc-feki",
        label: "Feki",
        meals: [meal, { ...meal, id: "2", name: "Schnitzel" }],
      },
    })
    expect(html).toContain("2 Gerichte")
  })

  it("renders meal names when meals are present", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: { id: "loc-feki", label: "Feki", meals: [meal] },
    })
    expect(html).toContain("Currywurst")
  })

  it("uses the id prop for the container element", async () => {
    const html = await container.renderToString(MensaLocationCard, {
      props: { id: "loc-erba", label: "Erba", meals: [] },
    })
    expect(html).toContain('id="loc-erba"')
  })
})
