# BamBase.de Roadmap

## Upcoming

### P20 Registration Workflow and E-Mail Confirmation

Currently, registration is instant and unverified: anyone can register with any email address and is immediately logged in. This undermines content moderation — there is no way to hold a submitter accountable to a real address, and fake accounts require no effort to create.

Strapi ships a built-in email confirmation flow (`users-permissions` plugin, `emailConfirmation: true`) but it is not enabled. When enabled, newly registered users get `confirmed: false` and receive a verification email; until confirmed, they can log in but Strapi will reject their API calls. The frontend would need to handle the confirmation callback URL (`/confirm?confirmation=TOKEN`) and show a "check your inbox" state after registration instead of redirecting immediately.

SMTP must be configured before this can work — currently the API has no email provider set up.

### P18 Job Overview Page

Evaluation and optional migration of `/jobs` from client-side to server-side filtering. The current approach works at small scale but couples page weight to dataset size in a way that degrades once job descriptions are long and numerous.

**Current architecture:**

- `fetchJobOffers(limit=100)` (`utils/api/job-offers.ts:56`) fetches all published jobs and passes them to `jobs.astro` at SSR time.
- All jobs are rendered to HTML as `JobOfferCard` components inside `[data-type]`/`[data-field]`/`[data-work-mode]` wrapper `div`s.
- The client-side script (`jobs.astro:149–234`) reads URL params, then sets `display: none` on non-matching cards. Result counts and filter state are kept in DOM.
- Full-text search runs against a `data-search` attribute on each wrapper that concatenates `title + company`.

**Why it works now:** The catalog is small (under 30 published offers at launch). All data fits comfortably in a single Strapi query and the rendered HTML is under 50 KB.

**Why it will degrade:** Job descriptions in the seed data are 3–6 sentences; real postings from employers routinely run 300–800 words. At 50 published offers × 400 words average, the `p.mb-3.line-clamp-2` element alone adds ~100 KB of unrendered text to the DOM (the text is present in the DOM even though CSS clips its visible height). The `data-search` attribute doubles the title+company string. Full initial parse and layout of 150 hidden cards is measurable on mid-range phones.

**Server-side filtering approach:**

The filter state is already in URL query params (`?type=internship&field=it&work_mode=remote&search=python`) thanks to the P6/P12 work. Moving to server-side means:

1. Read params in `jobs.astro` frontmatter (`Astro.url.searchParams`).
2. Forward them to Strapi as query filters: `{ job_type: { $eq: type }, field: { $eq: field }, work_mode: { $eq: workMode } }` plus a `_q` full-text param for the search term (Strapi supports this on string fields).
3. Render only the matching jobs. Remove the client-side filter script entirely.
4. Replace `<select onChange>` / `<input onInput>` with a `<form method="get">` that submits naturally — or keep the JS but have it navigate to the new URL instead of toggling `display`.

The main tradeoff is UX: client-side filtering is instant (no round-trip); server-side filtering causes a full page navigation per filter change. A hybrid — server-side initial render, plus client-side JS that patches the URL and uses `fetch` to re-render the list fragment — is possible but significantly more complex.

**Threshold for migration:**

The existing client-side approach is acceptable up to approximately 50 published offers with typical description lengths. Above that, page weight and DOM size become measurable. The P16 roadmap sets a general threshold of ~300 items for events/jobs; for jobs specifically, description length makes 50 the practical trigger.

**Work involved:**

- [ ] Benchmark the `/jobs` page at current catalog size: measure HTML payload size and Lighthouse performance score as a baseline
- [ ] Decide: pure server-side (form submit) vs. hybrid (JS fetch + partial render) vs. keeping client-side with a stricter `fields` projection to reduce payload (drop `description` from the list response and expand on detail page only)
- [ ] If server-side: extend `fetchJobOffers` to accept `{ type?, field?, workMode?, search? }` filter params and forward them to Strapi; add `_q` full-text search support
- [ ] If server-side: update `jobs.astro` frontmatter to read `Astro.url.searchParams` and pass them to `fetchJobOffers`; replace the filter `<select>` elements with a `<form method="get">` or add JS that navigates instead of hiding
- [ ] If client-side retained: add `fields` projection to `fetchJobOffers` to exclude `description` from the list query (description is already line-clamped and only useful on the detail page), reducing payload by ~60%
- [ ] Update result-count and empty-state logic to work without client-side DOM counting when filtering moves server-side

**Open questions:**

