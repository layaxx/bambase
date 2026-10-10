# Architecture Decision Records

Decisions that still shape the code. Planned work is tracked in GitHub Issues.

| #    | Decision                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 0001 | [Backend runs inside the Astro app (Prisma + better-auth)](0001-in-app-backend-prisma-better-auth.md) |
| 0002 | [Locale is cookie-based, not URL-based](0002-cookie-based-locale.md)                                  |
| 0003 | [Sitemap is an SSR endpoint](0003-ssr-sitemap-endpoint.md)                                            |
| 0004 | [Per-entity OG images with satori + resvg](0004-dynamic-og-images.md)                                 |
| 0005 | [Web fonts via the Astro fonts API](0005-astro-fonts-api.md)                                          |
| 0006 | [Categories are fixed enums on each model](0006-fixed-enum-taxonomies.md)                             |
| 0007 | ["Archived" is a terminal job status, hidden from the public](0007-job-archive-terminal-status.md)    |
| 0008 | [User-submitted URLs are restricted to http(s)](0008-http-only-user-urls.md)                          |
| 0009 | [A failed query is "unavailable", never empty](0009-query-failure-is-not-empty.md)                    |
| 0010 | [Auth flows don't reveal accounts; email must be verified](0010-auth-anti-enumeration.md)             |
| 0011 | [Anonymous reporting, role-scoped moderation](0011-anonymous-reports-role-scoped-moderation.md)       |
| 0012 | [External imports are idempotent via `externalId`](0012-external-imports-dedupe-by-external-id.md)    |
| 0013 | [Styling: semantic color tokens, two text-opacity levels](0013-styling-conventions.md)                |
| 0014 | [Accessibility baseline: WCAG 2.1 AA](0014-accessibility-baseline.md)                                 |
| 0015 | [Event location: linked or free-text](0015-event-location-linked-or-custom.md)                        |
| 0016 | [Map locations and student groups are staff-curated](0016-staff-curated-reference-data.md)            |

New ADR: copy the shape of an existing one (Status / Source / Context / Decision / Consequences) and use the next number.
