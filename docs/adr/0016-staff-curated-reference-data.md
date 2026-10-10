# 16. Map locations and student groups are staff-curated

- Status: Accepted
- Source: `location:manage` and `studentGroup:manage` permissions, `/admin/locations`, `/admin/student-groups`

## Context

Both used to be hardcoded JSON files. Moving them into the DB raised the question of whether users or groups should edit their own entries.

## Decision

Only staff with the `location:manage` / `studentGroup:manage` permissions can create and edit locations and student groups. There is no user submission, self-registration or claiming of groups, so no review workflow is needed.

## Consequences

- Unlike events and jobs, these models have no owner or moderation status.
- Group self-management would need owner/claim handling plus some way to verify who represents a group. Both are deliberately left out for now.
