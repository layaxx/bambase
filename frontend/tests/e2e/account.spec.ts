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

// ─── Empty state (new user with no content) ─────────────────────────────────

test.describe("Account pages — empty state", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("new user sees empty-state message on /account/jobs and /account/events", async ({
    page,
  }) => {
    const email = `e2e-empty-${Date.now()}@example.com`
    await page.goto("/register")
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', "validpassword1")
    await page.fill('[name="passwordConfirm"]', "validpassword1")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL("/")

    await page.goto("/account/jobs")
    await expect(page.getByText("Du hast noch keine Stellenangebote inseriert.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Job inserieren" })).toBeVisible()

    await page.goto("/account/events")
    await expect(page.getByText("Du hast noch keine Veranstaltungen eingereicht.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Veranstaltung einreichen" })).toBeVisible()
  })
})
