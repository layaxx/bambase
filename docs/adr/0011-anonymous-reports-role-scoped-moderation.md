# 11. Anonymous reporting with role-scoped moderation

- Status: Accepted
- Source: `src/actions/reports.ts`, `src/utils/auth.ts`, `src/utils/authz.ts`

## Context

Visitors need a low-friction way to flag spam, inappropriate or outdated events and jobs. Requiring an account would mean far fewer reports.

## Decision

- `reports.submit` needs **no sign-in**. A report stores a reason enum, optional details, and a nullable FK to either an `Event` or a `JobOffer`. Reports cascade-delete with their target.
- There is no separate report permission. `event:moderate` covers reports on events, and `jobOffer:moderate` covers reports on jobs (roles `eventModerator`, `jobModerator`, `admin`). Moderation (dismiss/reopen) happens in `/admin/reports`.
- Once a target has `REPORT_WARNING_THRESHOLD` (3) or more reports that are not dismissed, its detail page shows a warning to everyone. A single report isn't enough to stigmatize an entry.

## Consequences

- The submit endpoint is open to abuse (spam reports). If that becomes a problem, add rate limiting or a captcha. Don't require login.
- A new reportable type needs a new nullable FK on `Report`, a branch in `targetTypeOf` (`src/actions/reports.ts`) and `canModerateReport`, and a moderator permission.
