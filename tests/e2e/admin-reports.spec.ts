import { type Browser } from "@playwright/test"
import { expect, login, moderate, test } from "./fixtures"

/**
 * A report has no permission of its own: /admin/reports/events needs "event:moderate" and
 * /admin/reports/jobs needs "jobOffer:moderate", both from the better-auth `admin` plugin.
 * Each test logs in inline, because it must change between the seed user, who owns the event
 * or sends an anonymous report, and the seeded admin@example.com account.
 */

function uniqueTitle() {
  return `E2E Admin Report Test Event ${Date.now()}`
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

test("moderator can dismiss and reopen a report", async ({ page, browser, listings }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const eventUrl = await listings.createEvent(title)
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
})

test("moderator can unpublish and republish a reported event directly from the queue", async ({
  page,
  browser,
  listings,
}) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const eventUrl = await listings.createEvent(title)
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

  // The owner still sees the event, everyone else does not.
  await page.goto(eventUrl)
  await expect(page.getByText("nur für dich sichtbar")).toBeVisible()
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(eventUrl)
  await expect(anonPage.getByRole("heading", { name: /nicht gefunden/i })).toBeVisible()
  await anonContext.close()

  await unpublishedCard.getByRole("button", { name: "Veröffentlichen" }).click()
  await expect(adminPage).toHaveURL(/\/admin\/reports\/events$/)
  // If the report is still open, a new publish moves the case back to "open".
  await expect(adminPage.locator(".rounded-xl", { hasText: title })).toBeVisible()
  await adminContext.close()

  await page.goto(eventUrl)
  await expect(page.getByRole("heading", { name: title })).toBeVisible()
})

test("moderator can take a reported job offline from the queue and publish it again", async ({
  page,
  browser,
  listings,
}) => {
  test.slow()
  await login(page, "seed@example.com", "Seed1234!")
  const title = `E2E Admin Report Test Job ${Date.now()}`
  const jobUrl = await listings.createJob(title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  // Only a published job can be reported, because nobody else sees a submitted one.
  await moderate(adminPage, title)

  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto(jobUrl)
  await anonPage.getByRole("button", { name: "Job melden" }).click()
  await anonPage.selectOption("#report-reason", "spam")
  await anonPage.locator("#reportModal").getByRole("button", { name: "Melden" }).click()
  await expect(anonPage).toHaveURL(/\?reported=success/)

  await adminPage.goto("/admin/reports/jobs")
  const reportCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(reportCard).toBeVisible()
  // For a job, the unpublish is a rejection, thus the reason is required.
  await reportCard.getByRole("textbox", { name: "Grund für die Ablehnung" }).fill("Spam")
  await reportCard.getByRole("button", { name: "Depublizieren" }).click()
  await expect(adminPage).toHaveURL(/\/admin\/reports\/jobs$/)
  await expect(adminPage.getByTestId("reports-queue")).not.toContainText(title)

  await adminPage.goto("/admin/reports/jobs?status=resolved")
  const unpublishedCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(unpublishedCard.getByText("Depubliziert")).toBeVisible()

  // The owner sees the rejection and its reason, everyone else sees nothing.
  await page.goto(jobUrl)
  await expect(page.getByRole("alert")).toContainText("Grund: Spam")
  await anonPage.goto(jobUrl)
  await expect(anonPage.getByRole("heading", { name: "Angebot nicht gefunden" })).toBeVisible()

  await unpublishedCard.getByRole("button", { name: "Veröffentlichen" }).click()
  await expect(adminPage).toHaveURL(/\/admin\/reports\/jobs$/)
  await expect(adminPage.locator(".rounded-xl", { hasText: title })).toBeVisible()
  await adminContext.close()

  await anonPage.goto(jobUrl)
  await expect(anonPage.getByRole("heading", { level: 1 })).toContainText(title)
  await anonContext.close()
})
