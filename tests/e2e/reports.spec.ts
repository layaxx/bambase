/* eslint-disable no-await-in-loop */

import { expect, test } from "@playwright/test"
import { AUTH_FILE } from "../../playwright.config"

/**
 * Tests for the report submission flows.
 *
 * An anonymous visitor and an authenticated visitor can report a job and an event. After
 * REPORT_WARNING_THRESHOLD (3) reports against one listing, the page shows a warning alert
 * to each subsequent visitor.
 *
 * The job and the event from the seed data below have no owner (ownerId is null), thus the
 * seed user can always report them.
 *
 * Note: each test run adds more reports to these seeded slugs. This is not a problem in a
 * seeded test environment and needs no cleanup.
 */

const UNOWNED_JOB_URL = "/job/werkstudent-in-softwareentwicklung-feki-de-e-v"
const UNOWNED_EVENT_URL = "/event/ersti-party"

// ─── Anonymous visitor ──────────────────────────────────────────────────────

test.describe("Report — anonymous visitor", () => {
  test("can submit a job report and see success alert", async ({ page }) => {
    await page.goto(UNOWNED_JOB_URL)

    await page.getByRole("button", { name: "Job melden" }).click()
    await expect(page.locator("#reportModal")).toBeVisible()
    await page.selectOption("#report-reason", "spam")
    await page.locator("#reportModal").getByRole("button", { name: "Melden" }).click()

    await expect(page).toHaveURL(/\?reported=success/)
    await expect(page.locator(".alert-success")).toBeVisible()
  })

  test("can submit an event report and see success alert", async ({ page }) => {
    await page.goto(UNOWNED_EVENT_URL)

    await page.getByRole("button", { name: "Veranstaltung melden" }).click()
    await expect(page.locator("#reportModal")).toBeVisible()
    await page.selectOption("#report-reason", "outdated")
    await page.locator("#reportModal").getByRole("button", { name: "Melden" }).click()

    await expect(page).toHaveURL(/\?reported=success/)
    await expect(page.locator(".alert-success")).toBeVisible()
  })

  test("report modal contains all four reason options", async ({ page }) => {
    await page.goto(UNOWNED_JOB_URL)

    await page.getByRole("button", { name: "Job melden" }).click()
    await expect(page.locator("#reportModal")).toBeVisible()

    const select = page.locator("#report-reason")
    await expect(select.locator('option[value="spam"]')).toBeAttached()
    await expect(select.locator('option[value="inappropriate"]')).toBeAttached()
    await expect(select.locator('option[value="outdated"]')).toBeAttached()
    await expect(select.locator('option[value="other"]')).toBeAttached()
  })
})

// ─── Authenticated seed user ────────────────────────────────────────────────

