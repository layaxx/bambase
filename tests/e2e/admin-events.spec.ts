import { expect, test, type Page } from "@playwright/test"

/**
 * Event moderation (/admin/events) — gated by the "event:moderate" permission
 * from the better-auth `admin` plugin. Unlike jobs, the admin events queue has
 * no approve/reject flow; moderators edit any event via /admin/events/[slug]/edit
 * regardless of ownership. Each test logs in inline (no shared storageState)
 * since it needs to switch between the seed user (event owner) and the seeded
 * admin@example.com account (moderator).
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

function uniqueTitle() {
  return `E2E Admin Test Event ${Date.now()}`
}

const FUTURE_START = "2099-12-01T18:00"
const FUTURE_END = "2099-12-01T20:00"

async function createEvent(page: Page, title: string): Promise<string> {
  await page.goto("/event/new")
  await page.fill("#title", title)
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", FUTURE_START)
  await page.fill("#end", FUTURE_END)
  await page.fill("#description", "Automated E2E test event — safe to delete.")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)
  return page.url()
}

test("non-moderator visiting /admin/events is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/events")
  await expect(page).not.toHaveURL(/\/admin\/events/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/events")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/events/)
})

test("moderator can edit another user's event", async ({ page, browser }) => {
  await login(page, "seed@example.com", "Seed1234!")
  const title = uniqueTitle()
  const updatedTitle = `${title} (moderated)`
  const eventUrl = await createEvent(page, title)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, "admin@example.com", "Admin1234!")
  await adminPage.goto("/admin/events")

  const eventCard = adminPage.locator(".rounded-xl", { hasText: title })
  await expect(eventCard).toBeVisible()
  await eventCard.getByRole("link", { name: "Bearbeiten" }).click()
  await expect(adminPage).toHaveURL(/\/admin\/events\/.+\/edit$/)

  await adminPage.fill("#title", updatedTitle)
  await adminPage.click('button[type="submit"]')
  await expect(adminPage).toHaveURL(/\/admin\/events$/)

  const updatedCard = adminPage.locator(".rounded-xl", { hasText: updatedTitle })
  await expect(updatedCard).toBeVisible()
  await adminContext.close()

  // slug (and therefore the URL) is unchanged by the title update
  await page.goto(eventUrl)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(updatedTitle)

  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL("/account/events")
})
