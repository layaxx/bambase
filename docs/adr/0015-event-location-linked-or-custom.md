# 15. An event links to a map location or has a free-text location

- Status: Accepted
- Source: `Event` model, `src/actions/events.ts`, `EventForm.astro`

## Context

Many events take place at known campus locations that are already on the map. Others are in the city at places that will never be map entries.

## Decision

An event has one of three location modes, chosen in the form via `location_type`:

- `none`: no location.
- `linked`: `mapLocationId` FK to a `Location` (`onDelete: SetNull`).
- `custom`: free-text `customLocationName` / `Address` / `City` columns.

Only `linked` events appear on the map. Location popups list upcoming linked events (end ≥ now), and markers show a count badge.

## Consequences

- Code that reads an event's location must handle all three modes. The action keeps them mutually exclusive.
- Deleting a map location silently turns its events into location-less events. It does not convert them to custom locations.
