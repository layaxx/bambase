import { defineConfig, devices } from "@playwright/test"

/**
 * E2E test config for BamBase.
 *
 * Prerequisites before running:
 *   1. Start the database:  docker compose -f docker-compose.dev.yml up -d
 *   2. Apply migrations and seed data:  yarn prisma migrate deploy && yarn prisma db seed
 *   3. Start the app:  yarn dev  (or `yarn build && yarn preview` against a prod build)
 *   4. Wait until http://localhost:4321 is healthy
 *   5. Run:  yarn test:e2e
 *
 * The "setup" project logs in as the seed user (seeded via better-auth in
 * prisma/seed.ts) and saves cookies to tests/e2e/.auth/seed-user.json. Specs
 * that need auth reference that file via `test.use({ storageState: AUTH_FILE })`.
 */

export const AUTH_FILE = "tests/e2e/.auth/seed-user.json"

export default defineConfig({
  timeout: 10 * 1000,

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
