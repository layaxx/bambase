# BamBase.de Roadmap

## Upcoming

### P16 Performance

Audit-driven improvements to API query efficiency, rendering strategy, and asset loading. No new features — the goal is reducing latency and server load, especially as data volumes grow.

**Issues identified — API over-fetching and N+1 queries:**

- **Mensa page makes 7 serial API calls** — `mensa.astro:17–22` builds an array of 7 days then calls `fetchMensaMeals(day)` for each via `Promise.all`. Each call is a separate HTTP round-trip to Strapi with its own query. A single call filtering on `date: { $in: [...days] }` would replace all 7. Because this is SSR, it happens on every `/mensa` page load.
- **Job offer `find()` makes 2 queries and deduplicates in JavaScript** — `controllers/job-offer.ts:14–32` runs two parallel `findMany` calls (one for published, one for the user's own offers), then merges and deduplicates in a `Set`. A single `$or` filter would produce the same result with half the database load on every authenticated job listing request.
- **`fetchLocations()` has a hard limit of 500** — `utils/api/locations.ts:24`. The map currently has ~100 locations; the limit is set to 500 as a safety margin. This loads and serializes the entire locations table plus nested address components on every `/map` load. The limit should reflect the real dataset size, and the fetch should use `fields` projection to drop unused fields.
- **`update` and `delete` controller methods each fetch the full job/event record just to check ownership** — `controllers/job-offer.ts:48, 67`. Only the `owner.id` field is needed; the full `populate: ["owner"]` call fetches the entire user relation. Use `fields: ["id"], populate: { owner: { fields: ["id"] } }`.

**Issues identified — database:**

- **No indexes on frequently filtered columns** — `events.start`, `events.end` (filtered on every events list with `$gte`/`$lte`), `job-offers.online_status` (filtered on every job list and the `unpublishExpired` service), and `mensa-meals.date` (filtered 7× per mensa page load) have no custom indexes defined. Strapi does not auto-index non-primary enum or datetime fields. These will cause full table scans as row counts grow.
- **`mensa-meals` sync writes records one at a time** — `api/src/api/mensa/services/mensa.ts` loops over ~60 meals and issues individual `create`/`update`/`delete` calls. This runs 7× daily and causes 60+ sequential database writes per run. Batch with `Promise.all` to parallelise.

**Issues identified — rendering strategy:**

- **Every page is fully SSR with no caching** — `astro.config.mjs` uses `output: "server"`. Pages like `/mensa`, `/map`, and `/` fetch data that changes at most once per day (mensa data via cron at 05:30, locations almost never, events/jobs rarely within minutes). Every visitor triggers a full set of API calls to Strapi. Strapi has no `Cache-Control` headers on public GET endpoints. Adding even a 5-minute `s-maxage` on the Strapi responses, or adding `export const prerender = true` on `/map` and `/mensa`, would eliminate the majority of redundant fetches.
- **All filtering on `/events` and `/jobs` is client-side** — both pages fetch up to 100 records, render them all to HTML, then hide/show via JavaScript. This couples page weight to dataset size. If either catalog grows to 500+ items, initial HTML will bloat proportionally. The filtering logic should eventually move to server-side query parameters; for now, the existing approach is acceptable at current scale.

**Issues identified — assets:**

- **Leaflet loaded from unpkg CDN at runtime** — `map.astro:115` adds a `<link>` for Leaflet CSS and then injects a `<script>` tag dynamically in JavaScript to load Leaflet JS from `unpkg.com`. This means: (a) the map cannot render until two CDN round-trips complete, (b) there is no subresource integrity check, and (c) the page has an external dependency. Leaflet should be bundled (`npm install leaflet`) or at minimum loaded with `<link rel="preload">` and a `<script defer>`.
- **Font imports have no `font-display` override** — `Layout.astro:3–4` imports Archivo and Inter via `@fontsource-variable`. These are self-hosted, which is good, but there is no `font-display: swap` override in `global.css`. If the font files are slow to load the browser shows invisible text (FOIT) rather than falling back immediately.

**Work involved:**

- [ ] Collapse the 7 `fetchMensaMeals` calls into one: add a `date: { $in: [...] }` filter variant to `fetchMensaMeals` (or a new `fetchMensaMealsRange` function), update `mensa.astro` to use it
- [ ] Rewrite `job-offer.ts` `find()` to use a single `$or` query instead of two `findMany` + JS dedup
- [ ] Reduce `fetchLocations()` limit to match actual dataset size (e.g. 200); add `fields` projection to drop unused columns
- [ ] Narrow `populate: ["owner"]` in `update` and `delete` controllers to `populate: { owner: { fields: ["id"] } }`
- [ ] Add database indexes for `events.start`, `events.end`, `job-offers.online_status`, `mensa-meals.date` — via a Strapi database migration or by documenting as a manual PostgreSQL step in the deployment guide
- [ ] Parallelise the mensa sync loop with `Promise.all` on the create/update/delete batches
- [ ] Add `Cache-Control: public, s-maxage=300` to public Strapi GET responses (locations, published events, published jobs) via a custom middleware in `api/config/middlewares.ts`
- [ ] Replace Leaflet CDN `<script>` injection with `npm install leaflet` + a bundled import, and add a `<link rel="preload">` for the CSS
- [ ] Add `font-display: swap` to the Archivo and Inter `@font-face` declarations in `global.css`

**Open questions:**

- Should `/mensa` and `/map` use Astro's `prerender = true` (static build, rebuilt on deploy) or stay SSR with a short `Cache-Control` TTL? Static build is simpler but requires a redeploy to pick up fresh mensa data; a CDN with `s-maxage=300` at the Strapi layer achieves the same result without changing the rendering mode.
- Are database indexes best added via a Strapi migration file (keeps them tracked in version control) or via a documented `CREATE INDEX` step in the deployment runbook? Strapi's migration system supports raw SQL, which is the cleanest approach.
- The client-side filtering on `/events` and `/jobs` was a deliberate design decision (P6). At what catalog size should it move server-side? A reasonable threshold is ~300 items, at which point the rendered HTML is noticeably large and filter latency becomes measurable.

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

### P14 Accessibility

Audit-driven pass to reach WCAG 2.1 AA compliance across all pages and components. Issues are grouped by severity; the work-involved checklist below is ordered by priority.

**Issues identified — page structure:**

- **No skip-to-main-content link** — `AppLayout.astro` has `<Header />` before `<slot />` with no preceding skip link. Keyboard-only users must tab through the entire nav on every page to reach content.
- **Home page has no `<h1>`** — `index.astro` renders five widget cards, each with an `<h2>`, but there is no top-level `<h1>`. Every page must have exactly one `<h1>`.
- **`<title>` is the same on all pages** — `Layout.astro:15` has `<title>BamBase.de</title>` hardcoded. Users with multiple tabs open and screen reader users announcing the page title cannot distinguish pages. Should be `Events – BamBase.de`, `Jobs – BamBase.de`, etc.

**Issues identified — forms:**

- **Location type radio group has no `<fieldset>/<legend>`** — `EventForm.astro` lines 181–207 render three radio buttons (`none`, `linked`, `custom`) under a plain `<span>` label. Without a `<fieldset>` grouping them and a `<legend>` naming the group, screen readers cannot announce what the radios are for.
- **`StudentGroup` expand button has no `aria-expanded`** — `StudentGroup.astro:31` renders a "Mehr anzeigen" button that toggles a clamped description, but `aria-expanded` is never set on it. Screen readers cannot tell users whether the content is expanded or collapsed.

**Issues identified — modals:**

- **`<dialog>` missing `aria-labelledby`** — `ReportModal.astro:24` renders `<dialog class="modal" id="reportModal">` without referencing the `<h3>` inside it. Add `aria-labelledby="reportModalTitle"` on the dialog and `id="reportModalTitle"` on the h3 so screen readers announce the dialog name when it opens.
- **Modal backdrop button has visible text** — `ReportModal.astro:67` — DaisyUI's backdrop close pattern renders `<button>close</button>`. The word "close" is visually hidden by the overlay but is read aloud by screen readers as an unlabelled action. Replace with `<button aria-label="Schließen">` and an empty or sr-only label.

**Issues identified — dynamic regions:**

- **Result counts not announced to screen readers** — `events.astro:70–76` and `jobs.astro:111` update a result-count element via JavaScript when filters change, but neither element has `aria-live="polite"`. Blind and low-vision users are not informed when the result set changes.

**Issues identified — motion:**

- **No `prefers-reduced-motion` override** — `global.css` has no `@media (prefers-reduced-motion: reduce)` rule. Tailwind transition utilities (`transition-all`, `transition-colors`, `transition-transform`) are used on cards, buttons, the header, and the chevron in the jobs filter panel with no opt-out for users who have vestibular disorders or motion sensitivity.

**Issues identified — contrast (informational):**

- `InfomapCard.astro:46` uses `text-base-content/30` on a description label — 30 % opacity almost certainly fails WCAG AA (4.5:1) on the DaisyUI base background in both light and dark themes. Decorative icons at that opacity are fine; readable text is not.
- `map.astro:97` and `MensaWeekendSection.astro:16` use `text-base-content/40` on descriptive text. Worth verifying computed contrast ratios; raise to `/60` or higher if they fail.

**Work involved:**

- [ ] Add skip link as the first element in `AppLayout.astro`: `<a class="sr-only focus:not-sr-only" href="#main-content">Zum Inhalt springen</a>`; add `id="main-content"` to `<main>` in `PageLayout.astro`
- [ ] Add a visually-hidden `<h1>` (or a visible one) to `index.astro` — e.g. `<h1 class="sr-only">BamBase.de – Studierendenportal Bamberg</h1>`
- [ ] Make `<title>` dynamic: accept a `title` prop in `Layout.astro` and pass it from each page; fall back to `"BamBase.de"`
- [ ] Wrap the location type radio buttons in `EventForm.astro` with `<fieldset>` and `<legend>`
- [ ] Add `aria-expanded="false"` to the "Mehr anzeigen" button in `StudentGroup.astro`; toggle it in the existing click handler
- [ ] Add `aria-labelledby="reportModalTitle"` to the `<dialog>` in `ReportModal.astro`; add `id="reportModalTitle"` to its `<h3>`
- [ ] Replace the backdrop `<button>close</button>` in `ReportModal.astro` with `<button aria-label="Schließen"></button>`
- [ ] Add `aria-live="polite"` to the result-count elements in `events.astro` and `jobs.astro`
- [ ] Add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }` to `global.css`
- [ ] Raise `text-base-content/30` in `InfomapCard.astro` to `/60`; verify computed contrast on `/40` usages in `map.astro` and `MensaWeekendSection.astro`

**Open questions:**

- Should the home page `<h1>` be visible (e.g. a hero tagline) or screen-reader-only? A visible tagline ("Das Studierendenportal für Bamberg") would improve the page's value for all users and search engines.
- Is there a target WCAG conformance level — AA (standard) or AAA? AA is the legal baseline for German public websites (BITV 2.0).

### P13 Design & Layout

Cleanup of layout structure, navigation, footer, and visual inconsistencies across all non-homepage pages. No new features — the goal is consistency and polish.

**Issues identified — layout & containers:**

- **Account pages bypass `PageLayout`** — `account.astro` uses `AppLayout` directly with its own `max-w-2xl mx-auto px-4 py-12` container; `account/events.astro` and `account/jobs.astro` use `PageLayout` but with different heading styles. All three should use `PageLayout` uniformly.
- **Three parallel container strategies in use** — `PageLayout` (inline `max-width: 80rem; padding: 2rem 1rem`), account pages (`max-w-2xl px-4 py-12`), and login/register (`max-w-2xl mx-auto`). Consolidate into one approach. Also move the `PageLayout` inline style to a Tailwind `max-w-7xl` utility.
- **Heading styles inconsistent** — listing pages (`events`, `jobs`, `mensa`, `map`) use `PageHeader.astro` with `text-3xl font-bold tracking-tight sm:text-4xl`; detail pages use the same classes inline; account pages use `text-2xl font-extrabold`. Standardize on the `PageHeader` component everywhere, or document the intentional distinction.

**Issues identified — header:**

- **Inline `font-family` style** (`Header.astro:39`) — the logo font is set with `style="font-family: 'Archivo Variable', sans-serif;"` instead of a CSS class.
- **Desktop vs. mobile button inconsistency** — the desktop login button is `btn btn-sm` (neutral); the mobile drawer login button is `btn btn-sm btn-primary w-full` (primary, full-width). They should look equivalent within their respective contexts, not visually different.
- **Back-navigation button classes differ** — detail and create pages use `btn-ghost btn-sm gap-1 pl-0`; account sub-pages use `btn-ghost btn-sm btn-square`. Pick one pattern and apply it everywhere.

**Issues identified — footer:**

- **Footer exists but is near-empty** — `Footer.astro` contains only a "built with" attribution line and a back-to-top link that points to `href="#"` (non-functional).
- **Back-to-top link is broken** — `href="#"` jumps to the URL fragment root but does not smoothly scroll. Should be `href="#top"` with `id="top"` on the `<body>` or use a `<button>` with `window.scrollTo`.
- **No meaningful content** — a footer is the natural place for: site name + tagline, key navigation links (Events, Jobs, Mensa, Map), About/Impressum link (legally required for a German public website), and contact or GitHub link.

**Issues identified — design inconsistencies:**

- **Text opacity scale has five levels** (`/30`, `/40`, `/50`, `/60` and no suffix) used interchangeably for secondary text. Settle on two or three semantic levels (e.g. `base-content/70` for secondary, `base-content/40` for muted) and apply them consistently.
- **Section icon backgrounds use different semantic colors per section** — `InfomapCard` uses `bg-info/20`, `JobCard` uses `bg-success/20`, `MensaCard` uses `bg-warning/20`. This is intentional theming and can stay, but should be documented as deliberate so future cards follow the same per-section assignment.
- **Map popup inline styles** — `map.astro` generates Leaflet popup HTML via JavaScript template strings with extensive hardcoded inline styles (padding, font sizes, border radii, the red `#ef4444` event badge color). These should move to CSS classes or at minimum to CSS custom properties in `global.css`, consistent with how the map category colors are already handled.
- **`StudentGroup.astro` uses webkit inline styles** for line-clamp — replaceable with Tailwind's `line-clamp-4` utility.

