import { expect, login, test } from "./fixtures"

/**
 * /admin/users needs the "admin" role from the better-auth `admin` plugin, because a
 * moderator has no `user` permission. The tests ban and unban "clean@example.com", because
 * no other spec makes an assertion about that account.
 */

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
  await page.goto("/admin/users?q=clean%40example.com")

  const userRow = page.getByRole("row", { name: /clean@example\.com/ })
  await expect(userRow).toBeVisible()

  await userRow.getByRole("button", { name: "Sperren" }).click()
  await expect(page).toHaveURL(/\/admin\/users/)

  const bannedRow = page.getByRole("row", { name: /clean@example\.com/ })
  await expect(bannedRow).toContainText("Gesperrt")

  await bannedRow.getByRole("button", { name: "Entsperren" }).click()
  await expect(page).toHaveURL(/\/admin\/users/)

  const activeRow = page.getByRole("row", { name: /clean@example\.com/ })
  await expect(activeRow).toContainText("Aktiv")
})
