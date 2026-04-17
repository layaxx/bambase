import { test as setup } from "@playwright/test"

const AUTH_FILE = "tests/e2e/.auth/seed-user.json"

/**
 * Runs once before authenticated test suites.
 * Logs in as the seed user and saves cookies so other tests can reuse the session.
 *
 * Requires the stack to be running with SEED=true so seed@example.com exists.
 */
setup("authenticate as seed user", async ({ page }) => {
  await page.goto("/login")
  await page.fill('[name="identifier"]', "seed@example.com")
  await page.fill('[name="password"]', "Seed1234!")
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
  await page.context().storageState({ path: AUTH_FILE })
})
