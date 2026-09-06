import { expect, test } from "@playwright/test"

/**
 * Smoke tests for the OpenGraph image generation API routes.
 * No auth required — these are public endpoints.
 *
 * Seeded data used:
 *   Events:  ersti-party (published)
 *   Jobs:    werkstudent-in-softwareentwicklung-feki-de-e-v (published),
 *            bachelor-masterarbeit-im-bereich-data-science-universitaet-bamberg (submitted, not yet published)
 */

test.describe("Event OG image (/api/og/event/[slug].png)", () => {
  test("returns a PNG with correct headers for a valid event slug", async ({ request }) => {
    const response = await request.get("/api/og/event/ersti-party.png")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/png")
    expect(response.headers()["cache-control"]).toContain("public")
    expect(response.url()).not.toContain("/og-image.png")
  })

  test("redirects to fallback image for a non-existent event slug", async ({ request }) => {
    const response = await request.get("/api/og/event/this-slug-does-not-exist.png")

    // Playwright follows the 302 redirect; final URL is the static fallback
    expect(response.url()).toContain("/og-image.png")
    expect(response.status()).toBe(200)
  })
})

test.describe("Job OG image (/api/og/job/[slug].png)", () => {
  test("returns a PNG with correct headers for a valid published job", async ({ request }) => {
    const response = await request.get(
      "/api/og/job/werkstudent-in-softwareentwicklung-feki-de-e-v.png"
    )

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/png")
    expect(response.headers()["cache-control"]).toContain("public")
    expect(response.url()).not.toContain("/og-image.png")
  })

  test("redirects to fallback image for a non-existent job slug", async ({ request }) => {
    const response = await request.get("/api/og/job/non-existent.png")

    expect(response.url()).toContain("/og-image.png")
    expect(response.status()).toBe(200)
  })

  test("redirects to fallback image for a non-published job", async ({ request }) => {
    // This job is seeded with onlineStatus "submitted" (not yet published)
    const response = await request.get(
      "/api/og/job/bachelor-masterarbeit-im-bereich-data-science-universitaet-bamberg.png"
    )

    expect(response.url()).toContain("/og-image.png")
    expect(response.status()).toBe(200)
  })
})
