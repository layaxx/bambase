# 3. Sitemap is an SSR endpoint, not `@astrojs/sitemap`

- Status: Accepted
- Source: `src/pages/sitemap.xml.ts`

## Context

`@astrojs/sitemap` generates the sitemap at build time. It needs a fixed `site` URL, and it can't know about events and jobs that are created after the build.

## Decision

`GET /sitemap.xml` is rendered on every request:

- Static public paths are hardcoded in `STATIC_PATHS`.
- Event and job URLs are queried live (published only).
- The origin comes from the request (`url.origin`), not from config.
- Auth-only routes are omitted. They are also `Disallow`ed in `public/robots.txt`.
- `Cache-Control: public, max-age=600, stale-while-revalidate=3600`.
- If the DB query fails, the sitemap falls back to static paths only.

## Consequences

- A new public static page has to be added to `STATIC_PATHS` by hand.
- A new auth-only or utility page should get a matching `robots.txt` `Disallow` entry.
