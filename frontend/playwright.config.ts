import { defineConfig, devices } from "@playwright/test"

/**
 * E2E test config for BamBase.
 *
 * Prerequisites before running:
 *   1. Start the full stack:  SEED=true docker-compose up --build -d
 *   2. Wait until http://localhost:4321 is healthy
 *   3. Run:  yarn test:e2e
 *
 * The "setup" project logs in as the seed user and saves cookies to
 * tests/e2e/.auth/seed-user.json.  Specs that need auth reference that file
 * via `test.use({ storageState: AUTH_FILE })`.
 */

export const AUTH_FILE = "tests/e2e/.auth/seed-user.json"
export const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337"

export default defineConfig({
  testDir: "./tests/e2e",
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4321",
    /* Use German locale so the app always renders in German */
    locale: "de-DE",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    /* 1. Login once and save auth state */
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    /* 2. Authenticated tests – reuse saved auth cookies */
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
      testMatch: ["**/jobs.spec.ts", "**/events.spec.ts", "**/account.spec.ts"],
      dependencies: ["setup"],
    },

    /* 3. Mixed/unauthenticated tests – no stored state */
    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/auth.spec.ts", "**/public-pages.spec.ts", "**/reports.spec.ts"],
    },
  ],
})
