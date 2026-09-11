import { expect, test, type Page } from "@playwright/test"
import { AUTH_FILE } from "../../playwright.config"

// An event from the seed data. It has no owner (ownerId is null), thus the seed user is
// never its owner and the tests can use it for assertions about a different user.
const SEEDED_EVENT_URL = "/event/offene-sozialberatung"

// A test that creates an event must also delete it at the end.

test.use({ storageState: AUTH_FILE })

// ─── Helpers ───────────────────────────────────────────────────────────────

function uniqueTitle() {
  return `E2E Test Event ${Date.now()}`
}

/** The value format of a datetime-local input: YYYY-MM-DDTHH:mm */
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

/**
 * The /events page shows the events on more than one page, sorted by start date, earliest
 * first. FUTURE_START (2099) comes after each other event, thus a new test event is on the
 * last page and not on the first page.
 */
async function goToLastEventsPage(page: Page) {
  const lastPageLink = page.locator(".join a.join-item", { hasText: /^\d+$/ }).last()
  if (await lastPageLink.count()) await lastPageLink.click()
}

async function deleteEvent(page: Page) {
  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()
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

  // The server makes sure that start is before end, and gives an error.
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

  await page.goto(eventUrl)
  await deleteEvent(page)
})

test("delete event redirects to /account/events and removes it from the list", async ({ page }) => {
  const title = uniqueTitle()
  await createEvent(page, title)

  await page.getByRole("button", { name: "Löschen" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click()

  await expect(page).toHaveURL("/account/events")
  await expect(page.locator("body")).not.toContainText(title)
})

test("no owner controls for non-owner authenticated user", async ({ page }) => {
  await page.goto(SEEDED_EVENT_URL)

  await expect(page.getByRole("button", { name: "Veranstaltung melden" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Löschen" })).not.toBeVisible()
})

test("create event without required fields stays on /event/new (browser validation)", async ({
  page,
}) => {
  await page.goto("/event/new")
  await page.click('button[type="submit"]')
  // The validation of the browser for a required field keeps the page open.
  await expect(page).toHaveURL("/event/new")
})

test("event draft is cleared when navigating away without submitting", async ({ page }) => {
  await page.goto("/event/new")
  await page.fill("#title", "Draft that should be discarded")

  // Go to a different page with a link and not with a submit. This starts pagehide, which
  // deletes the draft.
  await page.getByRole("link", { name: "Alle Veranstaltungen" }).click()
  await expect(page).toHaveURL("/events")

  // Open the form again. The draft in sessionStorage must be gone.
  await page.goto("/event/new")
  const titleValue = await page.locator("#title").inputValue()
  expect(titleValue).toBe("")
})

// ─── Privilege escalation ───────────────────────────────────────────────────

/**
 * A plain <form action={actions.x.y}> sends an Astro Action as a POST to the URL of the
 * current page, with the query parameter `?_action=x.y`. The action handler itself
 * (src/actions/events.ts) checks the ownership and throws ActionError({ code: "FORBIDDEN" }),
 * which Astro sends as HTTP 403. Each request needs an Origin or Referer header with the
 * origin of the app. Without it, the CSRF protection of Astro rejects the request before the
 * handler starts.
 */
test.describe("Ownership enforcement — events", () => {
  let eventId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_FILE })
    const pg = await ctx.newPage()
    await pg.goto(SEEDED_EVENT_URL)
    // For a viewer who is not the owner, the report modal has the id of the event in a
    // hidden input.
    eventId = await pg.locator('input[name="target_id"]').inputValue()
    await ctx.close()
    expect(eventId).toBeTruthy()
  })

  function sameOriginHeaders(page: Page) {
    const origin = new URL(page.url()).origin
    return { Origin: origin, Referer: `${origin}${SEEDED_EVENT_URL}` }
  }

  test("cannot delete another user's event — events.delete returns FORBIDDEN", async ({ page }) => {
    await page.goto(SEEDED_EVENT_URL)
    const res = await page.request.post(`${SEEDED_EVENT_URL}?_action=events.delete`, {
      form: { id: eventId },
      headers: sameOriginHeaders(page),
    })
    expect(res.status()).toBe(403)
  })

  test("cannot update another user's event — events.update returns FORBIDDEN", async ({ page }) => {
    await page.goto(SEEDED_EVENT_URL)
    const res = await page.request.post(`${SEEDED_EVENT_URL}?_action=events.update`, {
      form: {
        id: eventId,
        title: "Hijacked title",
        organizer: "Hijacked Org",
        description: "hijack attempt",
        start: "2099-12-01T18:00",
        end: "2099-12-01T20:00",
      },
      headers: sameOriginHeaders(page),
    })
    expect(res.status()).toBe(403)
  })
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
  // location_type has the default value "none". Do not change it.
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  // The page renders EventLocation only for an event with a location, thus the "Ort" label
  // must be absent.
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

  // The linked location type makes the map location dropdown visible.
  await page.click('input[name="location_type"][value="linked"]')
  await page.locator("#linked-location-section").waitFor({ state: "visible" })

  // Select the first true location. The option at index 0 is the empty placeholder.
  const locationSelect = page.locator('select[name="map_location_id"]')
  const firstOptionText = await locationSelect.locator("option").nth(1).textContent()
  await locationSelect.selectOption({ index: 1 })

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  // The label of an option has the format "Location Name · City". Use only the name.
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

  // The custom location type makes the custom fields visible.
  await page.click('input[name="location_type"][value="custom"]')
  await page.locator("#custom-location-section").waitFor({ state: "visible" })

  await page.fill('input[name="custom_location_name"]', "E2E Test Venue")
  await page.fill('input[name="custom_location_address"]', "Teststraße 1")
  await page.fill('input[name="custom_location_city"]', "Bamberg")

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/event\/[a-z0-9-]+$/)

  await expect(page.getByRole("heading", { level: 1 })).toContainText(title)
  await expect(page.locator("body")).toContainText("E2E Test Venue")

  await deleteEvent(page)
})

test("created event appears on the /events listing page", async ({ page }) => {
  const title = uniqueTitle()
  const eventUrl = await createEvent(page, title)

  await page.goto("/events")
  await goToLastEventsPage(page)
  await expect(page.locator("body")).toContainText(title)

  await page.goto(eventUrl)
  await deleteEvent(page)
})
