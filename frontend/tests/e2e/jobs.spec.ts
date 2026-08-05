import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "../../playwright.config"

/**
 * Job offer CRUD flows — all tests run as the authenticated seed user.
 *
 * Tests that create a job are responsible for cleaning it up at the end
 * to avoid polluting the shared database.
 */

test.use({ storageState: AUTH_FILE })

// One of the seeded job offers — unowned (ownerId is null), so it's never
// owned by the seed user and is safe to use for non-owner assertions.
const SEEDED_JOB_URL = "/job/werkstudent-in-softwareentwicklung-feki-de-e-v"

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
  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
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

  await archiveBtn.click()
  await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click()
  await expect(page).toHaveURL(jobUrl)

  await expect(page.locator('[role="alert"]').first()).toBeVisible()
  await expect(archiveBtn).not.toBeVisible()

  await deleteJob(page)
})

test("delete job redirects to /account/jobs and removes it from the list", async ({ page }) => {
  const title = uniqueTitle()
  await createJob(page, title)

  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()

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
  await page.goto(SEEDED_JOB_URL)

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

/**
 * Astro Actions invoked via a plain <form action={actions.x.y}> render as a
 * POST to the current page URL with a `?_action=x.y` query param. Ownership
 * is enforced inside the action handler itself (src/actions/jobs.ts), which
 * throws ActionError({ code: "FORBIDDEN" }) — Astro maps that to HTTP 403.
 * Requests need an Origin/Referer matching the app's own origin, or Astro's
 * CSRF protection rejects them before the handler ever runs.
 */
test.describe("Ownership enforcement — job offers", () => {
  let jobId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_FILE })
    const pg = await ctx.newPage()
    await pg.goto(SEEDED_JOB_URL)
    // Report modal exposes the job's id as a hidden input for non-owner viewers.
    jobId = await pg.locator('input[name="target_id"]').inputValue()
    await ctx.close()
    expect(jobId).toBeTruthy()
  })

  function sameOriginHeaders(page: Page) {
    const origin = new URL(page.url()).origin
    return { Origin: origin, Referer: `${origin}${SEEDED_JOB_URL}` }
  }

  test("cannot delete another user's job offer — jobs.delete returns FORBIDDEN", async ({
    page,
  }) => {
    await page.goto(SEEDED_JOB_URL)
    const res = await page.request.post(`${SEEDED_JOB_URL}?_action=jobs.delete`, {
      form: { id: jobId },
      headers: sameOriginHeaders(page),
    })
    expect(res.status()).toBe(403)
  })

  test("cannot update another user's job offer — jobs.update returns FORBIDDEN", async ({
    page,
  }) => {
    await page.goto(SEEDED_JOB_URL)
    const res = await page.request.post(`${SEEDED_JOB_URL}?_action=jobs.update`, {
      form: {
        id: jobId,
        title: "Hijacked title",
        company: "Hijacked Co",
        location: "Nowhere",
        working_hours: "10",
        description: "hijack attempt",
      },
      headers: sameOriginHeaders(page),
    })
    expect(res.status()).toBe(403)
  })
})
