# 1. Backend runs inside the Astro app (Prisma + better-auth)

- Status: Accepted (supersedes the Strapi CMS backend)
- Source: `chore: remove strapi` (3578a4d)

## Context

Originally the site had two apps: a Strapi CMS (`api/`) and an Astro frontend (`frontend/`) that called Strapi over HTTP. So each feature needed changes in both apps. Auth state came from a JWT cookie that the frontend had to check again with Strapi on every request (P29). Authorization rules were split between Strapi controllers, lifecycle hooks and permission JSON files.

## Decision

Remove Strapi. The Astro app (now at the repository root) owns the data:

- **Prisma** (`prisma/schema.prisma`, PostgreSQL via `@prisma/adapter-pg`) for persistence.
- **better-auth** (`src/utils/auth.ts`) for accounts, sessions, email verification, password reset and roles (admin plugin + access control).
- **Astro Actions** (`src/actions/`) for all mutations. Authorization is enforced in the actions with `src/utils/action-guards.ts` and `src/utils/authz.ts`.
- **In-process cron** (`registerCronJob` in `src/middleware.ts`) for imports and expiry. These used to be Strapi services.

The middleware resolves the session once per request into `Astro.locals.user` / `Astro.locals.session`. Pages and actions read from `locals` and never parse auth cookies themselves.

## Consequences

- One deployable, one language and one type system from the DB to the HTML.
- Older commits, issues and docs that mention Strapi controllers, lifecycle hooks, `populate`, `documentId` or `api/` are historical. Don't use them as a guide to the current code.
- There is no CMS admin panel. Moderation and reference data management happen in `/admin/*` pages, gated by better-auth roles.
- Session changes take up to 60 s to take effect because of better-auth's `cookieCache` (`maxAge: 60`).
