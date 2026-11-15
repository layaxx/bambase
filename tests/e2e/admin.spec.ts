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

test("moderator walks the review queue and moves on after a decision", async ({
  page,
  browser,
  listings,
}) => {
  test.slow()
  await login(page, "seed@example.com", "Seed1234!")
  const first = (await listings.createJob(uniqueTitle())).split("/").pop()
  // A second job makes sure that the queue goes on after the first. Other workers add, resubmit
  // and decide jobs at the same time, thus each neighbour is read from the page, not assumed.
  await listings.createJob(uniqueTitle())

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  const bar = adminPage.getByTestId("job-moderation")
  const href = async (name: string) =>
    (await bar.getByRole("link", { name }).getAttribute("href")) ?? ""

  await adminPage.goto(`/admin/jobs/${first}?queue`)
  const next = await href("Nächste Stelle")
  expect(next).toMatch(/^\/admin\/jobs\/[^/?]+\?queue$/)
  await expect(bar.getByTestId("job-queue-count")).toHaveText(/^\d+ von \d+$/)
  await expect(bar.getByTestId("job-status")).toHaveText("In Prüfung")
  // The hint of the owner is not meant for the moderator.
  await expect(adminPage.locator("body")).not.toContainText("nur für dich sichtbar")

  // The shortcuts listen once the script of the page has loaded.
  await adminPage.keyboard.press("ArrowRight")
  await expect(adminPage).toHaveURL(next)
  await adminPage.waitForLoadState()
  const previous = await href("Vorherige Stelle")
  await adminPage.keyboard.press("ArrowLeft")
  await expect(adminPage).toHaveURL(previous)

  // A decision from the queue moves on to another job.
  await adminPage.goto(`/admin/jobs/${first}?queue`)
  await bar.getByRole("button", { name: "Genehmigen" }).click()
  await expect(adminPage).toHaveURL(/\/admin\/jobs\/[^/?]+\?queue&decided=published$/)
  expect(adminPage.url()).not.toContain(`/admin/jobs/${first}?`)
  await expect(adminPage.getByTestId("decision-toast")).toContainText("genehmigt")
  await adminContext.close()
})

test("moderator rejects a job only with a reason from the popover", async ({
  page,
  browser,
  listings,
}) => {
  await login(page, "seed@example.com", "Seed1234!")
  const jobUrl = await listings.createJob(uniqueTitle())
  const slug = jobUrl.split("/").pop()

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto(`/admin/jobs/${slug}`)
  const bar = adminPage.getByTestId("job-moderation")
  await bar.getByRole("button", { name: "Ablehnen" }).click()

  const reason = adminPage.getByRole("textbox", { name: "Grund für die Ablehnung" })
  const confirm = adminPage.getByRole("button", { name: "Ablehnung senden" })
  await expect(reason).toBeFocused()
  await expect(confirm).toBeDisabled()
  await reason.fill("   ")
  await expect(confirm).toBeDisabled()
  await reason.fill("Bitte Stundenlohn angeben.")
  await confirm.click()

  // A decision outside of the queue stays on its job.
  await expect(adminPage).toHaveURL(`/admin/jobs/${slug}?decided=rejected`)
  await expect(adminPage.getByTestId("decision-toast")).toContainText("abgelehnt")
  await page.goto(jobUrl)
  await expect(page.getByRole("alert")).toContainText("Grund: Bitte Stundenlohn angeben.")
  await adminContext.close()
})
