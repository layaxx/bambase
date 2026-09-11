import { test as setup } from "@playwright/test"

const AUTH_FILE = "tests/e2e/.auth/seed-user.json"

/** The database must have the seed data (`npx prisma db seed`), which contains this user. */
setup("authenticate as seed user", async ({ page }) => {
  await page.goto("/login")
  await page.fill('[name="identifier"]', "seed@example.com")
  await page.fill('[name="password"]', "Seed1234!")
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
  await page.context().storageState({ path: AUTH_FILE })
})
