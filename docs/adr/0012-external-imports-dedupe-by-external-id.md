# 12. External imports are idempotent via `externalId`

- Status: Accepted
- Source: `src/utils/event-sync.ts`

## Context

Events are imported from UnivIS. (Jobs were once imported from the feki.de Drupal job board. That one-off migration import was removed after the old site went offline; `JobOffer.externalId` still marks the migrated rows.) Imports run repeatedly (cron and on startup), so they must not create duplicates.

## Decision

- Imported rows set the unique `externalId` column (`Event.externalId`). IDs carry a source prefix.
- Each run loads all existing external IDs in **one query** into a `Set`/`Map`. No per-item lookups (N+1).
  - Known upcoming events are **updated** from the source, and upcoming events that vanished upstream are **deleted**. Events a moderator set to `hidden` are left alone in both cases.
- Imported descriptions are stored as plain text, never as HTML.
- Imports run as registered cron jobs. They can also run on startup, toggled by `LOAD_*_ON_STARTUP` env vars, and each run is recorded in `CronJobRun` (`/admin/cron`).

## Consequences

- Local edits to an imported event are overwritten by the next sync. To suppress an event, hide it rather than edit or delete it (a deleted event is re-created on the next run).
- A new data source should follow the same pattern with its own `externalId` prefix.
