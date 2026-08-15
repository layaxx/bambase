import { expect, test, type Page } from "@playwright/test"

/**
 * User management (/admin/users) — gated by the "admin" role from the
 * better-auth `admin` plugin (moderators do not have `user` permissions).
 * Bans/unbans "clean@example.com" since it isn't asserted on by other specs.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.fill('[name="identifier"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

test("non-admin visiting /admin/users is redirected away", async ({ page }) => {
  await login(page, "seed@example.com", "Seed1234!")
  await page.goto("/admin/users")
  await expect(page).not.toHaveURL(/\/admin\/users/)
})

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/admin/users")
  await expect(page).toHaveURL(/\/login\?redirect=\/admin\/users/)
})

test("admin can ban and unban a user", async ({ page }) => {
  await login(page, "admin@example.com", "Admin1234!")
  await page.goto("/admin/users")

  const userRow = page.locator(".rounded-xl", { hasText: "clean@example.com" })
  await expect(userRow).toBeVisible()

  await userRow.getByRole("button", { name: "Sperren" }).click()
  await expect(page).toHaveURL(/\/admin\/users/)

  const bannedRow = page.locator(".rounded-xl", { hasText: "clean@example.com" })
  await expect(bannedRow).toContainText("Gesperrt")

  await bannedRow.getByRole("button", { name: "Entsperren" }).click()
  await expect(page).toHaveURL(/\/admin\/users/)

  const activeRow = page.locator(".rounded-xl", { hasText: "clean@example.com" })
  await expect(activeRow).toContainText("Aktiv")
})
