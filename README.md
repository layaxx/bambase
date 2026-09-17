# BamBase

An open-source campus information portal that aggregates key university resources into a single, accessible interface.

**Features:**

- Campus events calendar
- Job & internship board
- Mensa (canteen) menus with allergen info
- Interactive campus map
- Student groups directory

## Tech Stack

| Layer          | Tech                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Frontend       | [Astro 6](https://astro.build) · TypeScript · Tailwind CSS v4 · DaisyUI v5 · Leaflet                 |
| Backend        | Astro SSR endpoints & actions · [Prisma](https://prisma.io) · [better-auth](https://better-auth.com) |
| Database       | PostgreSQL 16                                                                                        |
| Testing        | Vitest · Playwright (E2E)                                                                            |
| Infrastructure | Docker · GitHub Actions                                                                              |

Frontend and backend are a single Astro application — there is no separate API service.

## Getting Started

### Prerequisites

- Node.js 22+ and [Yarn](https://yarnpkg.com/)
- Docker and Docker Compose (recommended for the local database)

### Setup

**1. Copy the environment file and fill in the values:**

```bash
cp .env.example .env
```

**2. Start a local PostgreSQL database:**

```bash
docker compose -f docker-compose.dev.yml up -d
```

Or point `DATABASE_URL` in `.env` at your own instance.

**3. Install dependencies and run the app:**

```bash
yarn install
npx prisma migrate deploy
yarn dev   # http://localhost:4321
```

On first run, run `npx prisma db seed` to populate the database with sample data.

## Deployment

Deployment configuration lives in a separate repository, **bambase-deploy**. It holds the Docker
Compose stack (app, PostgreSQL, migration job) and pulls the prebuilt image
`ghcr.io/layaxx/bambase-frontend`, which this repository's release workflow publishes on every
`v*` tag. The `Dockerfile` that builds that image stays here, next to the code.

## Project Structure

```
bambase/
├── src/          # Astro pages, components, actions, utils
├── prisma/       # Schema, migrations, seed
├── public/       # Static assets
├── tests/        # Playwright E2E tests (unit tests live beside their sources)
├── .github/      # CI/CD workflows
├── Dockerfile
├── docker-compose.dev.yml   # Local dev database only
├── Makefile      # lint, format, git hook helpers
└── ROADMAP.md    # planned features and architectural decisions
```

## Scripts

| Command             | Description                 |
| ------------------- | --------------------------- |
| `yarn dev`          | Start development server    |
| `yarn build`        | Production build            |
| `yarn test`         | Unit tests                  |
| `yarn test:e2e`     | Playwright end-to-end tests |
| `yarn lint`         | ESLint check                |
| `yarn format:write` | Auto-format with Prettier   |

The Makefile wraps the lint/format scripts with `nvm use`:

```bash
make lint      # lint
make format    # format
```

## Logging

Server-side logging uses [Pino](https://getpino.io) via `src/utils/logger.ts`. It is server-only —
never import it from a client-side `<script>`. The container writes JSON to stdout/stderr and
nothing else: no log files in the image, no shipper.

|               | Development              | Production             |
| ------------- | ------------------------ | ---------------------- |
| Format        | `pino-pretty`, colorised | newline-delimited JSON |
| Default level | `debug`                  | `info`                 |

`LOG_LEVEL` overrides the level (`trace`…`fatal`, or `silent`); an unset, empty or invalid value
falls back to the default, so a typo cannot take the server down. Tests run at `silent`.

In production `console.*` is routed into the logger, so the lines Astro's SSR runtime and Better
Auth write through `console` land in the JSON stream tagged `"source": "console"` instead of as
unparseable ANSI. Those carry a preformatted string that redaction cannot reach inside, so
application code must always log through `getLogger()`.

**Writing logs.** Put dynamic values in fields, keep the message a short lowercase constant, and
pass errors as `err` so Pino serializes type, message and stack:

```ts
import { getLogger } from "@/utils/logger"

getLogger().info({ userId }, "user authenticated")
getLogger().error({ err, orderId }, "failed to create order")
```

Background jobs run outside a request and bind a child of `baseLogger`, e.g.
`baseLogger.child({ job: "event-sync" })`.

**Request IDs.** Middleware gives every request a UUID, returns it as the `X-Request-ID` response
header, and attaches it to every line logged while handling that request — including from services
that never see the request object, because the logger is carried in an `AsyncLocalStorage`. It
writes exactly one access log per request; do not add a second one.

**Sensitive data.** `authorization`, `cookie`, `password`, `token`, `apiKey`, `secret` and the
credential-bearing env vars are redacted at the top level and one level deep (see `REDACTED_PATHS`).
Redaction is a safety net, not a licence: never log whole request objects or bodies. Query strings
stay out of the access log because they carry tokens and email addresses — only `pathname` is logged.

## Contributing

Contributions are welcome. Here's how to get started:

1. **Fork** the repository and create a branch from `main`.
2. **Set up** the project locally using the steps above.
3. **Install git hooks** to enforce formatting before each commit:
   ```bash
   make install-hooks
   ```
4. **Make your changes.** Keep PRs focused — one feature or fix per PR.
5. **Run the full test suite** before opening a PR:
   ```bash
   yarn test && yarn lint
   ```
6. **Open a pull request** against `main`. The CI pipeline will run linting, unit tests, Docker builds, and E2E tests automatically.

### Guidelines

- All code is TypeScript; avoid `any` where possible.
- Formatting is enforced by Prettier (config in `.prettierrc`). Run `yarn format:write` to fix issues.
- New Prisma models belong in `prisma/schema.prisma`; new pages in `src/pages/`.
- Check `ROADMAP.md` for planned work before starting something large — it may already have design notes.

## License

[AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.html) — contributions must be released under the same license.
