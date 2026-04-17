import { expect, test } from "@playwright/test"
import { AUTH_FILE } from "../../playwright.config"

/**
 * Account dashboard flows — all tests run as the authenticated seed user.
 */

test.use({ storageState: AUTH_FILE })

test.describe("Account dashboard (/account)", () => {
  test("links to My Job Listings and My Events are visible", async ({ page }) => {
    await page.goto("/account")
    await expect(page.getByRole("link", { name: "Meine Stellenangebote" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Meine Veranstaltungen" })).toBeVisible()
  })
})

test.describe("My Job Listings (/account/jobs)", () => {
  test("each job entry is a link to its detail page", async ({ page }) => {
    await page.goto("/account/jobs")

    const firstLink = page.locator('a[href^="/job/"]').first()
    await expect(firstLink).toBeVisible()
    await expect(firstLink).not.toHaveAttribute("href", "/job/new")
  })
})

test.describe("My Events (/account/events)", () => {
  test("each event entry is a link to its detail page", async ({ page }) => {
    await page.goto("/account/events")
    const firstLink = page.locator('a[href^="/event/"]').first()
    await expect(firstLink).toBeVisible()
    await expect(firstLink).not.toHaveAttribute("href", "/event/new")
  })
})