**Work involved:**

- [ ] Migrate `account.astro` to use `PageLayout`; unify heading style with other account sub-pages (`text-3xl font-bold tracking-tight sm:text-4xl` or explicit decision to keep `text-2xl`)
- [ ] Replace `PageLayout.astro` inline style with `max-w-7xl mx-auto px-4 py-8`
- [ ] Move Header logo `font-family` to a CSS class in `global.css`
- [ ] Align desktop and mobile login button appearance in `Header.astro`
- [ ] Standardize back-navigation button class (pick `btn-ghost btn-sm gap-1 pl-0`)
- [ ] Expand footer: add site nav links, About/Impressum link, fix back-to-top
- [ ] Reduce text opacity levels to two: `/70` (secondary) and `/40` (muted); do a find-and-replace pass
- [ ] Extract Leaflet popup inline styles to CSS classes or `global.css` custom properties; remove hardcoded `#ef4444`
- [ ] Replace inline webkit line-clamp in `StudentGroup.astro` with `line-clamp-4`

**Open questions:**

- Should the footer include an Impressum (legally required for German websites with commercial/editorial character)? BamBase serves a public audience — this is likely a legal requirement and should be a separate task if so.
- Should there be a breadcrumb component for detail pages (e.g. Events → Event title), or is the existing back-link sufficient?
- Should the account section have its own narrower max-width (`max-w-2xl`) intentionally, since it's form-heavy? If so, document the exception rather than removing it.

