import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE, STRAPI_URL } from "../../playwright.config"

/**
 * Job offer CRUD flows — all tests run as the authenticated seed user.
 *
 * Tests that create a job are responsible for cleaning it up at the end
 * to avoid polluting the shared database.
 */

test.use({ storageState: AUTH_FILE })

// ─── Helpers ───────────────────────────────────────────────────────────────

function uniqueTitle() {
  return `E2E Test Job ${Date.now()}`
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

async function deleteJob(page: Page) {
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL("/account/jobs")
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test("create job with required fields and redirect to detail page", async ({ page }) => {
  const title = uniqueTitle()
  await createJob(page, title)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  await expect(page).toHaveURL(/\/job\/[a-z0-9-]+$/)

  await deleteJob(page)
})

test("job detail shows owner controls (Edit, Archive, Delete)", async ({ page }) => {
  const title = uniqueTitle()
  await createJob(page, title)

  await expect(page.getByRole("link", { name: "Bearbeiten" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Archivieren" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Löschen" })).toBeVisible()

  await deleteJob(page)
})

test("edit job title and verify updated title on detail page", async ({ page }) => {
  const title = uniqueTitle()
  const updatedTitle = `${title} (updated)`
  const jobUrl = await createJob(page, title)

  await page.getByRole("link", { name: "Bearbeiten" }).click()
  await expect(page).toHaveURL(/\/job\/.+\/edit$/)

  await page.fill("#title", updatedTitle)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(jobUrl)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(updatedTitle)

  await deleteJob(page)
})

test("archive job redirects to same page and shows status alert", async ({ page }) => {
  const title = uniqueTitle()
  const jobUrl = await createJob(page, title)

  // Archive button is shown for submitted/published jobs
  const archiveBtn = page.getByRole("button", { name: "Archivieren" })
  await expect(archiveBtn).toBeVisible()

  page.once("dialog", (dialog) => dialog.accept())
  await archiveBtn.click()
  await expect(page).toHaveURL(jobUrl)

  await expect(page.locator('[role="alert"]').first()).toBeVisible()
  await expect(archiveBtn).not.toBeVisible()

  await deleteJob(page)
})

test("delete job redirects to /account/jobs and removes it from the list", async ({ page }) => {
  const title = uniqueTitle()
  await createJob(page, title)

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Löschen" }).click()

  await expect(page).toHaveURL("/account/jobs")
  await expect(page.locator("body")).not.toContainText(title)
})

test("create job without required fields stays on /job/new (browser validation)", async ({
  page,
}) => {
  await page.goto("/job/new")
  await page.click('button[type="submit"]')
  // Browser's native required validation keeps us on the page
  await expect(page).toHaveURL("/job/new")
})

test("no owner controls shown for seed non-owner authenticated user", async ({ page }) => {
  await page.goto("/job/werkstudent-marketing")

  await expect(page.getByRole("button", { name: "Löschen" })).not.toBeVisible()
  await expect(page.getByRole("button", { name: "Archivieren" })).not.toBeVisible()
})

test("created job (not yet published) does not appear on the /jobs listing", async ({ page }) => {
  const title = uniqueTitle()
  const jobUrl = await createJob(page, title)

  await page.goto("/jobs")
  await expect(page.locator("body")).not.toContainText(title)

  await page.goto(jobUrl)
  await deleteJob(page)
})

test("job draft is cleared when navigating away without submitting", async ({ page }) => {
  await page.goto("/job/new")
  await page.fill("#title", "Draft that should be discarded")

  // Navigate away via link (not submit) — pagehide fires, draft cleared
  await page.getByRole("link", { name: "Alle Jobs" }).click()
  await expect(page).toHaveURL("/jobs")

  // Return to the form — sessionStorage draft should be gone
  await page.goto("/job/new")
  const titleValue = await page.locator("#title").inputValue()
  expect(titleValue).toBe("")
})

// ─── Privilege escalation ───────────────────────────────────────────────────

test.describe("Ownership enforcement — job offers", () => {
  let documentId: string
  let authToken: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_FILE })
    const pg = await ctx.newPage()
    await pg.goto("/job/werkstudent-marketing")
    // Report modal exposes the documentId as a hidden input for non-owner viewers
    documentId = await pg.locator('input[name="target_id"]').inputValue()
    const cookies = await ctx.cookies()
    authToken = cookies.find((c) => c.name === "auth_token")?.value ?? ""
    await ctx.close()
    expect(documentId).toBeTruthy()
    expect(authToken).toBeTruthy()
  })

  test("cannot DELETE another user's job offer — Strapi returns 403", async ({ page }) => {
    const res = await page.request.fetch(`${STRAPI_URL}/api/job-offers/${documentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    })
    expect(res.status()).toBe(403)
  })

  test("cannot PUT (update) another user's job offer — Strapi returns 403", async ({ page }) => {
    const res = await page.request.fetch(`${STRAPI_URL}/api/job-offers/${documentId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      data: JSON.stringify({ data: { title: "Hijacked title" } }),
    })
    expect(res.status()).toBe(403)
  })
})
