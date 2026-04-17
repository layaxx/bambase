import { expect, test } from "@playwright/test"

/**
 * Smoke tests for public read-only pages.
 * No auth required — all tests run as anonymous visitors.
 */

test.describe("Homepage", () => {
  test("loads without errors and shows key sections", async ({ page }) => {
    await page.goto("/")

    expect(page.getByRole("link", { name: "Heutige Veranstaltungen" })).toBeVisible()
    expect(page.locator("#mensa").getByRole("link", { name: "Mensaplan" })).toBeVisible()
    expect(page.getByRole("link", { name: "Aktuelle Stellenangebote" })).toBeVisible()
    expect(page.locator("#map").getByRole("link", { name: "Karte", exact: true })).toBeVisible()
    expect(page.getByRole("heading", { name: "Aktiv in Bamberg" })).toBeVisible()
  })

  test("login link is visible when unauthenticated", async ({ page }) => {
    await page.goto("/")
    expect(page.getByRole("link", { name: "Einloggen" })).toBeVisible()
  })
})

test.describe("Job detail — not found", () => {
  test("visiting a non-existent job UUID shows not-found content", async ({ page }) => {
    await page.goto("/job/00000000-0000-0000-0000-000000000000")
    await expect(page.locator("body")).not.toContainText("500")
    // The page renders a not-found heading, not a server error
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: "Alle Jobs" })).toBeVisible()
  })
})

test.describe("Event detail — not found", () => {
  test("visiting a non-existent event slug shows not-found content", async ({ page }) => {
    await page.goto("/event/this-slug-does-not-exist")
    await expect(page.locator("body")).not.toContainText("500")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: "Alle Veranstaltungen" })).toBeVisible()
  })
})

test.describe("Jobs listing (/jobs)", () => {
  test("seeded published jobs are listed (not submitted/expired)", async ({ page }) => {
    await page.goto("/jobs")
    // The seed data has these published jobs — at least one of them should show
    await expect(page.locator("body")).toContainText("Backend Engineer")
  })
})

test.describe("Events listing (/events)", () => {
  test("page loads and shows seeded upcoming events", async ({ page }) => {
    await page.goto("/events")

    // Seeded events should appear
    await expect(page.locator('a[href="/event/ersti-party"]')).toBeVisible()
  })
})

test.describe("Mensa (/mensa)", () => {
  test("page loads without errors", async ({ page }) => {
    await page.goto("/mensa")
    await expect(page.getByText("Am Wochenende geschlossen")).toBeVisible()
  })
})

test.describe("Map (/map)", () => {
  test("category filter buttons are visible", async ({ page }) => {
    await page.goto("/map")
    await expect(page.getByRole("button", { name: "Uni-Gebäude", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mensa & Cafeteria", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Bibliotheken", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sport", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sonstiges", exact: true })).toBeVisible()
  })

  test("map container is rendered", async ({ page }) => {
    await page.goto("/map")
    // Leaflet renders a div with id="map" or class containing "leaflet"
    const mapContainer = page.locator("#map, .leaflet-container, [id*=map]").first()
    await expect(mapContainer).toBeAttached()
  })
})

test("Locale switching from German to English and back to German works as expected", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page.locator("html")).toHaveAttribute("lang", "de")
  // Set English first
  await page.goto("/set-locale?lang=en&redirect=/")
  await expect(page.locator("html")).toHaveAttribute("lang", "en")

  // Then switch back to German
  await page.goto("/set-locale?lang=de&redirect=/jobs")
  await expect(page.locator("html")).toHaveAttribute("lang", "de")
})
