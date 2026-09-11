import { defineConfig, devices } from "@playwright/test"

/**
 * The e2e test configuration for BamBase.
 *
 * Do these steps before you run the tests:
 *   1. Start the database:  docker compose -f docker-compose.dev.yml up -d
 *   2. Apply the migrations and the seed data:
 *      yarn prisma migrate deploy && yarn prisma db seed
 *   3. Start the app:  yarn dev  (or `yarn build && yarn preview` for a production build)
 *   4. Wait until http://localhost:4321 answers
 *   5. Run:  yarn test:e2e
 *
 * The "setup" project logs in as the seed user, which prisma/seed.ts creates with better-auth,
 * and saves the cookies to tests/e2e/.auth/seed-user.json. A spec that needs authentication
 * uses that file with `test.use({ storageState: AUTH_FILE })`.
 */

export const AUTH_FILE = "tests/e2e/.auth/seed-user.json"

export default defineConfig({
  timeout: 10 * 1000,

  testDir: "./tests/e2e",
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4321",
    /* The German locale makes the app render in German for each test */
    locale: "de-DE",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
      testMatch: ["**/jobs.spec.ts", "**/events.spec.ts", "**/account.spec.ts"],
      dependencies: ["setup"],
    },

    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [
        "**/auth.spec.ts",
        "**/public-pages.spec.ts",
        "**/map.spec.ts",
        "**/reports.spec.ts",
        "**/og-images.spec.ts",
        "**/admin.spec.ts",
        "**/admin-users.spec.ts",
        "**/admin-locations.spec.ts",
        "**/admin-student-groups.spec.ts",
        "**/admin-events.spec.ts",
        "**/admin-reports.spec.ts",
        "**/admin-cron.spec.ts",
      ],
    },
  ],
})
