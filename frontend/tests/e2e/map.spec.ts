import { expect, test } from "@playwright/test"

const CATEGORY_BUTTONS = [
  "Uni-Gebäude",
  "Mensa & Cafeteria",
  "Bibliotheken",
  "Sport",
  "Cafés, Bars & Clubs",
  "Sonstiges",
]

test.describe("Map (/map) — category filter behavior", () => {
  test("initial list is populated by JavaScript on page load", async ({ page }) => {
    await page.goto("/map")
    await expect(page.locator("#location-list button[data-id]").first()).toBeVisible()
  })

  test("clicking a category shows a loading spinner and disables all buttons", async ({ page }) => {
    await page.goto("/map")
    await expect(page.locator("#location-list button[data-id]").first()).toBeVisible()

    // Hold the response open so there is time to assert the loading state
    let releaseRoute: () => void
    const hold = new Promise<void>((resolve) => {
      releaseRoute = resolve
    })
    await page.route("/api/locations.json*", async (route) => {
      await hold
      await route.continue()
    })

    await page.getByRole("button", { name: "Bibliotheken", exact: true }).click()

    await expect(page.locator("#location-list .loading")).toBeVisible()
    for (const name of CATEGORY_BUTTONS) {
      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled()
    }

    releaseRoute!()
  })

  test("successful category switch updates the active button and list", async ({ page }) => {
    await page.goto("/map")
    await expect(page.locator("#location-list button[data-id]").first()).toBeVisible()

    await page.getByRole("button", { name: "Bibliotheken", exact: true }).click()

    await expect(page.getByRole("button", { name: "Bibliotheken", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(page.getByRole("button", { name: "Uni-Gebäude", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false"
    )

    await expect(page.locator("#location-list .loading")).not.toBeVisible()
    await expect(page.locator("#location-list [role=alert]")).not.toBeVisible()
  })
})

test.describe("Map (/map) — API error behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/map")
    await expect(page.locator("#location-list button[data-id]").first()).toBeVisible()
    // Subsequent category fetches will return 503
    await page.route("/api/locations.json*", (route) => route.fulfill({ status: 503 }))
    await page.getByRole("button", { name: "Bibliotheken", exact: true }).click()
    await expect(page.locator("#location-list [role=alert]")).toBeVisible()
  })

  test("shows the API-down warning inside the location list", async ({ page }) => {
    await expect(page.locator("#location-list [role=alert]")).toContainText(
      "Der Service ist momentan nicht erreichbar"
    )
  })

  test("all category buttons are re-enabled after the error", async ({ page }) => {
    for (const name of CATEGORY_BUTTONS) {
      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByRole("button", { name, exact: true })).toBeEnabled()
    }
  })

  test("active button reverts to the previously selected category", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Uni-Gebäude", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(page.getByRole("button", { name: "Bibliotheken", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })
})