## Done

### P15 Test coverage gaps

The existing test suite is strong on utility functions and E2E happy paths but has zero unit-test coverage on the most critical code paths: action handlers, lifecycle hooks, and Strapi controllers. These are the files most likely to silently regress.

**What IS covered well:**

- 17 Vitest unit test files covering all API utility functions, formatting helpers, and key components (`JobForm`, `EventForm`, `ReportModal`, mensa components)
- 6 Playwright E2E specs covering auth, job CRUD, event CRUD, report submission, public pages, and account pages against a real Docker Compose stack
- 1 Jest integration test for the mensa import service (319 lines, covers transformation, deduplication, and partial failure)

**Critical gaps — zero unit coverage on high-risk paths:**

- **`actions/auth.ts`** — login, register, and getMe are entirely untested as units. Cookie options (`httpOnly`, `sameSite`, `maxAge`), error message shape, and token parsing are all unverified. If cookie config silently breaks, users log in but aren't actually authenticated.
- **`actions/jobs.ts`** — all four actions (create, update, delete, archive) have no unit tests. The E2E tests confirm the happy path works but don't cover 403 on non-owner operations, 400 on invalid input, or network failure during submission.
- **`actions/events.ts`** — same gap. Critically, `buildLocationData()` — the function that routes between no-location, linked map location, and custom location — has no unit test despite several branching conditions and nullable fields.
- **`actions/reports.ts`** — entirely untested. The `target_type → field name` mapping (`event` vs `job_offer`) is a silent failure point: wrong mapping means reports persist with the wrong relation.
- **API lifecycle hooks** (`api/src/api/*/content-types/*/lifecycles.ts`) — owner assignment, UUID/slug generation, and `offline_after` date calculation all run in `beforeCreate` hooks with zero test coverage. If owner assignment breaks, content becomes unowned and editable by anyone.
- **Strapi controllers** (`api/src/api/job-offer/controllers/job-offer.ts`, `event/controllers/event.ts`) — the custom `find()` merging (published + own offers), `update()` ownership check, and `online_status` guard (only `archived` allowed for non-admins) are all untested. These are the server-side authorization enforcement points.
- **`src/middleware.ts`** — locale detection from `Accept-Language` header and cookie override logic have no tests.

