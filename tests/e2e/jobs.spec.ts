import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "../../playwright.config"

// A test that creates a job must also delete it at the end, thus the shared database
// stays clean.

test.use({ storageState: AUTH_FILE })

// A job offer from the seed data. It has no owner (ownerId is null), thus the seed user is
// never its owner and the tests can use it for assertions about a different user.
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

  // The page shows the archive button for a submitted job and for a published job.
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
  // The validation of the browser for a required field keeps the page open.
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

  // Go to a different page with a link and not with a submit. This starts pagehide, which
  // deletes the draft.
  await page.getByRole("link", { name: "Alle Jobs" }).click()
  await expect(page).toHaveURL("/jobs")

  // Open the form again. The draft in sessionStorage must be gone.
  await page.goto("/job/new")
  const titleValue = await page.locator("#title").inputValue()
  expect(titleValue).toBe("")
})

// ─── Privilege escalation ───────────────────────────────────────────────────

/**
 * A plain <form action={actions.x.y}> sends an Astro Action as a POST to the URL of the
 * current page, with the query parameter `?_action=x.y`. The action handler itself
 * (src/actions/jobs.ts) checks the ownership and throws ActionError({ code: "FORBIDDEN" }),
 * which Astro sends as HTTP 403. Each request needs an Origin or Referer header with the
 * origin of the app. Without it, the CSRF protection of Astro rejects the request before the
 * handler starts.
 */
test.describe("Ownership enforcement — job offers", () => {
  let jobId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_FILE })
    const pg = await ctx.newPage()
    await pg.goto(SEEDED_JOB_URL)
    // For a viewer who is not the owner, the report modal has the id of the job in a
    // hidden input.
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
