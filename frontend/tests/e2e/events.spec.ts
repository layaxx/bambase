import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "../../playwright.config"

/**
 * Event CRUD flows — all tests run as the authenticated seed user.
 *
 * Tests that create an event are responsible for cleaning it up at the end.
 */

test.use({ storageState: AUTH_FILE })

// ─── Helpers ───────────────────────────────────────────────────────────────

function uniqueTitle() {
  return `E2E Test Event ${Date.now()}`
}

/** datetime-local input value format: YYYY-MM-DDTHH:mm */
const FUTURE_START = "2099-12-01T18:00"
const FUTURE_END = "2099-12-01T20:00"
const INVALID_START = "2099-12-01T20:00" // start after end (invalid)
const INVALID_END = "2099-12-01T18:00"

async function createEvent(page: Page, title: string): Promise<string> {
  await page.goto("/event/new")
  await page.fill("#title", title)
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", FUTURE_START)
  await page.fill("#end", FUTURE_END)
  await page.fill("#description", "Automated E2E test event — safe to delete.")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)
  return page.url()
}

async function deleteEvent(page: Page) {
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Löschen" }).click()
  await expect(page).toHaveURL("/account/events")
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test("create event with valid dates and redirect to detail page", async ({ page }) => {
  const title = uniqueTitle()
  await createEvent(page, title)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  await expect(page).toHaveURL(/\/event\/[a-z0-9-]+$/)

  await deleteEvent(page)
})

test("create event with start after end shows validation error", async ({ page }) => {
  await page.goto("/event/new")
  await page.fill("#title", uniqueTitle())
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", INVALID_START)
  await page.fill("#end", INVALID_END)
  await page.fill("#description", "This should fail validation.")
  await page.click('button[type="submit"]')

  // Server validates start < end and returns an error
  await expect(page.locator(".alert-error, .text-error")).toBeVisible()
  await expect(page).toHaveURL(/event\/new\??.*/)
})

test("event detail shows owner controls (Edit, Delete) for creator", async ({ page }) => {
  const title = uniqueTitle()
  await createEvent(page, title)

  await expect(page.getByRole("link", { name: "Bearbeiten" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Löschen" })).toBeVisible()

  await deleteEvent(page)
})

test("edit event updates title and detail page reflects change", async ({ page }) => {
  const title = uniqueTitle()
  const updatedTitle = `${title} (updated)`
  const eventUrl = await createEvent(page, title)

  await page.getByRole("link", { name: "Bearbeiten" }).click()
  await expect(page).toHaveURL(/\/event\/.+\/edit$/)

  await page.fill("#title", updatedTitle)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(eventUrl)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(updatedTitle)

  await deleteEvent(page)
})

test("edit event — datetime fields are pre-populated correctly", async ({ page }) => {
  const title = uniqueTitle()
  await createEvent(page, title)
  const eventUrl = page.url()

  await page.getByRole("link", { name: "Bearbeiten" }).click()
  await expect(page).toHaveURL(/\/event\/.+\/edit$/)

  const startValue = await page.locator("#start").inputValue()
  const endValue = await page.locator("#end").inputValue()

  expect(startValue).toBe(FUTURE_START)
  expect(endValue).toBe(FUTURE_END)

  // navigate back without saving
  await page.goto(eventUrl)
  await deleteEvent(page)
})

test("delete event redirects to /account/events and removes it from the list", async ({ page }) => {
  const title = uniqueTitle()
  await createEvent(page, title)

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Löschen" }).click()

  await expect(page).toHaveURL("/account/events")
  await expect(page.locator("body")).not.toContainText(title)
})

test("no owner controls for non-owner authenticated user", async ({ page }) => {
  await page.goto("/event/offene-sozialberatung") // one of the seeded events

  await expect(page.getByRole("button", { name: "Veranstaltung melden" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Löschen" })).not.toBeVisible()
})

test("create event without required fields stays on /event/new (browser validation)", async ({
  page,
}) => {
  await page.goto("/event/new")
  await page.click('button[type="submit"]')
  // Browser's native required validation keeps us on the page
  await expect(page).toHaveURL("/event/new")
})

test("event draft is cleared when navigating away without submitting", async ({ page }) => {
  await page.goto("/event/new")
  await page.fill("#title", "Draft that should be discarded")

  // Navigate away via link (not submit) — pagehide fires, draft cleared
  await page.getByRole("link", { name: "Alle Veranstaltungen" }).click()
  await expect(page).toHaveURL("/events")

  // Return to the form — sessionStorage draft should be gone
  await page.goto("/event/new")
  const titleValue = await page.locator("#title").inputValue()
  expect(titleValue).toBe("")
})

// ─── Location variant tests ────────────────────────────────────────────────

test("create event with no location — EventLocation section is not rendered", async ({ page }) => {
  const title = uniqueTitle()
  await page.goto("/event/new")
  await page.fill("#title", title)
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", FUTURE_START)
  await page.fill("#end", FUTURE_END)
  await page.fill("#description", "Automated E2E test event — safe to delete.")
  // location_type defaults to "none" — leave it unchanged
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  // EventLocation is only rendered when a location exists; "Ort" dt label should be absent
  await expect(page.locator("dt").filter({ hasText: "Ort" })).toHaveCount(0)

  await deleteEvent(page)
})

test("create event with map location (linked) — location name appears on detail page", async ({
  page,
}) => {
  const title = uniqueTitle()
  await page.goto("/event/new")
  await page.fill("#title", title)
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", FUTURE_START)
  await page.fill("#end", FUTURE_END)
  await page.fill("#description", "Automated E2E test event — safe to delete.")

  // Switch to linked location type to reveal the map location dropdown
  await page.click('input[name="location_type"][value="linked"]')
  await page.locator("#linked-location-section").waitFor({ state: "visible" })

  // Pick the first real location from the dropdown (index 0 is the empty placeholder)
  const locationSelect = page.locator('select[name="map_location_id"]')
  const firstOptionText = await locationSelect.locator("option").nth(1).textContent()
  await locationSelect.selectOption({ index: 1 })

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  // Option label format is "Location Name · City" — check for the name portion
  const locationName = (firstOptionText ?? "").split(" · ")[0].trim()
  await expect(page.locator("body")).toContainText(locationName)

  await deleteEvent(page)
})

test("create event with custom location — custom name appears on detail page", async ({ page }) => {
  const title = uniqueTitle()
  await page.goto("/event/new")
  await page.fill("#title", title)
  await page.fill("#organizer", "E2E Organizer")
  await page.fill("#start", FUTURE_START)
  await page.fill("#end", FUTURE_END)
  await page.fill("#description", "Automated E2E test event — safe to delete.")

  // Switch to custom location type to reveal the custom fields
  await page.click('input[name="location_type"][value="custom"]')
  await page.locator("#custom-location-section").waitFor({ state: "visible" })

  await page.fill('input[name="custom_location_name"]', "E2E Test Venue")
  await page.fill('input[name="custom_location_address"]', "Teststraße 1")
  await page.fill('input[name="custom_location_city"]', "Bamberg")

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  // Custom location name should appear in the EventLocation card
  await expect(page.locator("body")).toContainText("E2E Test Venue")

  await deleteEvent(page)
})

test("created event appears on the /events listing page", async ({ page }) => {
  const title = uniqueTitle()
  const eventUrl = await createEvent(page, title)

  await page.goto("/events")
  await expect(page.locator("body")).toContainText(title)

  await page.goto(eventUrl)
  await deleteEvent(page)
})
