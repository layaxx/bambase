import { expect, test, type Browser, type Page } from "@playwright/test"

/**
 * A report has no permission of its own: /admin/reports/events needs "event:moderate" and
 * /admin/reports/jobs needs "jobOffer:moderate", both from the better-auth `admin` plugin.
 * Each test logs in inline, because it must change between the seed user, who owns the event
 * or sends an anonymous report, and the seeded admin@example.com account.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

function uniqueTitle() {
  return `E2E Admin Report Test Event ${Date.now()}`
}

async function createEvent(page: Page, title: string): Promise<string> {
  await page.goto("/event/new")
  await page.fill("#title", title)
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", "2099-12-01T18:00")
  await page.fill("#end", "2099-12-01T20:00")
  await page.fill("#description", "Automated E2E test event — safe to delete.")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)
  return page.url()
}

async function reportEvent(browser: Browser, eventUrl: string) {
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(eventUrl)
  await anonPage.getByRole("button", { name: "Veranstaltung melden" }).click()
  await expect(anonPage.locator("#reportModal")).toBeVisible()
  await anonPage.selectOption("#report-reason", "spam")
  await anonPage.locator("#reportModal").getByRole("button", { name: "Melden" }).click()
  await expect(anonPage).toHaveURL(/\?reported=success/)
  await anonContext.close()
}

test("non-moderator visiting /admin/reports/events is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/reports/events")
  await expect(page).not.toHaveURL(/\/admin\/reports/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/reports/events")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/reports\/events/)
})

test("reports hub links to the events and jobs queues", async ({ page }) => {
  await login(page, "admin@example.com", "Admin1234!")
  await page.goto("/admin/reports")
  await expect(page.getByRole("link", { name: /Gemeldete Veranstaltungen/ })).toHaveAttribute(
    "href",
    "/admin/reports/events"
  )
  await expect(page.getByRole("link", { name: /Gemeldete Stellenangebote/ })).toHaveAttribute(
    "href",
    "/admin/reports/jobs"
  )
})

test("moderator can dismiss and reopen a report", async ({ page, browser }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const eventUrl = await createEvent(page, title)
  await reportEvent(browser, eventUrl)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto("/admin/reports/events")

  const reportCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(reportCard).toBeVisible()
  await reportCard.getByRole("button", { name: "Alle verwerfen" }).click()

  await expect(adminPage.getByTestId("reports-queue")).not.toContainText(title)

  await adminPage.goto("/admin/reports/events?status=resolved")
  const dismissedCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(dismissedCard).toBeVisible()

  await dismissedCard.getByRole("button", { name: "Alle wiedereröffnen" }).click()

  // A reopen goes back to the default view, which shows the open reports. The reopened
  // report must be visible there again.
  await expect(adminPage).toHaveURL(/\/admin\/reports\/events$/)
  await expect(adminPage.locator(".rounded-xl", { hasText: title })).toBeVisible()
  await adminContext.close()

  await page.goto(eventUrl)
  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL("/account/events")
})

test("moderator can unpublish and republish a reported event directly from the queue", async ({
  page,
  browser,
}) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const eventUrl = await createEvent(page, title)
  await reportEvent(browser, eventUrl)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto("/admin/reports/events")

  const reportCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(reportCard).toBeVisible()
  await reportCard.getByRole("button", { name: "Depublizieren" }).click()

  // An unpublish resolves the case immediately, and the review status of each report has no
  // effect. The case thus goes out of the default "open" queue...
  await expect(adminPage).toHaveURL(/\/admin\/reports\/events$/)
  await expect(adminPage.getByTestId("reports-queue")).not.toContainText(title)

  // ...and into the "resolved" queue, marked as unpublished and with a way back.
  await adminPage.goto("/admin/reports/events?status=resolved")
  const unpublishedCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(unpublishedCard).toBeVisible()
  await expect(unpublishedCard.getByText("Depubliziert")).toBeVisible()

  await page.goto(eventUrl)
  await expect(page.getByRole("heading", { name: /nicht gefunden/i })).toBeVisible()

  await unpublishedCard.getByRole("button", { name: "Veröffentlichen" }).click()
  await expect(adminPage).toHaveURL(/\/admin\/reports\/events$/)
  // If the report is still open, a new publish moves the case back to "open".
  await expect(adminPage.locator(".rounded-xl", { hasText: title })).toBeVisible()
  await adminContext.close()

  await page.goto(eventUrl)
  await expect(page.getByRole("heading", { name: title })).toBeVisible()
  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL("/account/events")
})
