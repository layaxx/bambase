# BamBase

An open-source campus information portal that aggregates key university resources into a single, accessible interface.

**Features:**

- Campus events calendar
- Job & internship board
- Mensa (canteen) menus with allergen info
- Interactive campus map
- Student groups directory

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | [Astro 6](https://astro.build) · TypeScript · Tailwind CSS v4 · DaisyUI v5 · Leaflet |
| Backend | [Strapi 5](https://strapi.io) (headless CMS) · Node.js · TypeScript |
| Database | PostgreSQL 16 |
| Testing | Vitest (frontend) · Jest (API) · Playwright (E2E) |
| Infrastructure | Docker · Docker Compose · GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 22+ and [Yarn](https://yarnpkg.com/)
- Docker and Docker Compose (recommended for the database)

### Setup

**1. Copy the environment file and fill in the values:**

```bash
cp .env.example .env
```

The only required values for local development are the Strapi secrets (any non-empty strings work) and the database credentials if you change them. `STRAPI_TOKEN` is needed for frontend API access and must be generated on first start (see step 3.).

**2. Install dependencies and start the API:**

```bash
cd api
yarn install
yarn dev   # Strapi admin at http://localhost:1337
```

On first run, set `SEED=true` in `.env` to populate the database with sample data.

**3. (First run only) Create a Strapi API token** in the admin panel (`Settings → API Tokens`), paste it into `.env` as `STRAPI_TOKEN`.

**4. Start the Frontend:**

```bash
cd frontend
yarn install
yarn dev   # Frontend at http://localhost:4321
```

### Docker Compose (full stack)

```bash
cp .env.example .env   # edit values
docker-compose up --build
```

## Project Structure

```
bambase/
├── api/          # Strapi 5 backend — content types, controllers, routes
├── frontend/     # Astro frontend — pages, components, API utils
├── .github/      # CI/CD workflows
├── docker-compose.yml
├── Makefile      # lint, format, git hook helpers
└── ROADMAP.md    # planned features and architectural decisions
```

## Scripts

Run from the respective workspace directory (`api/` or `frontend/`):

| Command | Description |
|---|---|
| `yarn dev` | Start development server |
| `yarn build` | Production build |
| `yarn test` | Unit tests |
| `yarn test:e2e` | Playwright end-to-end tests (frontend only) |
| `yarn lint` | ESLint check |
| `yarn format:write` | Auto-format with Prettier |

From the project root:

```bash
make lint      # lint both workspaces
make format    # format both workspaces
```

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
   cd api && yarn test && yarn lint
   cd frontend && yarn test && yarn lint
   ```
6. **Open a pull request** against `main`. The CI pipeline will run linting, unit tests, Docker builds, and E2E tests automatically.

### Guidelines

- All code is TypeScript; avoid `any` where possible.
- Formatting is enforced by Prettier (config in `.prettierrc`). Run `yarn format:write` to fix issues.
- New content types belong in `api/src/api/`; new pages in `frontend/src/pages/`.
- Check `ROADMAP.md` for planned work before starting something large — it may already have design notes.

## License

[AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.html) — contributions must be released under the same license.