**Moderate gaps:**

- `fetchOngoingOrUpcomingEvents()` and `fetchUpcomingMapEvents()` (complex `$or` time filters, map location population) — not in the existing API utility test files
- The 401-retry fallback in `fetchJobOffer()` — unverified that it retries with the server token and doesn't loop
- `utils/url-params.ts` — 9 lines, zero coverage
- `formatJobOfferDate()` relative-time output (dayjs locale switching)
- E2E: no test verifies that a non-owner *cannot* edit or delete someone else's content (privilege escalation is only checked implicitly)
- E2E: account page tests are thin (35 lines) — no test for the empty state, status badge rendering, or the archive confirmation dialog

**Work involved:**

- [x] Unit tests for all four action files — mock `fetch` and `context.cookies`; cover happy path, auth missing, upstream 4xx, and network failure
- [x] Unit tests for `buildLocationData()` in `events.ts` — all three branches (`none`, `linked`, `custom`), null address/city, missing `map_location_id`
- [x] Unit tests for `actions/reports.ts` — both `target_type` values, optional `details`, error re-throw
- [x] Unit tests for `beforeCreate` lifecycle hooks — mock Strapi context; assert owner set, UUID/slug generated, `offline_after` correct, `online_status` defaulted
- [x] Unit tests for controller ownership guards — mock `ctx.state.user`, assert 403 when IDs mismatch, assert `online_status` field is stripped except for `archived`
- [x] Unit tests for `fetchOngoingOrUpcomingEvents()` and `fetchUpcomingMapEvents()` — add to existing `events.test.ts`
- [x] Unit tests for `fetchJobOffer()` 401-retry logic — mock two sequential fetch calls
- [x] Unit tests for `src/middleware.ts` — cover `Accept-Language` parsing, cookie override, unsupported locale fallback
- [x] Unit tests for `utils/url-params.ts`
- [x] E2E test: authenticated user attempts to DELETE/PUT another user's job and event → expect 403
- [x] E2E test: account page with no content shows empty state

