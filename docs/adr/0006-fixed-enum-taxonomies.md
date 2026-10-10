# 6. Categories are fixed enums on each model

- Status: Accepted
- Source: `prisma/schema.prisma`

## Context

Events, jobs and map locations need categories for filtering and badges. The options were a separate category table, free-text tags, or enums.

## Decision

Categories are admin-curated **Prisma enums** stored directly on the model. There is no category table and there are no user-defined tags.

- Event: `EventCategory`
- Job: two orthogonal enums, `JobType` (kind of engagement) and `JobField` (domain), plus `WorkMode`
- Location: `LocationCategory`

Each entity type has its own taxonomy. Mensa vegan/vegetarian flags are unrelated and stay booleans.

## Consequences

- Filtering is a simple equality or `in` query, and every value has a translation key.
- Adding or renaming a value requires a Prisma migration and new keys in `translations.ts` for both locales. Badge mappings (e.g. job type → DaisyUI badge class) must be updated too.
- Categories can't carry metadata (icon, color, description) from the DB. That lives in code or CSS (`--cat-*` variables).
