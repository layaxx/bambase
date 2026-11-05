import { expect, test } from "@playwright/test"

test.describe("Homepage", () => {
  test("loads without errors and shows key sections", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("link", { name: "Aktuelle Events" })).toBeVisible()
    await expect(page.locator("#mensa").getByRole("link", { name: "Mensaplan" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Aktuelle Stellenangebote" })).toBeVisible()
    await expect(
      page.locator("#map").getByRole("link", { name: "Campuskarte", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Aktiv in Bamberg" })).toBeVisible()
  })

  test("login link is visible when unauthenticated", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Einloggen" })).toBeVisible()
  })
})

test.describe("Job detail — not found", () => {
  test("visiting a non-existent job slug shows not-found content", async ({ page }) => {
    const response = await page.goto("/job/not-a-real-slug")
    expect(response?.status()).toBe(404)
    await expect(page.locator("body")).not.toContainText("500")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: "Alle Jobs" })).toBeVisible()
  })
})

test.describe("Event detail — not found", () => {
  test("visiting a non-existent event slug shows not-found content", async ({ page }) => {
    const response = await page.goto("/event/this-slug-does-not-exist")
    expect(response?.status()).toBe(404)
    await expect(page.locator("body")).not.toContainText("500")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: "Alle Veranstaltungen" })).toBeVisible()
  })
})

test.describe("Jobs listing (/jobs)", () => {
  test("seeded published jobs are listed (not submitted/archived)", async ({ page }) => {
    // The search narrows the list, thus the checks do not depend on the page that a job is on.
    await page.goto("/jobs?search=Feki")
    await expect(
      page.locator('a[href="/job/werkstudent-in-softwareentwicklung-feki-de-e-v"]')
    ).toBeVisible()

    // The seed has a submitted job (Data Science) and an archived job (Nachhilfeinstitut).
    await page.goto("/jobs?search=Data+Science")
    await expect(page.getByText("Keine Stellen gefunden")).toBeVisible()
    await page.goto("/jobs?search=Nachhilfeinstitut")
    await expect(page.getByText("Keine Stellen gefunden")).toBeVisible()
  })

  test("filtering by job type and work mode keeps only matching jobs", async ({ page }) => {
    const internship = page.locator('a[href="/job/praktikum-marketing-social-media-bambus-e-v"]')
    // The search narrows the list to seeded jobs, thus the checks do not depend on the page that
    // a job is on. "e. V." finds Feki (hybrid), BamBuS (on site) and cogita (remote).
    await page.goto(`/jobs?${new URLSearchParams({ search: "e. V." })}`)
    const sidebar = page.locator("aside", { hasText: "Stellenart" })

    // Each seeded type has one published job, thus the work mode filter is checked on its own.
    await sidebar.getByRole("link", { name: "Vor Ort", exact: true }).click()
    await expect(page).toHaveURL(/work_mode=on_site/)
    await expect(internship).toBeVisible()
    await expect(
      page.locator('a[href="/job/werkstudent-in-softwareentwicklung-feki-de-e-v"]')
    ).toHaveCount(0)
    await expect(
      page.locator('a[href="/job/remote-junior-consultant-m-w-d-cogita-e-v"]')
    ).toHaveCount(0)

    await sidebar.getByRole("link", { name: "Praktikum", exact: true }).click()
    await expect(page).toHaveURL(/type=internship/)
    await expect(internship).toBeVisible()

    // The Schlenkerla job is on site too, thus only a type filter that is combined with AND
    // removes it.
    const schlenkerla = page.locator('a[href="/job/aushilfe-service-kueche-schlenkerla"]')
    await page.goto("/jobs?search=Schlenkerla&work_mode=on_site")
    await expect(schlenkerla).toBeVisible()
    await sidebar.getByRole("link", { name: "Praktikum", exact: true }).click()
    await expect(schlenkerla).toHaveCount(0)
  })

  test("a search finds a job whose detail page shows how to apply", async ({ page }) => {
    await page.goto("/jobs")
    await page
      .getByRole("searchbox", { name: "Nach Stelle oder Unternehmen suchen…" })
      .fill("Schlenkerla")
    await page.getByRole("button", { name: "Suchen", exact: true }).click()

    await expect(page).toHaveURL(/search=Schlenkerla/)
    const schlenkerla = page.locator('a[href="/job/aushilfe-service-kueche-schlenkerla"]')
    await expect(schlenkerla).toBeVisible()
    await expect(
      page.locator('a[href="/job/werkstudent-in-softwareentwicklung-feki-de-e-v"]')
    ).toHaveCount(0)
    await schlenkerla.click()

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Aushilfe Service & Küche")
    await expect(page.getByRole("link", { name: "0951 56060" })).toHaveAttribute("href", /^tel:/)
  })
})

test.describe("Events listing (/events)", () => {
  test("page loads and shows seeded upcoming events", async ({ page }) => {
    await page.goto("/events")

    await expect(page.locator('a[href="/event/ersti-party"]')).toBeVisible()
  })
})

test.describe("Mensa (/mensa)", () => {
  test("page loads without errors", async ({ page }) => {
    await page.goto("/mensa")
    await expect(page.getByText("Am Wochenende geschlossen").first()).toBeVisible()
  })
})

test.describe("Map (/map)", () => {
  test("category filter buttons are visible", async ({ page }) => {
    await page.goto("/map")
    await expect(page.getByRole("button", { name: "Uni-Gebäude", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mensa & Cafeteria", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Bibliotheken", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sport", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sonstiges", exact: true })).toBeVisible()
  })

  test("map container is rendered", async ({ page }) => {
    await page.goto("/map")
    // Leaflet adds this class only after it starts, thus the check fails if the map script breaks.
    await expect(page.locator(".leaflet-container")).toBeVisible()
  })
})

test.describe("Sitemap (/sitemap.xml)", () => {
  test("returns valid XML with expected static URLs", async ({ request }) => {
    const response = await request.get("/sitemap.xml")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/xml")

    const body = await response.text()
    expect(body).toContain('<?xml version="1.0"')
    expect(body).toContain("http://www.sitemaps.org/schemas/sitemap/0.9")
    expect(body).toContain("/events")
    expect(body).toContain("/jobs")
    expect(body).toContain("/about")
    expect(body).toContain("/impressum")
    expect(body).toContain("/privacy")
  })

  test("omits non-published jobs", async ({ request }) => {
    const response = await request.get("/sitemap.xml")

    const body = await response.text()
    // The seed gives this job the onlineStatus "submitted", thus it is not published.
    expect(body).not.toContain("/job/bachelor-masterarbeit-im-bereich-data-science")
  })

  test("includes published jobs", async ({ request }) => {
    const response = await request.get("/sitemap.xml")

    const body = await response.text()

    expect(body).toContain("/job/werkstudent-in-softwareentwicklung-feki-de-e-v")
    // The seed user owns this job, but a published job is public.
    expect(body).toContain("/job/praktikum-marketing-social-media-bambus-e-v")
  })

  test("includes published events", async ({ request }) => {
    const response = await request.get("/sitemap.xml")

    const body = await response.text()

    expect(body).toContain("/event/ersti-party")
    expect(body).toContain("/event/gastvortrag-ki-im-alltag")
  })
})

test("Locale switching from German to English and back to German works as expected", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page.locator("html")).toHaveAttribute("lang", "de")
  await page.goto("/set-locale?lang=en&redirect=/")
  await expect(page.locator("html")).toHaveAttribute("lang", "en")

  await page.goto("/set-locale?lang=de&redirect=/jobs")
  await expect(page.locator("html")).toHaveAttribute("lang", "de")
})