---

### P12 Improve Form Layout

Improve the layout/design/UI/UX of form pages (create/edit event, create/edit job) and the overview pages (`/events`, `/jobs`).

**Issues identified — forms:**

- **Job form not extracted into a shared component** — `job/new.astro` contains ~200 lines of inline form HTML, almost certainly duplicated in `job/[uuid]/edit.astro`. Should become a shared `JobForm.astro` component, parallel to the existing `EventForm.astro`.
- **Bug: custom location section uses `flex-col` without `flex`** — in `EventForm.astro` the custom location container has `class="mt-3 flex-col gap-3"`, which has no effect without `flex`. The inputs fall back to block layout when shown. Fix: add `flex` to the class list.
- **No visual section separation** — the job form has a `<h2>` for the contact section but no visual divider or card container. Logical field groups should be visually separated (e.g. a `divider` or a `bg-base-200` card wrapper) to make long forms easier to scan.
- **Required field indicators inconsistent** — optional fields are labelled inline with `(optional)` text, but required fields carry no visible marker. Standardize: mark only optional fields with `(optional)` (current approach) and apply it consistently to all optional fields.
- **No "Cancel" link next to submit** — both forms have a lone submit button with no escape back to the listing page. A ghost "Cancel" / back link should sit alongside it.

**Issues identified — overview pages:**