test.describe("Report — authenticated seed user", () => {
  test.use({ storageState: AUTH_FILE })

  test("can submit a job report and see success alert", async ({ page }) => {
    await page.goto(UNOWNED_JOB_URL)

    const reportBtn = page.getByRole("button", { name: "Job melden" })
    await expect(reportBtn).toBeVisible()

    await reportBtn.click()
    await expect(page.locator("#reportModal")).toBeVisible()
    await page.selectOption("#report-reason", "spam")
    await page.locator("#reportModal").getByRole("button", { name: "Melden" }).click()

    await expect(page).toHaveURL(/\?reported=success/)
    await expect(page.locator(".alert-success")).toBeVisible()
  })

  test("can submit an event report and see success alert", async ({ page }) => {
    await page.goto(UNOWNED_EVENT_URL)

    const reportBtn = page.getByRole("button", { name: "Veranstaltung melden" })
    await expect(reportBtn).toBeVisible()

    await reportBtn.click()
    await expect(page.locator("#reportModal")).toBeVisible()
    await page.selectOption("#report-reason", "outdated")
    await page.locator("#reportModal").getByRole("button", { name: "Melden" }).click()

    await expect(page).toHaveURL(/\?reported=success/)
    await expect(page.locator(".alert-success")).toBeVisible()
  })

  test("owner does not see report button on their own job", async ({ page }) => {
    // Create a new job that the seed user owns, thus the test does not change the seed data.
    await page.goto("/job/new")
    await page.fill("#title", `Owner report test job ${Date.now()}`)
    await page.fill("#company", "E2E Corp")
    await page.fill("#location", "Bamberg")
    await page.fill("#working_hours", "20")
    await page.fill("#description", "Automated E2E test — safe to delete.")
    await page.fill("#contact_name", "Test Contact")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/job\/[a-z0-9-]+$/)

    await expect(page.getByRole("button", { name: "Job melden" })).not.toBeVisible()
    await expect(page.getByRole("button", { name: "Löschen" })).toBeVisible()

    await page.getByRole("button", { name: "Löschen" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
    await expect(page).toHaveURL("/account/jobs")
  })

  test("owner does not see report button on their own event", async ({ page }) => {
    await page.goto("/event/new")
    await page.fill("#title", `Owner report test event ${Date.now()}`)
    await page.fill("#organizer", "TestOrg")
    await page.fill("#start", "2099-12-01T18:00")
    await page.fill("#end", "2099-12-01T20:00")
    await page.fill("#description", "Testing report button visibility for event owner.")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/event\//)

    await expect(page.getByRole("button", { name: "Veranstaltung melden" })).not.toBeVisible()

    await page.getByRole("button", { name: "Löschen" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
    await expect(page).toHaveURL("/account/events")
  })
})

// ─── Warning threshold ──────────────────────────────────────────────────────

test.describe("Report warning — threshold reached", () => {
  /**
   * Each test creates a separate listing that the seed user owns. Then it sends
   * REPORT_WARNING_THRESHOLD (3) reports from independent anonymous browser contexts, and
   * makes sure that the page shows the warning alert to each subsequent visitor. The test
   * deletes the listing at the end, thus the database stays clean.
   *
   * A separate browser context gives each report a new session. This is equal to the real
   * condition, in which different users send the reports.
   */

  test.use({ storageState: AUTH_FILE })

  test.skip("job page shows warning alert after 3 reports", async ({ page, browser }) => {
    await page.goto("/job/new")
    await page.fill("#title", `Warning threshold test job ${Date.now()}`)
    await page.fill("#company", "E2E Corp")
    await page.fill("#location", "Bamberg")
    await page.fill("#working_hours", "20")
    await page.fill("#description", "Automated E2E test — safe to delete.")
    await page.fill("#contact_name", "Test Contact")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/job\/[a-z0-9-]+$/)
    const jobUrl = page.url()

    for (let i = 0; i < 3; i++) {
      const anonCtx = await browser.newContext({ storageState: undefined })
      const anonPage = await anonCtx.newPage()
      await anonPage.goto(jobUrl)
      await expect(anonPage.locator(".alert-warning")).not.toBeVisible()
      await anonPage.getByRole("button", { name: "Job melden" }).click()
      await expect(anonPage.locator("#reportModal")).toBeVisible()
      await anonPage.selectOption("#report-reason", "spam")
      await anonPage.locator("#reportModal").getByRole("button", { name: "Melden" }).click()
      await expect(anonPage).toHaveURL(/\?reported=success/)
      await anonCtx.close()
    }

    await page.goto(jobUrl)
    await expect(page.locator(".alert-warning")).toBeVisible()

    await page.getByRole("button", { name: "Löschen" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
    await expect(page).toHaveURL("/account/jobs")
  })

  test("event page shows warning alert after 3 reports", async ({ browser, page }) => {
    await page.goto("/event/new")
    await page.fill("#title", `Warning threshold test event ${Date.now()}`)
    await page.fill("#organizer", "E2E Organizer")
    await page.fill("#start", "2099-12-01T18:00")
    await page.fill("#end", "2099-12-01T20:00")
    await page.fill("#description", "Automated E2E test — safe to delete.")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/event\/[a-z0-9-]+$/)
    const eventUrl = page.url()

    await expect(page.locator(".alert-warning")).not.toBeVisible()

    for (let i = 0; i < 3; i++) {
      const anonCtx = await browser.newContext({ storageState: undefined })
      const anonPage = await anonCtx.newPage()
      await anonPage.goto(eventUrl)
      await anonPage.getByRole("button", { name: "Veranstaltung melden" }).click()
      await expect(anonPage.locator("#reportModal")).toBeVisible()
      await anonPage.selectOption("#report-reason", "spam")
      await anonPage.locator("#reportModal").getByRole("button", { name: "Melden" }).click()
      await expect(anonPage).toHaveURL(/\?reported=success/)
      await anonCtx.close()
    }

    await page.goto(eventUrl)
    await expect(page.locator(".alert-warning")).toBeVisible()

    await page.getByRole("button", { name: "Löschen" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
    await expect(page).toHaveURL("/account/events")
  })
})
