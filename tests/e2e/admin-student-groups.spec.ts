import { expect, test, type Page } from "@playwright/test"

/**
 * /admin/student-groups needs the "studentGroup:manage" permission from the better-auth
 * `admin` plugin, which the "admin" role has. Each test logs in inline, because it must
 * change between the seed user, who is not a manager, and the seeded admin@example.com
 * account.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

function uniqueName() {
  return `E2E Admin Test Group ${Date.now()}`
}

test("non-manager visiting /admin/student-groups is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/student-groups")
  await expect(page).not.toHaveURL(/\/admin\/student-groups/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/student-groups")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/student-groups/)
})

test("admin can create, edit, and delete a student group", async ({ page }) => {
  await login(page, "admin@example.com", "Admin1234!")

  const name = uniqueName()
  const updatedName = `${name} (updated)`

  await page.goto("/admin/student-groups/new")
  await page.fill("#name", name)
  await page.fill("#description", "Automated E2E test group — safe to delete.")
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/student-groups/)

  const card = page.locator(".rounded-xl", { hasText: name })
  await expect(card).toBeVisible()

  await card.getByRole("link", { name: "Bearbeiten" }).click()
  await expect(page).toHaveURL(/\/admin\/student-groups\/.+\/edit$/)
  await page.fill("#name", updatedName)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/admin\/student-groups$/)

  const updatedCard = page.locator(".rounded-xl", { hasText: updatedName })
  await expect(updatedCard).toBeVisible()

  await updatedCard.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL(/\/admin\/student-groups$/)
  await expect(page.locator("body")).not.toContainText(updatedName)
})
