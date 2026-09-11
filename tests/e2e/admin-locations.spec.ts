import { expect, test, type Page } from "@playwright/test"

/**
 * /admin/locations needs the "location:manage" permission from the better-auth `admin`
 * plugin, which the "admin" role has. Each test logs in inline, because it must change
 * between the seed user, who is not a manager, and the seeded admin@example.com account.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

function uniqueName() {
  return `E2E Admin Test Location ${Date.now()}`
}

test("non-manager visiting /admin/locations is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/locations")
  await expect(page).not.toHaveURL(/\/admin\/locations/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/locations")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/locations/)
})

test("admin can create, edit, and delete a location", async ({ page }) => {
  await login(page, "admin@example.com", "Admin1234!")

  const name = uniqueName()
  const updatedName = `${name} (updated)`

  await page.goto("/admin/locations/new")
  await page.fill("#name", name)
  await page.fill("#lat", "49.8988")
  await page.fill("#lon", "10.9028")
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/locations/)

  const card = page.locator(".rounded-xl", { hasText: name })
  await expect(card).toBeVisible()

  await card.getByRole("link", { name: "Bearbeiten" }).click()
  await expect(page).toHaveURL(/\/admin\/locations\/.+\/edit$/)
  await page.fill("#name", updatedName)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/locations$/)

  const updatedCard = page.locator(".rounded-xl", { hasText: updatedName })
  await expect(updatedCard).toBeVisible()

  await updatedCard.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL(/\/admin\/locations$/)
  await expect(page.locator("body")).not.toContainText(updatedName)
})