- **Filter UI pattern differs between `/events` and `/jobs`** — `/events` uses always-visible inline category buttons plus a `<select>` for date range; `/jobs` uses a collapsible `<details>` panel. Standardize on one approach across both pages.
- **No result count** — neither page shows "X events / jobs found". The existing `applyFilters()` scripts already know which items are visible; adding a count `<span>` is straightforward.
- **No "Clear filters" affordance in empty state** — when no items match, the empty-state message gives no way to reset. Both `#no-events-msg` and `#no-jobs-msg` should include a "Clear filters" button.
- **Inconsistent filter bar spacing on `/events`** — the category buttons row uses `mb-2` and the date select row uses `mb-6`; consolidating them into a single filter bar would clean this up.

**Work involved:**

- [x] Extract `JobForm.astro` shared component (removes duplication between create and edit)
- [x] Fix `flex` missing from custom location section in `EventForm.astro`
- [x] Add "Cancel" (back) link alongside each submit button
- [x] Standardize filter UI pattern across `/events` and `/jobs`
- [x] Add result count updated by `applyFilters()` on both listing pages
- [x] Add "Clear filters" button to empty-state messages on both listing pages

---

### P9 Adjust Dark-mode colors

The current dark-mode color scheme (DaisyUI 5 + Tailwind CSS 4) needs refinement for readability and visual consistency.

**Work involved:**

- [x] Boost `--color-primary` lightness in dark mode (`global.css`) so `text-primary` links are readable on dark backgrounds
- [x] Map popups: replace all hardcoded inline-style colors in `buildPopupHtml()` / `makeIcon()` with CSS custom properties (`--popup-*`) that have light/dark variants; add `.leaflet-popup-content-wrapper` dark mode override
- [x] Mensa badges: replaced with DaisyUI `badge badge-success` in `MensaMealItem.astro` and `MensaCard.astro` (also extracted into shared `MealBadge.astro` component)
- [x] Section icon containers: replace light-only Tailwind palette classes (`bg-orange-100`, `bg-green-100`, `bg-blue-100`, `bg-purple-100`) with DaisyUI semantic classes (`bg-warning/20`, `bg-success/20`, `bg-info/20`, `bg-secondary/20`) in `MensaCard.astro`, `MensaDaySection.astro`, `JobCard.astro`, `EventsTodayCard.astro`, `InfomapCard.astro`, `StudentGroupsCard.astro`
- [x] `InfomapCard.astro` category dots: replaced hardcoded hex colors with CSS variables (`--cat-*` / `--cat-*-bg`) defined in `global.css` with proper dark variants
- [x] Define `--cat-*` and `--cat-*-bg` in `global.css` so they are available globally (not just on `/map`)
- [x] Audit remaining pages in dark mode for any missed contrast issues — no additional issues found; all pages use DaisyUI semantic classes correctly

