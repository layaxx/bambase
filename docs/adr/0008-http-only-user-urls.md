# 8. User-submitted URLs are restricted to http(s)

- Status: Accepted
- Source: `src/actions/schemas.ts` (`httpUrl`)

## Context

Zod's `z.url()` accepts any parseable URL, `javascript:` included. User-submitted URLs are rendered as `href`s. Astro escapes HTML, but it doesn't strip dangerous schemes, so `javascript:` links ran attacker JS in the site's origin.

## Decision

Every user-supplied URL field must be validated with the shared `httpUrl` schema: `z.url({ protocol: /^https?$/ }).max(2048)`. Don't use bare `z.url()` in action input schemas.

## Consequences

- `mailto:`, `tel:` and other schemes are rejected. If one is needed, add a separate dedicated schema. Don't loosen `httpUrl`.
- Data that bypasses actions (seeds, sync jobs) isn't validated by this schema and must only write values from trusted sources.
