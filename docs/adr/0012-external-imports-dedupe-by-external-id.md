# 12. External imports are idempotent via `externalId`

- Status: Accepted
- Source: `src/utils/job-offer-sync.ts`, `src/utils/event-sync.ts`

## Context

Jobs are imported from the feki.de Drupal job board, and events from UnivIS. Imports run repeatedly (cron and on startup), so they must not create duplicates.

## Decision

- Imported rows set the unique `externalId` column (`Event.externalId`, `JobOffer.externalId`). Event IDs carry a source prefix.
- Each run loads all existing external IDs in **one query** into a `Set`/`Map`. No per-item lookups (N+1).
  - Jobs (feki): known IDs are **skipped**. Once imported, a job is owned locally.
  - Events (UnivIS): known upcoming events are **updated** from the source, and upcoming events that vanished upstream are **deleted**. Events a moderator set to `hidden` are left alone in both cases.
- Imported descriptions are stored as plain text, never as HTML. For example, feki HTML goes through tag stripping plus `he` entity decoding.
- Imports run as registered cron jobs. They can also run on startup, toggled by `LOAD_*_ON_STARTUP` env vars, and each run is recorded in `CronJobRun` (`/admin/cron`).

## Consequences

- Local edits to an imported event are overwritten by the next sync. To suppress an event, hide it rather than edit or delete it (a deleted event is re-created on the next run).
- Upstream edits to an imported job are not picked up.
- A new data source should follow the same pattern with its own `externalId` prefix.
