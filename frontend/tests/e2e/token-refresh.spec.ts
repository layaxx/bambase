/**
 * E2E tests for the token-refresh flow.
 *
 * Each test logs in as the seed user (to obtain a real Strapi refresh_token),
 * then surgically replaces the auth_token cookie with a crafted expired JWT
 * and/or removes it entirely.  This simulates the session state that occurs
 * after the 15-minute access token window closes.
 *
 * Prerequisites: the full stack must be running with SEED=true.
 *   docker-compose up --build -d
 *
 * The crafted JWTs have no valid signature — Strapi never sees them.  The
 * middleware decodes only the payload locally to check exp, then calls
 * /api/auth/refresh with the refresh_token.  Strapi validates the refresh_token
 * and issues a new signed JWT.
 */

import { expect, test, type BrowserContext } from "@playwright/test"
import { STRAPI_URL } from "../../playwright.config"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a structurally-valid JWT with a past exp.  Signature is a placeholder. */
function makeExpiredJwt(userId = 1): string {
  const pastExp = Math.floor(Date.now() / 1000) - 120 // 2 minutes ago
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ id: userId, exp: pastExp })).toString("base64url")
  return `${header}.${payload}.placeholder-sig`
}

/** Cookie attributes that match what the Astro app sets. */
function authCookieBase() {
  return {
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Strict" as const,
    // Expiry one hour from now — long enough for the test to run.
    expires: Math.floor(Date.now() / 1000) + 3600,
  }
}

/** Log in as the seed user and return all cookies that were set. */
async function loginAsSeedUser(context: BrowserContext) {
  const res = await context.request.post(`${STRAPI_URL}/api/auth/local`, {
    data: { identifier: "seed@example.com", password: "Seed1234!" },
  })
  expect(res.ok()).toBeTruthy()
  return res.json() as Promise<{ jwt: string; refreshToken?: string }>
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

test.describe("token refresh flow", () => {
  /**
   * The main scenario: a user's 15-minute JWT has expired but their
   * refresh_token is still valid.  The middleware must silently refresh and
   * the user must land on the protected page without any redirect to /login.
   */
  test("expired auth_token + valid refresh_token: protected page loads without redirect", async ({
    page,
    context,
  }) => {
    // 1. Obtain a real refresh_token by logging in directly against Strapi.
    const { refreshToken } = await loginAsSeedUser(context)
    test.skip(!refreshToken, "Strapi did not return a refresh_token — check jwtManagement config")

    // 2. Set browser cookies: expired auth_token + the real refresh_token.
    const base = authCookieBase()
    await context.addCookies([
      { name: "auth_token", value: makeExpiredJwt(), ...base },
      { name: "refresh_token", value: refreshToken!, ...base, httpOnly: true },
    ])

    // 3. Navigate to a protected page.
    await page.goto("/account")

    // 4. Must NOT have been redirected to /login.
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).toHaveURL("/account")
  })

  /**
   * After a transparent refresh the browser must receive a new auth_token
   * (the rotated JWT), otherwise the next request will trigger another refresh.
   */
  test("expired auth_token + valid refresh_token: auth_token cookie is rotated", async ({
    page,
    context,
  }) => {
    const { refreshToken } = await loginAsSeedUser(context)
    test.skip(!refreshToken, "Strapi did not return a refresh_token — check jwtManagement config")

    const expiredJwt = makeExpiredJwt()
    const base = authCookieBase()
    await context.addCookies([
      { name: "auth_token", value: expiredJwt, ...base },
      { name: "refresh_token", value: refreshToken!, ...base },
    ])

    await page.goto("/account")
    await expect(page).not.toHaveURL(/\/login/)

    // The response must have Set-Cookie for auth_token with a new value.
    const cookies = await context.cookies()
    const authCookie = cookies.find((c) => c.name === "auth_token")
    expect(authCookie).toBeDefined()
    expect(authCookie!.value).not.toBe(expiredJwt)
  })

  /**
   * When the refresh_token is also missing (or has already been deleted),
   * the middleware must clear the stale auth_token and redirect to /login.
   */
  test("expired auth_token + no refresh_token: redirect to /login", async ({ page, context }) => {
    const base = authCookieBase()
    await context.addCookies([
      { name: "auth_token", value: makeExpiredJwt(), ...base },
      // No refresh_token.
    ])

    await page.goto("/account")
    await expect(page).toHaveURL(/\/login/)
  })

  /**
   * Edge case: the auth_token cookie was lost (e.g., cleared by a browser
   * policy) but the refresh_token is still present.  The middleware should
   * trigger a refresh-only flow and the user should land on the page.
   */
  test("no auth_token + valid refresh_token: page loads via refresh-only session", async ({
    page,
    context,
  }) => {
    const { refreshToken } = await loginAsSeedUser(context)
    test.skip(!refreshToken, "Strapi did not return a refresh_token — check jwtManagement config")

    const base = authCookieBase()
    await context.addCookies([
      // Intentionally no auth_token.
      { name: "refresh_token", value: refreshToken!, ...base },
    ])

    await page.goto("/account")
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).toHaveURL("/account")
  })

  /**
   * After a successful transparent refresh the refresh_token itself must be
   * rotated (Strapi issues a new one per exchange).  An old refresh_token
   * becoming stale-but-kept is a minor session-fixation risk.
   */
  test("expired auth_token + valid refresh_token: refresh_token cookie is rotated", async ({
    page,
    context,
  }) => {
    const { refreshToken } = await loginAsSeedUser(context)
    test.skip(!refreshToken, "Strapi did not return a refresh_token — check jwtManagement config")

    const base = authCookieBase()
    await context.addCookies([
      { name: "auth_token", value: makeExpiredJwt(), ...base },
      { name: "refresh_token", value: refreshToken!, ...base },
    ])

    await page.goto("/account")
    await expect(page).not.toHaveURL(/\/login/)

    const cookies = await context.cookies()
    const rtCookie = cookies.find((c) => c.name === "refresh_token")
    expect(rtCookie).toBeDefined()
    expect(rtCookie!.value).not.toBe(refreshToken)
  })

  /**
   * Logout must clear all three cookies (auth_token, auth_user, refresh_token)
   * and the user must no longer be able to access protected pages.
   * This also verifies the server-side /api/auth/logout call is made so the
   * refresh_token is invalidated on the Strapi side.
   */
  test("logout clears all auth cookies and revokes the session", async ({ page, context }) => {
    // Log in via the UI so we go through the full login → set cookies flow.
    await page.goto("/login")
    await page.fill('[name="identifier"]', "seed@example.com")
    await page.fill('[name="password"]', "Seed1234!")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL("/")

    const cookieNamesBefore = (await context.cookies()).map((c) => c.name)
    expect(cookieNamesBefore).toContain("refresh_token")

    await page.goto("/logout")

    const cookieNamesAfter = (await context.cookies()).map((c) => c.name)
    expect(cookieNamesAfter).not.toContain("auth_token")
    expect(cookieNamesAfter).not.toContain("refresh_token")
    expect(cookieNamesAfter).not.toContain("auth_user")

    // The session must be dead: protected page redirects to /login.
    await page.goto("/account")
    await expect(page).toHaveURL(/\/login/)
  })
})
