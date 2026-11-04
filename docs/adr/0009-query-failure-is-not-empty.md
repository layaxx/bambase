# 9. A failed data query is shown as an error, never as an empty result

- Status: Accepted
- Source: `src/utils/api/`, `src/pages/500.astro`

## Context

Read helpers used to swallow errors and return `[]` or `null`. When the backend failed, pages said "no events found" or "not found". That was wrong, and it hid outages.

An `ApiResult` wrapper with an "unavailable" banner later let each page and homepage card degrade on its own. It dates from the remote API. With the in-app backend (ADR 1), every page, the login and the session lookup use the same database, so a partially rendered page has little left to show.

## Decision

- Read helpers in `src/utils/api/` don't catch query errors. They return the data or throw.
- An unhandled SSR exception renders `src/pages/500.astro`.
- Queries run in the page frontmatter and the page passes the data to its components. A component renders while the response already streams, so a query error there would cut the page off and not render the 500 page.
- The map page's browser-side fetch of `/api/locations.json` shows the "unavailable" message when that request fails.

## Consequences

- An empty state or "not found" always means the query succeeded.
- One failing query fails the whole page, homepage cards included.