- Is full-text search (`search=...`) a requirement for server-side mode? Strapi's `_q` param does a substring match across all string fields, which is less precise than the current `title + company` scope. Scoping to specific fields requires a `$or` filter.
- Should the filter panel remain a `<details>` collapse, or become always-visible now that it causes a page load? A persistent filter bar (as on `/events`) is more discoverable.
- If the page moves to server-side rendering with URL navigation, should the URL format change (e.g. `/jobs?type=internship` instead of the current JS-managed param format)? The current param keys (`type`, `field`, `work_mode`, `search`) are clean and can be kept as-is.
- At what point should pagination be introduced alongside server-side filtering? 50 results per page is a natural default; the Strapi client already supports `pagination.page` and `pagination.pageSize`.

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

## Done

### P21 SEO Plugin

Added structured, per-page SEO metadata using `astro-seo`. The `<SEO>` component replaces the bare `<title>` tag in `Layout.astro` and handles `<meta name="description">`, Open Graph, Twitter Card, and canonical URL in one place. `description?` and `ogImage?` props were threaded through the full layout chain (`Layout` → `AppLayout` → `PageLayout`) so any page can override them.

Every page now has a title and description: static pages use translation keys; event and job detail pages use the entity title with a truncated description (first ~155 chars for events; company + ~120 chars of description for jobs). All pages set a canonical URL via `Astro.url.href`. The `<html lang>` attribute was already present via `Astro.locals.locale`. A 1200×630 static fallback OG image (`public/og-image.png`) was created and set as the default `og:image`; detail pages override this with generated images via P22. `public/robots.txt` disallows `/account/`, `/login/`, `/register/`, `/api/`, `/job/new`, and `/event/new`. Sitemap was handled by P19. `hreflang` alternates are not applicable since locale is cookie-based with no URL prefixes.

**Work involved:**

- [x] Install `astro-seo`; add `description?: string` and `ogImage?: string` props to `Layout.astro`, `AppLayout.astro`, `PageLayout.astro`; replace the bare `<title>` with `<SEO>` in `Layout.astro`
- [x] `lang` attribute already present on `<html>` as `lang={Astro.locals.locale}`
- [x] Add `impressum.pageSubtitle` and `privacyPolicy.pageSubtitle` translation keys; wire `pageSubtitle` keys as descriptions through all static pages
- [x] Wire dynamic descriptions for `event/[slug]` (truncate `event.description`) and `job/[uuid]` (company + truncated description)
- [x] Create static fallback OG image (`public/og-image.png`, 1200×630); set as default `og:image` in `Layout.astro`
- [x] Add `public/robots.txt` — allow public routes, disallow `/account/`, `/login/`, `/register/`, `/api/`, `/job/new`, `/event/new`
- [x] Sitemap — handled by P19's SSR endpoint; no `@astrojs/sitemap` needed
- [x] `hreflang` alternates — not applicable; locale is cookie-based, both `de` and `en` share the same URLs

---

### P22 Dynamic OG Images

Two SSR endpoints generate per-page Open Graph images for event and job detail pages. The P21 work wired `og:image` to a static fallback for all pages; P22 replaces that fallback on the two detail page types with a generated 1200×630 card showing entity-specific content (title, date/company, category badge).

Endpoints are at `src/pages/api/og/event/[slug].png.ts` and `src/pages/api/og/job/[uuid].png.ts`. Both use `satori` to render a JSX-like element tree to SVG and `@resvg/resvg-js` to convert to PNG. Rendering and card-layout logic is extracted into `src/utils/opengraph/render.ts` and `src/utils/opengraph/imageContent.ts`. Inter (from `@fontsource/inter`) is loaded at module scope via `fs.readFile` and cached for the process lifetime. On a missing or non-published entity, the endpoint issues a 302 redirect to the static `/og-image.png` fallback rather than returning 404.

Card design is shared across both types: dark gradient background, `BamBase – {Category}` header, large truncated title (60-char cap, font size scales down at 45+ chars), subtitle row (date + category badge for events; company + job-type badge for jobs), `bambase.de` wordmark footer. Response carries `Cache-Control: public, max-age=86400`.

**Work involved:**

- [x] Install `satori` and `@resvg/resvg-js`
- [x] Add `ogImage?: string` prop to `Layout.astro`, `AppLayout.astro`, `PageLayout.astro`; forward it into the `openGraph.basic.image` field of `<SEO>`
- [x] Create `src/pages/api/og/event/[slug].png.ts` and `src/pages/api/og/job/[uuid].png.ts` — fetch entity, render Satori card, return PNG with `Cache-Control: public, max-age=86400`; redirect to `/og-image.png` fallback when entity is missing or non-published
- [x] Extract shared rendering logic into `src/utils/opengraph/render.ts` (font loading + Satori→PNG pipeline) and `src/utils/opengraph/imageContent.ts` (card layout tree, `makeEventSubtitleItems`, `makeJobOfferSubtitleItems`)
- [x] Wire `ogImage` in `event/[slug]/index.astro` and `job/[uuid]/index.astro`
- [x] Bundle Inter font (regular + bold) from `@fontsource/inter` package files, loaded via `fs.readFile` and cached in module scope
- [x] E2E tests in `tests/e2e/og-images.spec.ts` — valid event/job returns 200 PNG with correct headers; missing slug/UUID and non-published job redirect to fallback

