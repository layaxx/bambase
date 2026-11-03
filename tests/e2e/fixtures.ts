import { expect, test as base, type Page } from "@playwright/test"

/**
 * `listings` creates jobs and events as the user of `page`, and deletes each one after the
 * test, also after a failure. `page` must still belong to that user when the test ends.
 */
type Listings = {
  createJob(title: string): Promise<string>
  createEvent(title: string): Promise<string>
}

/** Registers the listing for the cleanup as soon as the redirect commits, before the load. */
async function waitForListing(page: Page, urls: string[], pattern: RegExp): Promise<string> {
  await page.waitForURL(pattern, { waitUntil: "commit" })
  const url = page.url().split("?")[0]
  urls.push(url)
  await page.waitForLoadState()
  return url
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

/** Approves the job on /admin/jobs, or rejects it if there is a reason. */
export async function moderate(adminPage: Page, title: string, reason?: string) {
  await adminPage.goto("/admin/jobs")
  const jobCard = adminPage.getByTestId("job-queue").locator(".rounded-xl", { hasText: title })
  await expect(jobCard).toBeVisible()
  if (reason !== undefined) {
    await jobCard.getByRole("textbox", { name: "Grund für die Ablehnung" }).fill(reason)
    await jobCard.getByRole("button", { name: "Ablehnen" }).click()
  } else {
    await jobCard.getByRole("button", { name: "Genehmigen" }).click()
  }
  await expect(adminPage.getByTestId("job-queue")).not.toContainText(title)
}

async function deleteListing(page: Page, url: string) {
  await page.goto(url)
  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL(/\/account\/(jobs|events)$/)
}

export const test = base.extend<{ listings: Listings }>({
  listings: [
    async ({ page }, use) => {
      const urls: string[] = []
      await use({
        async createJob(title) {
          await page.goto("/job/new")
          await page.fill("#title", title)
          await page.fill("#company", "E2E Corp")
          await page.fill("#location", "Bamberg")
          await page.fill("#working_hours", "20")
          await page.fill("#description", "Automated E2E test job — safe to delete.")
          await page.fill("#contact_name", "Test Contact")
          await page.click('button[type="submit"]')
          return waitForListing(page, urls, /\/job\/[a-z0-9-]+\?submitted$/)
        },
        async createEvent(title) {
          await page.goto("/event/new")
          await page.fill("#title", title)
          await page.fill("#organizer", "E2E Organizer")
          await page.fill("#start", "2099-12-01T18:00")
          await page.fill("#end", "2099-12-01T20:00")
          await page.fill("#description", "Automated E2E test event — safe to delete.")
          await page.click('button[type="submit"]')
          return waitForListing(page, urls, /\/event\/[a-z0-9-]+$/)
        },
      })

      // A failed delete must not keep the other listings in the database.
      const errors: unknown[] = []
      for (const url of urls) {
        // eslint-disable-next-line no-await-in-loop
        await deleteListing(page, url).catch((error: unknown) => errors.push(error))
      }
      if (errors.length > 0) throw errors[0]
    },
    // Its own budget lets the cleanup run after a test timeout too.
    { timeout: 30 * 1000 },
  ],
})

export { expect }
