import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import MensaMealItem from "./MensaMealItem.astro"
import type { MensaMeal } from "@/utils/api"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const locals = { locale: "de" as const }

const baseMeal: MensaMeal = {
  id: "1",
  name: "Spaghetti Bolognese",
  location: "Feki",
  priceStudents: 3.5,
  isVegan: false,
  isVegetarian: false,
}

describe("MensaMealItem", () => {
  it("renders the meal name", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: baseMeal },
    })
    expect(html).toContain("Spaghetti Bolognese")
  })

  it("renders the price formatted to 2 decimal places", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: baseMeal },
    })
    expect(html).toContain("3.50")
    expect(html).toContain("€")
  })

  it("shows the Vegan badge when isVegan is true", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: { ...baseMeal, isVegan: true } },
      locals,
    })
    expect(html).toContain("Vegan")
  })

  it("does not show the Vegan badge when isVegan is false", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: baseMeal },
    })
    expect(html).not.toContain("Vegan")
  })

  it("shows the Vegetarisch badge when isVegetarian is true", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: { ...baseMeal, isVegetarian: true } },
      locals,
    })
    expect(html).toContain("Vegetarisch")
  })

  it("does not show the Vegetarisch badge when isVegetarian is false", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: baseMeal },
    })
    expect(html).not.toContain("Vegetarisch")
  })

  it("shows allergen toggle when allergens are present", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: { ...baseMeal, allergens: [{ name: "Gluten" }, { name: "Laktose" }] } },
    })
    expect(html).toContain("Gluten")
    expect(html).toContain("Laktose")
    expect(html).toContain("Allergene anzeigen")
  })

  it("does not show allergen section when allergens is empty", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: { ...baseMeal, allergens: [] } },
    })
    expect(html).not.toContain("Allergene anzeigen")
  })

  it("renders with a custom id attribute", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: baseMeal, id: "meal-42" },
    })
    expect(html).toContain('id="meal-42"')
  })

  it("renders as a list item", async () => {
    const html = await container.renderToString(MensaMealItem, {
      props: { meal: baseMeal },
    })
    expect(html).toContain("<li")
  })
})