---

### P19 Sitemap

A `GET /sitemap.xml` SSR endpoint (`src/pages/sitemap.xml.ts`) returns a machine-readable sitemap for all public pages. Static paths (`/`, `/events`, `/jobs`, `/map`, `/mensa`, `/about`, `/impressum`, `/privacy`) are hardcoded; dynamic paths are fetched from Strapi at request time. Authentication-required routes (`/account`, `/login`, `/register`, `/job/new`, `/event/new`, edit pages) are omitted.

Since the site runs fully SSR, a custom endpoint was chosen over `@astrojs/sitemap`: it reflects the current published state on every request without requiring Strapi access at build time or a hardcoded `site` URL. The origin is derived from `url.origin` in the request context.

Added `fetchAllPublishedEventSlugs()` to `utils/api/events.ts` — a minimal query (`fields: ["slug"]`, no date filter) that returns past and future published event slugs. `fetchJobOffers(500)` is reused for jobs since it already filters to `online_status: 'published'`. Both calls run in parallel via `Promise.all`; either returning `[]` on error, so the sitemap degrades gracefully to static-only if Strapi is unreachable.

Response includes `Cache-Control: public, max-age=600, stale-while-revalidate=3600`.

---

### P20 A11Y Rules

Enabled `eslint-plugin-jsx-a11y` via the Astro-aware wrappers in `eslint-plugin-astro` (`flat/jsx-a11y-recommended` config). Rules run through Astro's parser so they understand `.astro` files correctly. Targets WCAG 2.1 AA, consistent with the P14 compliance work. Fixed the three violations the new rules surfaced: two placeholder `<a href="#">` elements in `Sidebar.astro` converted to `<span>`, and the student group name link in `StudentGroup.astro` updated to use `group.website` when present (falls back to plain text).

### P14 Accessibility

Audit-driven pass to reach WCAG 2.1 AA compliance across all pages and components.

**Work involved:**

- [x] Added skip link as the first child of `AppLayout.astro` (`<a class="sr-only focus:not-sr-only …" href="#main-content">Zum Inhalt springen</a>`); added `id="main-content"` to the `<main>` in `login.astro` and `register.astro` (which use `AppLayout` directly)
- [x] Added `<h1 class="sr-only">` to `index.astro` — reuses `t.footer.tagline` so there is no text duplication
- [x] Made `<title>` dynamic: `title?: string` prop added to `Layout.astro`, `AppLayout.astro`, `PageLayout.astro`; rendered as `{title} – BamBase.de` with `"BamBase.de"` fallback; wired up from every page using existing translation keys; detail pages use the entity's own name with a page-title fallback
- [x] Wrapped location type radio buttons in `EventForm.astro` with `<fieldset>` / `<legend>` (browser fieldset defaults reset via `border-0 p-0 m-0 min-w-0`)
- [x] Added `aria-expanded="false"` to "Mehr anzeigen" button in `StudentGroup.astro`; toggled in the click handler
- [x] Added `aria-labelledby="reportModalTitle"` to `<dialog>` in `ReportModal.astro`; added `id="reportModalTitle"` to its `<h3>`
- [x] Replaced backdrop `<button>close</button>` in `ReportModal.astro` with `<button aria-label="Schließen"></button>`
- [x] Added `aria-live="polite"` to the result-count `<p>` in `events.astro` and `jobs.astro`
- [x] Added `@media (prefers-reduced-motion: reduce)` override to `global.css`
- [x] Raised `text-base-content/40` to `text-base-content/70` on readable text in `map.astro` (filter label, location description, address); `/70` is both contrast-compliant and consistent with the P13 two-opacity convention

**Decisions made:**

- Home page `<h1>` is screen-reader-only (not a visible hero tagline); the existing footer tagline text is reused so the copy stays in sync.
- Target conformance level: WCAG 2.1 AA (legal baseline for German public websites under BITV 2.0).
- Contrast fix on `map.astro` used `/70` rather than `/60` to stay within the P13-enforced two-opacity rule (`/70` secondary, `/40` muted).

---

### P17 Style Adjustments

Visual polish pass on the homepage section cards and the sub-page headers. No new features — the goal was consistency and clarity.

