# 4. Per-entity Open Graph images rendered with satori + resvg

- Status: Accepted
- Source: `src/pages/api/og/[type]/[slug].png.ts`, `src/utils/opengraph/`

## Context

Shared links to events and jobs should show a preview card with the entity's own title and metadata, not one generic image.

## Decision

- `astro-seo`'s `<SEO>` in the layout emits title, description, canonical, OG and Twitter tags. Pages pass `title`, `description` and `ogImage` through the layout chain.
- `/api/og/[type]/[slug].png` builds an element tree (`imageContent.ts`), renders it to SVG with `satori` and then to PNG with `@resvg/resvg-js` (`render.ts`).
- Fonts for satori are read from `@fontsource/inter`'s `.woff` files with `fs.readFile` and cached at module scope.
- If the type or slug is unknown, the event is hidden, the job is not published, or rendering fails, the endpoint returns a **302 to `/og-image.png`** (the static fallback) instead of a 404, so crawlers always get an image.
- `Cache-Control: public, max-age=86400`.

## Consequences

- `@fontsource/inter` must remain a direct dependency even though CSS fonts come from the Astro fonts API (ADR 5). Nothing imports it, but the OG renderer reads its files by path.
- satori supports only a subset of CSS (flexbox, no grid). Card layout changes must stay within it.
- OG images can be up to a day stale after an entity is edited.
