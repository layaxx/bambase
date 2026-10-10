# 2. Locale is cookie-based, not URL-based

- Status: Accepted
- Source: `src/middleware.ts`, `src/pages/set-locale.astro`

## Context

The site supports `de` (default) and `en`. Common options are locale-prefixed URLs (`/en/events`) or one set of URLs where the locale comes from request state.

## Decision

Both locales share the same URLs. The middleware picks the locale in this order:

1. A valid `locale` cookie.
2. Otherwise the `Accept-Language` header (sorted by q-value), with `de` as the fallback. The result is written back to the cookie.

`/set-locale` changes the cookie. The active locale is available as `Astro.locals.locale` and is rendered as `<html lang>`.

## Consequences

- No `hreflang` alternates, and the sitemap lists each page once. Search engines mostly index the German version.
- Pages vary by cookie. Any HTTP/CDN caching of HTML must account for this, or it will serve the wrong language.
- Adding a locale means extending `SUPPORTED_LOCALES` and `src/i18n/translations.ts`. No routing changes are needed.
