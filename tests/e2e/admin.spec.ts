import { type Page } from "@playwright/test"
import { expect, login, moderate, test } from "./fixtures"

/**
 * /admin/jobs needs the "moderator" role or the "admin" role from the better-auth `admin`
 * plugin. Each test logs in inline, because it must change between the seed user, who is not
 * a moderator, and the seeded admin@example.com account.
 */

function uniqueTitle() {
  return `E2E Admin Test Job ${Date.now()}`
}

async function editTitle(page: Page, jobUrl: string, title: string) {
  await page.goto(`${jobUrl}/edit`)
  await page.fill("#title", title)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(jobUrl)
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

test("moderator can approve a submitted job", async ({ page, browser, listings }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const jobUrl = await listings.createJob(title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await moderate(adminPage, title)

  const decidedCard = adminPage.getByTestId("recent-decisions").locator(".rounded-xl", {
    hasText: title,
  })
  await expect(decidedCard).toContainText("Veröffentlicht")
  await adminContext.close()

  await page.goto(jobUrl)
  await expect(page.locator("body")).not.toContainText("Dieses Angebot ist nur für dich sichtbar.")
})

test("moderator can reject a submitted job", async ({ page, browser, listings }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const jobUrl = await listings.createJob(title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await moderate(adminPage, title, "Bitte Stundenlohn angeben.")

  const decidedCard = adminPage.getByTestId("recent-decisions").locator(".rounded-xl", {
    hasText: title,
  })
  await expect(decidedCard).toContainText("Abgelehnt")
  await adminContext.close()

  await page.goto(jobUrl)
  await expect(page.locator("body")).toContainText("Abgelehnt")
  await expect(page.getByRole("alert")).toContainText("Grund: Bitte Stundenlohn angeben.")
  await expect(page.getByText(/Veröffentlicht am/)).toHaveCount(0)

  await page.goto("/account/jobs")
  await expect(page.locator("li", { hasText: title })).toContainText(
    "Grund: Bitte Stundenlohn angeben."
  )
})

test("moderator sees what waits and rejects several jobs at once", async ({
  page,
  browser,
  listings,
}) => {
  await login(page, "seed@example.com", "Seed1234!")
  const base = uniqueTitle()
  const [titleA, titleB] = [`${base} A`, `${base} B`]
  await listings.createJob(titleA)
  await listings.createJob(titleB)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto("/admin")
  await expect(adminPage.getByRole("link", { name: /^Stellenangebote prüfen/ })).toContainText(
    /\d+ wartend/
  )

  await adminPage.goto("/admin/jobs")
  await expect(adminPage.getByTestId("job-queue-count")).toContainText(/\d+ wartend/)
  await expect(adminPage.locator(".rounded-xl", { hasText: titleA })).toContainText(
    "Eingereicht am"
  )
  await adminPage.getByRole("checkbox", { name: `${titleA} auswählen` }).check()
  await adminPage.getByRole("checkbox", { name: `${titleB} auswählen` }).check()
  const bulk = adminPage.locator("#bulk-moderation")
  const reason = bulk.getByRole("textbox", { name: "Grund für die Ablehnung" })
  await reason.fill("Testeintrag")
  // Enter submits via the first submit button of the form, which must be Ablehnen.
  await reason.press("Enter")

  await expect(adminPage.getByTestId("job-queue")).not.toContainText(titleA)
  await expect(adminPage.getByTestId("job-queue")).not.toContainText(titleB)
  await adminContext.close()
})

test("owner edit after a decision sends the job back to the queue", async ({
  page,
  browser,
  listings,
}) => {
  test.slow()
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const jobUrl = await listings.createJob(title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")

  // An approval does not cover a later rewrite: the edited job goes offline until a new review.
  await moderate(adminPage, title)
  const editedTitle = `${title} (edited)`
  await editTitle(page, jobUrl, editedTitle)
  await expect(page.getByRole("alert")).toContainText("In Prüfung")

  // An edit after a rejection resubmits the job and clears the old reason. moderate() fails if
  // the edited job is not back in the queue.
  await moderate(adminPage, editedTitle, "Bitte Stundenlohn angeben.")
  const resubmittedTitle = `${title} (resubmitted)`
  await editTitle(page, jobUrl, resubmittedTitle)
  await expect(page.getByRole("alert")).toContainText("In Prüfung")
  await expect(page.locator("body")).not.toContainText("Bitte Stundenlohn angeben.")
  await adminPage.goto("/admin/jobs")
  await expect(adminPage.getByTestId("job-queue")).toContainText(resubmittedTitle)
  await adminContext.close()
})
