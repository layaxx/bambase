import { expect, test, type Page } from "@playwright/test"

/**
 * /admin/cron needs the "system:view" permission from the better-auth `admin` plugin.
 * The tests start only the "job-offer-expiry" job. It changes only the local database and
 * sends no request to feki.de, UniVIS or the Mensa API, which the sync jobs do. It is thus
 * safe to start it in an e2e test.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

test("non-system-viewer visiting /admin/cron is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/cron")
  await expect(page).not.toHaveURL(/\/admin\/cron/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/cron")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/cron/)
})

test("admin can run the job offer expiry job", async ({ page }) => {
  await login(page, "admin@example.com", "Admin1234!")
  await page.goto("/admin/cron")

  const jobRow = page.locator(".rounded-xl", { hasText: "Stellenangebote-Ablauf" })
  await expect(jobRow).toBeVisible()

  await jobRow.getByRole("button", { name: "Jetzt ausführen" }).click()
  await expect(page).toHaveURL(/\/admin\/cron$/)

  const updatedRow = page.locator(".rounded-xl", { hasText: "Stellenangebote-Ablauf" })
  await expect(updatedRow).toContainText("Erfolgreich")
})