**Decisions made:**

- No brand color palette exists; DaisyUI's default `light`/`dark` themes are kept as-is. Only targeted CSS variable overrides are added in `global.css`.
- Form inputs (`input-bordered`, `textarea-bordered`) use DaisyUI semantic classes and require no changes.
- System-preference-based auto-toggle is **already implemented** in `Layout.astro` (checks `prefers-color-scheme` before falling back to localStorage). No changes needed.

**Open questions:** none

---

### P6 Filtering for Events, Jobs overview pages

Client-side filtering on both listing pages. Filter state is persisted in URL query params (`?category=sport&date=week`, `?type=internship&field=it`) so results are shareable and restored on load.

**Decisions made:**

- Filtering is **client-side**: dataset is small (student-city scale, ≤100 items); matches the established `map.astro` pattern. Server-side filtering is straightforward to add later if the dataset grows past ~500 items or SEO on filtered URLs becomes a requirement.
- Date filter options for events: "All upcoming" / "7 days" / "31 days" — mirrors the map page time filter.
- Homepage widgets are **not** affected by filters — they show a curated preview only.
- Full-text search is **deferred** — out of scope for P6.
- Jobs filter UI uses a collapsible `<details>` panel for mobile; events filter uses an inline bar (fewer controls).

**Work involved:**

- [x] `fetchEvents()` fixed to exclude past events by default (`end >= now` filter added to Strapi query)
- [x] `/events`: category button bar (All + 6 categories) + date range select (All upcoming / 7 days / 31 days); `?category` and `?date` URL params
- [x] `/jobs`: collapsible `<details>` filter panel with job type buttons (All + 7 types) and field buttons (All + 8 fields); `?type` and `?field` URL params; badge shows count of active filters; panel auto-opens when URL params are present
- [x] Active filter badge in jobs panel `<summary>` shows count of active filters; panel auto-opens when arriving via a filtered URL
- [x] Empty-state messages shown when no items match the active filter combination
- [x] i18n keys added for all filter UI labels in `de` and `en` locales
- [x] `JOB_TYPES`, `JOB_FIELDS`, `EVENT_CATEGORIES` and their types exported from the API barrel (`utils/api/index.ts`)

**Still to do / not in scope:**

- Filter by organizer/group on `/events`
- Filter by working hours range or remote/on-site/hybrid on `/jobs`
- Full-text search bar on either page

---

### P4 Interdependencies (events <-> locations)

Events now have a structured connection to physical locations.

**Decisions made:**

- Events can link to a map location (manyToOne relation to `Location`) OR have a free-text `custom_location` component (name, address, city) as a fallback
- Events without a linked map location do not appear on the map
- All upcoming events (end ≥ now) with a linked location are shown in the location popup on the map page
- Location markers show a red badge with the count of upcoming events

**Work involved:**

- [x] Added `map_location` (manyToOne → `api::location.location`) and `custom_location` (component `events.event-location`) to the `Event` schema
- [x] Added `events` (oneToMany, mappedBy `map_location`) to the `Location` schema
- [x] Created `api/src/components/events/event-location.json` component with `name`, `address`, `city` fields
- [x] Updated seed data: locations are seeded first; 7 of 10 seed events are linked to map locations, 3 have custom locations
- [x] Extended `Event` type and `fetchEvent` to populate `map_location` (with address) and `custom_location`
- [x] Added `fetchUpcomingMapEvents` for the map page (fetches future events where `end ≥ now` and `map_location` is set)
- [x] Updated event create/update Astro Actions to accept `location_type` (none/linked/custom) + associated fields
- [x] Added location section to event create and edit forms via shared `EventForm.astro` component (radio toggle + location select or free-text fields)
- [x] Created `EventLocation.astro` component for location card display (map pin, name, address, "View on map" link)
- [x] Event detail page sidebar shows location card with name, address, and "View on map" link
- [x] Map page fetches upcoming events and displays them in location popups; markers show event count badge

---

### P5 Categories for Events, Jobs

