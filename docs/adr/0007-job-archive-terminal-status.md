# 7. "Archived" is a terminal job status, hidden from the public

- Status: Accepted
- Source: `src/actions/jobs.ts` (`archive`), `JobOnlineStatus` enum

## Context

Owners need a way to mark a position as filled. Deleting loses the record. Waiting for expiry wrongly suggests the posting timed out.

## Decision

- `archived` is a value of `JobOnlineStatus`, next to `submitted`, `published`, `expired` and `rejected`.
- Only the **owner** can set it, via the `jobs.archive` action. `assertOwnerOrPermission` is called without a permission check, so moderators can't archive. This is the only status an owner sets directly. Publishing and rejecting are moderator-only (`jobs.approve` / `jobs.reject`).
- It is **terminal**: there is no un-archive action. If the owner wants the job online again, they submit a new offer.
- Archived jobs are not public. Public queries select only `published`. A non-published detail page is visible only to the owner and job moderators (`fetchJobOffer`). There is no "position filled" banner and no notification to anyone.

## Consequences

- Public job queries must keep filtering on `onlineStatus: "published"` and not exclude statuses one by one. Otherwise a new status could leak.
- Editing an archived offer keeps its status. Only edits of `published`/`rejected` offers reset moderation (`MODERATED_STATUSES`).
- Terminal is enforced only by the UI: the moderation queue lists only `submitted` offers, but `approve`/`reject` don't check the previous status. A crafted request from a moderator could still publish an archived offer.
