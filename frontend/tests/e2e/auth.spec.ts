import { expect, test } from "@playwright/test"

/**
 * Auth flows — login, register, logout, and protected route guards.
 * Runs without stored auth state so each test starts as an anonymous visitor.
 */

test.describe("Login", () => {
  test("non-existent email shows error alert", async ({ page }) => {
    await page.goto("/login")
    await page.fill('[name="identifier"]', "nobody@does-not-exist.example.com")
    await page.fill('[name="password"]', "somepassword99")
    await page.click('button[type="submit"]')

    await expect(page.locator(".alert-error")).toBeVisible()
    await expect(page).toHaveURL(/login\??.*/)
  })

  test("correct credentials set cookies and redirect to home", async ({ page }) => {
    await page.goto("/login")
    await page.fill('[name="identifier"]', "seed@example.com")
    await page.fill('[name="password"]', "Seed1234!")
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL("/")

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name === "auth_token")).toBe(true)
    expect(cookies.some((c) => c.name === "auth_user")).toBe(true)
  })

  test("wrong password shows error alert", async ({ page }) => {
    await page.goto("/login")
    await page.fill('[name="identifier"]', "seed@example.com")
    await page.fill('[name="password"]', "wrongpassword99")
    await page.click('button[type="submit"]')

    await expect(page.locator(".alert-error")).toBeVisible()
    await expect(page).toHaveURL(/login\??.*/)
  })

  test("login from redirect URL lands on intended page", async ({ page }) => {
    await page.goto("/login?redirect=/account")
    await page.fill('[name="identifier"]', "seed@example.com")
    await page.fill('[name="password"]', "Seed1234!")
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL("/account")
  })
})

test.describe("Register", () => {
  test("already-registered email shows error alert", async ({ page }) => {
    await page.goto("/register")
    await page.fill('[name="email"]', "seed@example.com")
    await page.fill('[name="password"]', "validpassword1")
    await page.fill('[name="passwordConfirm"]', "validpassword1")
    await page.click('button[type="submit"]')

    await expect(page.locator(".alert-error")).toBeVisible()
    await expect(page).toHaveURL(/register\??.*/)
  })

  test("mismatched passwords show error alert", async ({ page }) => {
    await page.goto("/register")
    await page.fill('[name="email"]', `e2e-mismatch-${Date.now()}@example.com`)
    await page.fill('[name="password"]', "validpassword1")
    await page.fill('[name="passwordConfirm"]', "differentpassword2")
    await page.click('button[type="submit"]')

    await expect(page.locator(".alert-error")).toBeVisible()
    await expect(page.locator(".alert-error")).toHaveText("Die Passwörter stimmen nicht überein.")
    await expect(page).toHaveURL(/register\??.*/)
  })

  test("valid credentials redirect to home and user is logged in", async ({ page }) => {
    const email = `e2e-register-${Date.now()}@example.com`
    await page.goto("/register")
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', "validpassword1")
    await page.fill('[name="passwordConfirm"]', "validpassword1")
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL("/")

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name === "auth_token")).toBe(true)
  })
})

test.describe("Protected routes (unauthenticated)", () => {
  test("accessing /job/new redirects to /login?redirect=/job/new", async ({ page }) => {
    await page.goto("/job/new")
    await expect(page).toHaveURL(/\/login\?redirect=\/job\/new/)
  })

  test("accessing /event/new redirects to /login?redirect=/event/new", async ({ page }) => {
    await page.goto("/event/new")
    await expect(page).toHaveURL(/\/login\?redirect=\/event\/new/)
  })

  test("accessing /account redirects to /login", async ({ page }) => {
    await page.goto("/account")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("Logout", () => {
  test("clears auth cookies and /account then redirects to login", async ({ page }) => {
    await page.goto("/login")
    await page.fill('[name="identifier"]', "seed@example.com")
    await page.fill('[name="password"]', "Seed1234!")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL("/")

    await page.goto("/logout")
    await expect(page).toHaveURL("/")

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name === "auth_token")).toBe(false)

    await page.goto("/account")
    await expect(page).toHaveURL(/\/login/)
  })
})