Events and job offers currently have no category or tag system, making it hard for users to find relevant content. Adding categories would improve discoverability.

**Decisions made:**

- Data model: enum fields directly on each content type (no separate `Category` collection)
- Jobs use two orthogonal fields: `job_type` (what kind of engagement) and `field` (industry/domain)
- Categories are admin-curated fixed enums — simpler to filter on, no free-text tagging
- Events and jobs have separate taxonomies (different concepts apply)
- Mensa meal categories (vegan/vegetarian) remain separate — unrelated system

**Job `job_type` enum:** `part_time`, `internship`, `working_student`, `research_assistant`, `thesis`, `volunteer`, `other`

**Job `field` enum:** `it`, `marketing`, `administration`, `research`, `gastronomy`, `retail`, `education`, `other`

**Work involved:**

- [x] Add `job_type` and `field` enum fields to `JobOffer` schema (`api/src/api/job-offer/content-types/job-offer/schema.json`)
- [x] Update job seed data with realistic `job_type` and `field` values (`api/src/seed/job-offers.ts`)
- [x] Add `category` enum field to `Event` schema: `university`, `sport`, `party`, `culture`, `social`, `other`
- [x] Update job creation/editing forms to include `job_type` and `field` selectors (`frontend/src/pages/job/new.astro`, `edit.astro`)
- [x] Update event creation/editing form to include `category` selector (`frontend/src/pages/event/new.astro`, `edit.astro`)
- [x] Display `job_type` badge on job cards and both `job_type`+`field` on job detail; `category` badge on event cards and detail
- [x] Add i18n keys for all enum values in both `de` and `en` locales (`frontend/src/i18n/translations.ts`)
- [ ] Expose `job_type`, `field`, and event category as filterable fields in API queries (prerequisite for P6)

**Open questions:** none

---

### P10 Testing

**Current state:**

- **API (Strapi):** Jest + Babel configured; `mensaplan.test.ts` is the only test file. The test runner is invoked with `yarn test` inside `api/`.
- **Frontend (Astro):** Vitest configured (`vitest.config.ts`, `yarn test`). 142 tests across 13 files covering all API utility modules, pure utility functions, and key Astro components.

**Done:**

- [x] Vitest setup in `frontend/` — `vitest.config.ts`, `yarn test` / `yarn test:watch` scripts
- [x] Unit tests for all frontend API utility modules (`events`, `job-offers`, `mensa`, `locations`, `student-groups`, `index`): query parameters, pagination limits, populate shapes, request bodies, auth headers, URL encoding, error fallbacks, and `console.error` messages
- [x] Unit tests for pure utility modules: `event-formatting` (`formatDateTime`, `formatTime`), `mensa` (`getRelevantDay`, `groupMealsByDay`), `job-status` (`JOB_STATUS_ALERT_CLASS`, `JOB_STATUS_BADGE_CLASS`)
- [x] Component tests using `experimental_AstroContainer`: `MensaLocationCard`, `MensaMealItem`, `MensaDaySection`, `ReportModal` — rendered HTML checked for correct output, edge cases (empty meals, allergens, vegan/vegetarian badges, hidden form inputs)

- [x] End-to-end tests with Playwright in `frontend/tests/e2e/`: `public-pages.spec.ts`, `auth.spec.ts`, `account.spec.ts`, `events.spec.ts`, `jobs.spec.ts`, `reports.spec.ts` — run against a full Docker Compose stack with a seeded database (`SEED=true docker-compose up`). Auth state is saved once via `auth.setup.ts` and reused by authenticated specs. Run with `yarn test:e2e` inside `frontend/`.

**Still to do:**

- **API unit tests** — extend the existing Jest suite as new Strapi services are written. Priorities: any importers added under P7, the `Report` submission logic from P3, and any custom validation or lifecycle hooks.
- **CI integration** — add a GitHub Actions workflow that runs `yarn test` in both `api/` and `frontend/` on every pull request. E2E tests can run on a slower schedule (nightly or on merge to main) using `docker-compose` to spin up the full stack.

**Open questions:** none

---

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

