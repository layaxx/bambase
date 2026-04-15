# BamBase.de Roadmap

## Upcoming

### P4 Interdependencies (events <-> locations)

Events currently have no structured connection to physical locations. Linking events to map locations would allow users to see where an event is taking place on the map, and conversely, see which events are happening at a given location.

**Work involved:**

- Add a `location` relation field to the `Event` content type pointing to `MapLocation` (requires P1 to be done first, or at least the `MapLocation` model to exist in the API)
- Update event creation/editing forms to allow selecting a location (with a search/autocomplete)
- Display the linked location on the event detail page with a mini-map or link to the full map
- On the map page, show upcoming events as markers or popups on the relevant location pins
- Optionally add a free-text `location_text` field as a fallback for events at locations not in the database

**Open questions:**

- P1 (map locations API) is a hard prerequisite — should this be blocked until P1 is complete?
- Should `location` be a strict relation to a `MapLocation` record, or also allow free-text input (for off-campus events)?
- How should the map display time-bounded event data — show all upcoming events, or only events happening today/this week?
- Should events without a linked location still appear on the map (e.g., at a generic university pin)?

---

### P5 Categories for Events, Jobs

Events and job offers currently have no category or tag system, making it hard for users to find relevant content. Adding categories would improve discoverability.

**Work involved:**

- Decide on a data model: a `Category` collection type (shared or separate for events vs. jobs) with `name` and `color`/`icon` fields, or a simple enum field on each content type
- Add a `category` (or `categories`) field to `Event` and `JobOffer` schemas
- Update creation/editing forms to allow selecting categories
- Display category badges on event/job cards and detail pages
- (Prerequisite for P6) Expose category as a filterable field in API queries

**Open questions:**

- Should events and jobs share the same category taxonomy, or have separate ones? (e.g., "Sport" makes sense for events but maybe not jobs)
- Should categories be user-defined (free tags) or admin-curated (fixed list)? A fixed list is easier to filter on but less flexible.
- What initial categories make sense? Examples for events: Kultur, Sport, Party, Vortrag, Workshop, Hochschulpolitik. For jobs: IT, Marketing, Gastronomie, Verwaltung, Forschung.
- Should there be a limit on how many categories an event/job can have?
- Should the Mensa meal categories (vegan/vegetarian) be unified with this system, or kept separate?

---

### P6 Filtering for Events, Jobs overview pages

The `/events` and `/jobs` pages currently show all content with no way to filter by date range, category, organizer, or other attributes. Filtering would significantly improve usability as content volume grows.

**Work involved:**

- Add filter UI controls to `/events`: by date range, by category (requires P5), by organizer/group
- Add filter UI controls to `/jobs`: by category (requires P5), by working hours range, by location (remote/on-site/hybrid)
- Implement filtering server-side via Strapi query parameters (already supported by `@strapi/client`) or client-side for small datasets
- Add a search bar (text search on title/description) for both pages
- Persist filter state in URL query params so results are shareable/bookmarkable

**Open questions:**

- Should filtering be server-side (better performance, SEO) or client-side (snappier UX, simpler implementation)? Astro's SSR mode supports both.
- P5 (categories) is a soft prerequisite for category-based filtering — should this be bundled with P5?
- What date filter options make sense for events: "this week", "this month", custom range?
- Should the homepage event/job widgets also respect filters, or only the dedicated listing pages?
- Is full-text search in scope, or just filtering on structured fields?

---

### P7 Add data sources for events

Automatically importing events from external sources would reduce the manual effort of maintaining the event calendar and provide better coverage of university life.

**Planned sources:**

- **UniVis** — the official university course/event system
- **LiveClub website** — local music/nightlife venue
- More TBD

**Work involved:**

- Build an importer/scraper service (could be a scheduled Strapi lifecycle hook, a cron job, or a separate script) for each source
- Map external event fields to the `Event` schema; use `external_id` field (already present) to deduplicate and track provenance
- Handle updates: if an imported event changes on the source, reflect the change; if deleted, mark as expired
- Add a `source` field to `Event` to indicate origin (manual, univis, liveclub, etc.) and display it on the detail page
- Respect rate limits and terms of service of external sources

**Open questions:**

- Does UniVis offer a public API or structured data feed (iCal, RSS, JSON), or does it require HTML scraping?
- Does LiveClub publish events in a machine-readable format?
- Who is responsible for monitoring and maintaining the importers when sources change their format?
- Should imported events be auto-published, or should they go through a review step first?
- How should conflicts be handled if an imported event was also manually created by a user?
- Are there legal/ToS considerations for scraping these sites?
- Should users be able to "claim" an imported event to add additional info or manage it?