**Work involved:**

- [x] Revise the `/events` subtitle in both `de` and `en` locales (`translations.ts` keys `events.pageSubtitle`) to avoid the German/English tautology
- [x] Rename the `/map` page title in both locales from `"Karte"`/`"Map"` to `"Campuskarte"`/`"Campus Map"`; also updated `nav.infomap`, `map.cardTitle`, and `map.showMap` for consistency
- [x] Add `shrink-0` to the `h-10 w-10` icon container `div` in each section card: `EventsTodayCard.astro`, `MensaCard.astro`, `JobCard.astro`, `InfomapCard.astro`, `StudentGroupsCard.astro`
- [x] Add a `JOB_TYPE_BADGE_CLASS` map in `utils/job-status.ts` that maps each `job_type` to a DaisyUI badge modifier; use it in `JobOfferCard.astro`

**Decisions made:**

- `/events` subtitle revised to describe the content ("Konzerte, Partys, Sport und mehr – von der Uni bis in die Stadt." / "Concerts, parties, sports and more – from campus to the city.") rather than repeat the page category.
- Map title changed to `"Campuskarte"` / `"Campus Map"` everywhere: `<title>` tag, `PageHeader`, `InfomapCard` link text, and nav item — all updated for consistency via the shared `map.*` and `nav.infomap` translation keys.
- Homepage section icons now use five distinct DaisyUI semantic colors: `error` (events), `warning` (mensa), `success` (jobs), `info` (map), `secondary` (groups). Events was changed from `info` to `error` to eliminate the duplicate blue shared with the map card.
- Job type badge colors use DaisyUI's semantic badge classes directly (`badge-primary`, `badge-secondary`, etc.) — no CSS variables needed. The `field` badge stays unstyled (`badge-ghost`) to avoid two colored badges per card.

---

### P8 About us page

There is currently no page explaining what BamBase.de is, who runs it, or how to contribute or contact the team.

**Work involved:**

- [x] Design and implement a `/about` page in Astro
- [x] Write content: project mission, contributing (submit events/jobs, reach out for student group listings), open source / GitHub link, legal pointer to `/impressum`
- [x] Link the page from the main navigation and footer
- [x] Translate `/about` and `/impressum` into both `de` and `en` via `translations.ts`

**Decisions made:**

- No individual names listed — the page directs users to the GitHub repository for issues, feature requests, and contributions.
- Contact is via GitHub Issues; no contact email or form.
- Student groups are directed to reach out to the team (no self-service yet — out of scope).
- `/impressum` page created (placeholder operator info, pending real details); translated into English as "Legal Notice" with a note that the legal citations (§ 5 TMG, § 55 Abs. 2 RStV) remain in German as they reference German law.

---

### P13 Design & Layout

Cleanup of layout structure, navigation, footer, and visual inconsistencies across all non-homepage pages. No new features — the goal is consistency and polish.

**Work involved:**

- [x] Migrate `account.astro` to use `PageLayout`; unify heading style with other account sub-pages (`text-3xl font-bold tracking-tight sm:text-4xl`)
- [x] Replace `PageLayout.astro` inline style with `max-w-7xl mx-auto px-4 py-8`
- [x] Move Header logo `font-family` to a CSS class in `global.css` (`.logo-font`)
- [x] Align desktop and mobile login button appearance in `Header.astro` (both now `btn-neutral`)
- [x] Standardize back-navigation button class (`btn-ghost btn-sm gap-1 pl-0` everywhere)
- [x] Expand footer: site name + tagline, Contact / About / Impressum links; removed broken back-to-top; added placeholder pages for `/contact`, `/about`, `/impressum`
- [x] Reduce text opacity levels to two: `/70` (secondary) and `/40` (muted); enforced via custom ESLint rule (`no-banned-opacity`)
- [x] Extract Leaflet popup inline styles to CSS classes in `global.css`; hardcoded colors moved to CSS custom properties (`--popup-*`)
- [x] Replace inline webkit line-clamp in `StudentGroup.astro` with `line-clamp-4`

**Decisions made:**

- Header is now sticky (`sticky top-0 z-50`) with `bg-base-100/95 backdrop-blur` for a frosted-glass effect; utility controls (GitHub, language, theme) are visually grouped with a separator from the account/login button.
- Back-to-top link was removed rather than fixed — the footer now serves as a navigation anchor instead.
- Section icon backgrounds (`bg-info/20`, `bg-success/20`, `bg-warning/20`) are intentional per-section theming; documented here as deliberate so future cards follow the same assignment.
- Account section keeps its narrower feel through `PageLayout` (which applies `max-w-7xl`) — no special-casing needed.

---

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
