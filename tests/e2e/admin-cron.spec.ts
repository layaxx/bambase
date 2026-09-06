import { expect, test, type Page } from "@playwright/test"

/**
 * Cron job status page (/admin/cron) — gated by the "system:view" permission
 * from the better-auth `admin` plugin. Only exercises the "job-offer-expiry"
 * job via "Jetzt ausführen": unlike the sync jobs, it only touches the local
 * database (no outbound requests to feki.de/UniVis/the Mensa API), so it's
 * safe to trigger for real in e2e.
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
