# 9. A failed data query is shown as "unavailable", never as an empty result

- Status: Accepted
- Source: `src/utils/api/types.ts`, `src/components/ApiDownBanner.astro`, `src/pages/500.astro`

## Context

Read helpers used to swallow errors and return `[]` or `null`. When the backend failed, pages said "no events found" or "not found". That was wrong, and it hid outages.

## Decision

- Read helpers in `src/utils/api/` return `ApiResult<T> = { data: T; apiDown: boolean }`, built with `apiResult(label, fallback, load)`. That function logs the error and returns the fallback with `apiDown: true`.
- Pages and homepage cards render `<ApiDownBanner />` when `apiDown` is true. Detail pages tell "unavailable" apart from "not found".
- Each homepage card fetches its own data and degrades on its own.
- Unhandled SSR exceptions render `src/pages/500.astro`.
- Non-UI consumers (sitemap, OG images, account lists) may ignore `apiDown` and degrade to the fallback.

## Consequences

- New read helpers should return `ApiResult` through `apiResult()`, and their callers must handle `apiDown`.
- An empty state is only correct when `apiDown` is false.