---

### P8 About us page

There is currently no page explaining what BamBase.de is, who runs it, or how to contribute or contact the team.

**Work involved:**

- Design and implement a `/about` page in Astro
- Write content: project mission, team/contributors, how to report issues or suggest features, contact info
- Link the page from the main navigation and/or footer

**Open questions:**

- Who are the people behind the project, and are they comfortable being listed by name?
- Is there a contact email or form, or should users be directed to a GitHub repo/issue tracker?
- Should the page include information on how to contribute (student groups submitting their own entries, contributing code)?
- Should there be a privacy policy or imprint (Impressum) — this is likely a legal requirement for a German website?

---

### P9 Adjust Dark-mode colors

The current dark-mode color scheme (DaisyUI 5 + Tailwind CSS 4) needs refinement for readability and visual consistency.

**Work involved:**

- Audit all pages in dark mode for contrast issues, unreadable text, or jarring color combinations
- Adjust the `data-theme` DaisyUI configuration or Tailwind CSS variables for the dark theme
- Pay particular attention to: map popups (Leaflet default styles don't adapt to dark mode), Mensa meal cards, event/job cards, and form inputs

**Open questions:**

- Is there a reference design or brand color palette to adhere to?
- Should the dark-mode palette be derived from an existing DaisyUI theme, or fully custom?
- Are there specific pages or components users have flagged as looking broken in dark mode? -> text-primary looks bad on dark mode
- Should we support a system-preference-based automatic toggle, or only a manual toggle (already in place)?

### P10 Testing

There is currently one test suite (`api/test/mensaplan.test.ts`) covering the mensa service. The rest of the application — Strapi API services, frontend utility functions, and page-level behaviour — has no automated test coverage. Adding tests would reduce regression risk as the codebase grows and make refactors (especially P1–P7) safer to land.

**Current state:**

- **API (Strapi):** Jest + Babel configured; `mensaplan.test.ts` is the only test file. The test runner is invoked with `yarn test` inside `api/`.
- **Frontend (Astro):** No test framework configured. No test files exist.

**Work involved:**

- **API unit tests** — extend the existing Jest suite to cover other Strapi services and lifecycle hooks as they are written. Priorities: any future importers added under P7, the `Report` submission logic from P3, and any custom validation logic.
- **Frontend utility tests** — add a test framework (Vitest is the natural fit for a Vite/Astro project) to `frontend/` and write unit tests for the functions in `frontend/src/utils/api.ts`: date helpers, filter/transform utilities, and any business logic that does not require a live Strapi instance.
- **End-to-end tests** — use Playwright (first-class Astro integration via `@astrojs/playwright`) to cover the critical user journeys: viewing events and jobs, submitting a new job offer, submitting a new event, and the login/logout flow. These tests require a running Strapi instance and are best run in CI against a seeded test database.
- **CI integration** — add a GitHub Actions workflow (or extend an existing one) that runs `yarn test` in `api/` and `yarn test` in `frontend/` on every pull request. E2E tests can run on a slower schedule (e.g., nightly or on merge to main) using `docker-compose` to spin up the full stack.

**Suggested priority order:**

1. Vitest setup in `frontend/` + unit tests for `api.ts` helpers (low effort, high value)
2. API unit tests for each new service added alongside P1–P7 work (write tests alongside features)
3. Playwright E2E for the job and event submission flows (highest regression risk, most user-facing)

**Open questions:**

- Should E2E tests run against a dedicated test Strapi instance with a seeded SQLite database, or against a Docker Compose stack mirroring production (PostgreSQL)?
- Is there a target coverage threshold, or is the goal simply "critical paths covered"?
- Should Playwright tests be kept in a top-level `e2e/` directory or inside `frontend/`?
- Are snapshot/visual regression tests worth adding for dark-mode work (P9)?

### P11 Highlight Mensa Meal on Navigation from Frontpage

When a user clicks a meal on the homepage `MensaCard`, they land on `/mensa#YYYY-MM-DD-{loc}` (e.g. `/mensa#2026-04-09-feki`). The browser scrolls to the correct `MensaLocationCard` (which already carries a matching `id`), but there is no visual feedback — the card looks identical to all others, leaving the user to re-orient themselves on a page with up to 21 cards.

**Goal:** Briefly or persistently highlight the targeted location card so the user instantly knows where to look.

**Preferred approach — CSS `:target` pseudo-class:**

The `id` on `MensaLocationCard`'s root `<div>` already matches the hash, so a pure-CSS solution requires no JavaScript and no Astro changes beyond a single rule:

```css
/* MensaLocationCard.astro or global styles */
div:target {
  outline: 2px solid oklch(var(--p)); /* DaisyUI primary colour */
  outline-offset: 2px;
  border-color: oklch(var(--p) / 0.4);
  background-color: oklch(var(--p) / 0.04);
}
```

A brief CSS animation (fade-out glow) is also viable if a persistent ring feels too heavy:

```css
@keyframes highlight-fade {
  from { box-shadow: 0 0 0 4px oklch(var(--p) / 0.35); }
  to   { box-shadow: none; }
}

div:target {
  animation: highlight-fade 1.8s ease-out forwards;
}
```

**Work involved:**

- Add `:target` styles to `MensaLocationCard.astro` (scoped `<style>` block) or to the global stylesheet
- Verify the anchor IDs produced by `MensaDaySection` (`${id}-${loc.id}`, e.g. `2026-04-09-feki`) match the hash format written in `MensaCard.astro` (`/mensa#${relevantDayId}-${loc.id}`)
- Test in browser by clicking a meal on the homepage and confirming the card is highlighted on arrival
- Ensure the highlight does not interfere with dark mode (use DaisyUI CSS variables, not raw hex)

**Open questions:**

- Persistent ring vs. fade-out animation — which feels more natural? A fade-out avoids a permanent visual difference but the user may miss it if the page takes a moment to load.
- Should the `MensaDaySection` heading also scroll into view (it currently does via the native `<section id={id}>` anchor), or should the scroll target be the location card itself?
- Weekend sections (`MensaWeekendSection`) show no meal cards; no highlight is needed there, but the anchor should still scroll correctly — worth verifying.

## Done

### P3 Reporting functionality for Events, Jobs

Anonymous reporting for events and job postings. Reports are reviewed by admins via the Strapi admin panel. Reported content shows a warning badge on the detail page.

**Implemented:**

- `Report` content type in Strapi: `reason` (enum: spam/inappropriate/outdated/other), `details` (text), `target_type` (enum: event/job), `target_id`, `status` (enum: open/reviewed/dismissed)
- Public POST `/api/reports` route — no authentication required (anonymous)
- Public GET `/api/reports/count` route — returns report count for a target, used for the warning badge
- `ReportModal.astro` component with DaisyUI dialog, rendered server-side with i18n
- Report button on job detail pages (`/job/[uuid]`) — visible to non-owners
- Report button + event disclaimer on event detail pages (`/event/[slug]`) — visible to non-owners
- Warning badge shown when a job or event has open/reviewed reports
- Success alert shown after submitting a report
- Moderation via the Strapi admin panel (review and update `status` field per report)

---

### P2 Student Groups should be API-based

Currently, student organizations are stored as a hardcoded JSON file at `frontend/src/data/groups.json`. Moving them to the API would allow student groups to manage their own entries (e.g., update links, descriptions) without requiring a developer.

**Work involved:**

- Create a `StudentGroup` content type in Strapi with fields: `name`, `description`, `website`, `email`, `facebook`, `instagram`, plus any additional social links
- Migrate existing JSON data into Strapi
- Update `frontend/src/utils/api.ts` to fetch groups from the API
- Update all components that currently import from `groups.json` (homepage widget, dedicated group listing)
- Consider adding owner/claim functionality so groups can update their own entry

**Open questions:**

- Should student groups be able to self-register and manage their profile, or is it admin-managed only? -> for now, keep it admin only
- If self-managed: what verification is required to confirm someone represents a group (e.g., university email domain check)?
- Should inactive/defunct groups be archived or deleted? How do we identify them? -> out of scope
- Are there additional fields worth capturing (founding year, member count, meeting times, logo/image)? -> out of scope
- Should groups be linkable to events (the group is the organizer)?

---


### P1 Map Locations should be API-based

Currently, the ~100+ university map locations (buildings, dorms, libraries, cafés, etc.) are stored as a hardcoded JSON file at `frontend/src/data/infomapLocations.json`. Moving them to the Strapi API would allow admins to add, update, or remove locations without a code deployment.

**Work involved:**

- [x] Create a `Location` content type in Strapi with fields: `name`, `description`, `lat`, `lon`, `category` (enum), `external_url`, `slug`
- [x] Migrate existing JSON data into Strapi — location data added to `api/src/seed.ts`, seeded automatically on first run
- [x] Update `frontend/src/utils/api.ts` to fetch locations from the API (`fetchLocations`, `MapLocation` type)
- [x] Update the map page to use the API data; category filtering works; category labels are i18n'd

**Category enum values:** `university`, `mensa`, `library`, `sport`, `venues`, `other`
(JSON categories `Wohnen` → `other`, `Cafés, Bars & Clubs` → `venues`)

**Open questions:**

- Should `category` be a free-text field, an enum, or a separate `MapCategory` collection? An enum is simpler but a relation allows categories to carry metadata (icon, color, description). -> should be an enum. ✓ done
- Should locations be publicly editable (user-submitted) or admin-only? If user-submitted, a review/workflow is needed. -> admin-only! ✓
- Is there a canonical data source (e.g., university GIS data) we could pull from, or is manual entry the only option? -> unclear

---

### P0.3 Correct day for mensaplan card

`MensaCard.astro` now computes the relevant day dynamically: weekdays before 15:00 show today, after 15:00 show the next weekday (Friday wraps to Monday), weekends show Monday. Subtitle switches between "Heute, \<date\>" and "Morgen, \<date\>" accordingly, using new `cardSubtitleToday` i18n keys in both locales.

---

### P0.2 Improve Interlinking

- Added `id={entry.id}` (ISO date string) to `MensaDaySection` and `MensaWeekendSection`, applied to their outermost `<section>`, enabling anchor URLs like `/mensa#2026-04-09`.
- Wrapped each meal item in `MensaCard.astro` in an `<a href="/mensa#YYYY-MM-DD">` linking to the relevant day section.
- Removed `hidden sm:flex` from the "full plan" / "show all" links in `MensaCard.astro`, `JobCard.astro`, and `HeuteInBamberg.astro` — they are now visible on all screen sizes.
- Events and jobs on the homepage already linked individual cards to `/event/[slug]` and `/job/[uuid]` respectively — no changes needed there.

---

### P0.1 Add vegan/vegetarian badge to mensa plan on front page

Added vegan/vegetarian badges inline to the meal `<li>` elements in `MensaCard.astro`. Vegan meals show only the vegan badge (emerald); vegetarian-only meals show the vegetarian badge (green). No allergen expander on the compact card. The `isVegan`/`isVegetarian` fields were already present on `MensaMeal` and needed no API changes.

---

### P0 Add option to archive jobs

Job owners currently have no way to signal that a position has been filled. They can delete the posting (destructive, loses history) or wait for it to auto-expire via `offline_after` (misleading — implies time-out, not success). A dedicated `archived` status lets owners close a posting cleanly while preserving the record.

**Current state:**

The `online_status` enumeration in `api/src/api/job-offer/content-types/job-offer/schema.json` has four values: `submitted`, `published`, `expired`, `rejected`. The `expired` transition is automated (triggered by `unpublishExpired` in `api/src/api/job-offer/services/job-offer.ts` when `offline_after` is in the past). There is no owner-initiated "close" action.

**Work involved:**

- **API schema** — add `"archived"` to the `online_status` enum in `schema.json`. No migration needed since Strapi manages the enum at the application layer.
- **Strapi permissions** — ensure the `update` endpoint allows an authenticated owner to set `online_status` to `"archived"` (and only to `"archived"` — owners must not be able to self-publish or un-reject). The existing controller in `api/src/api/job-offer/controllers/job-offer.ts` may need a guard.
- **Astro action** — add an `archive` action (alongside the existing `delete` action) that calls `PATCH /api/job-offers/:documentId` with `{ online_status: "archived" }`, scoped to the authenticated owner.
- **Job detail page** (`frontend/src/pages/job/[uuid]/index.astro`) — add an "Archive / Position filled" button in the owner action bar next to Edit and Delete. Show a confirmation dialog analogous to the delete confirm. Redirect to `/account/jobs` on success.
- **Account jobs page** (`frontend/src/pages/account/jobs.astro`) — add `"archived"` to `statusLabel` and `statusClass` (e.g. `badge-info` or `badge-neutral`).
- **Public listing** — `archived` jobs must not appear publicly. The existing filter `{ online_status: { $eq: "published" } }` in `fetchJobOffers` already excludes them; no change needed.
- **i18n** — add translation keys for the new status label and the archive button/confirm text.

**Open questions:**

- Should `archived` be reversible (owner can re-publish), or is it a terminal state like `rejected`? -> Yes, this is a terminal state. Owners could submit a new job offer if they like
- Should the job detail page show a public-facing banner for archived jobs (e.g. "This position has been filled") for users following a direct link? -> no, they will only be visible to the owner
- Should archiving notify anyone (e.g. applicants who saved the link)? Probably out of scope for now. -> no notfications

---

