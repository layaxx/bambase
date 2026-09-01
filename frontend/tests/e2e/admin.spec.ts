import { expect, test, type Page } from "@playwright/test"

/**
 * Job-offer moderation queue (/admin/jobs) — gated by the "moderator"/"admin"
 * roles from the better-auth `admin` plugin. Each test logs in inline (no
 * shared storageState) since it needs to switch between the non-moderator
 * seed user and the seeded admin@example.com account.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

function uniqueTitle() {
  return `E2E Admin Test Job ${Date.now()}`
}

async function createJob(page: Page, title: string): Promise<string> {
  await page.goto("/job/new")
  await page.fill("#title", title)
  await page.fill("#company", "E2E Corp")
  await page.fill("#location", "Bamberg")
  await page.fill("#working_hours", "20")
  await page.fill("#description", "Automated E2E test job — safe to delete.")
  await page.fill("#contact_name", "Test Contact")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/job\/[a-z0-9-]+$/)
  return page.url()
}

test("non-moderator visiting /admin/jobs is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/jobs")
  await expect(page).not.toHaveURL(/\/admin\/jobs/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/jobs")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/jobs/)
})

test("moderator can approve a submitted job", async ({ page, browser }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const jobUrl = await createJob(page, title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto("/admin/jobs")

  const jobCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(jobCard).toBeVisible()
  await jobCard.getByRole("button", { name: "Genehmigen" }).click()

  await expect(adminPage.getByTestId("job-queue")).not.toContainText(title)
  const decidedCard = adminPage.getByTestId("recent-decisions").locator(".rounded-xl", {
    hasText: title,
  })
  await expect(decidedCard).toContainText("Veröffentlicht")
  await adminContext.close()

  await page.goto(jobUrl)
  await expect(page.locator("body")).not.toContainText("Dieses Angebot ist nur für dich sichtbar.")

  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
})

test("moderator can reject a submitted job", async ({ page, browser }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const jobUrl = await createJob(page, title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto("/admin/jobs")

  const jobCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(jobCard).toBeVisible()
  await jobCard.getByRole("button", { name: "Ablehnen" }).click()

  await expect(adminPage.getByTestId("job-queue")).not.toContainText(title)
  const decidedCard = adminPage.getByTestId("recent-decisions").locator(".rounded-xl", {
    hasText: title,
  })
  await expect(decidedCard).toContainText("Abgelehnt")
  await adminContext.close()

  await page.goto(jobUrl)
  await expect(page.locator("body")).toContainText("Abgelehnt")

  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
})
