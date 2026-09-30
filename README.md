# UniWeaver

A tool collection to administrate university curricula, create competency mappings and semester schedules.

UniWeaver is a monorepo containing one shared backend and four single-page applications that
share a login, a data model and a database. The backend is at the same time the JSON API, the
static host for all four SPAs, and the reverse proxy in front of the OIDC identity provider —
so in production everything is served from a single origin.

---

## Table of Contents

- [Status](#status)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
  - [Docker Compose (recommended)](#docker-compose-recommended)
  - [Local Development](#local-development)
- [Configuration](#configuration)
- [Design System](#design-system)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Testing](#testing)
- [Known Gaps](#known-gaps)
- [License](#license)

---

## Status

Be aware of what is implemented and what is not:

| Component | State |
|---|---|
| OIDC login end-to-end (incl. Dynamic Client Registration) | Implemented |
| Server-side sessions (`iron-session`), shared across all four SPAs | Implemented |
| PostgreSQL schema migrations | Implemented |
| First-administrator bootstrap with rate limiting | Implemented |
| `user_entry` — login + tool portal | Implemented |
| `administration` — curriculum administration, user management | Implemented, but **data currently lives in the browser's `localStorage`**, see [Known Gaps](#known-gaps) |
| `scheduling` — semester schedule generation | **Placeholder** |
| `competencies` — competency mapping | **Placeholder** |

The two placeholder apps render a "not yet implemented" notice. Authentication, the shared
backend and the data model they build on are in place.

---

## Architecture

```
                    ┌──────────────────────────────┐
   browser ────────▶│  backend (Express, :3000)    │
                    │                              │
                    │  /api/*        JSON API      │
                    │  /user_entry   ┐             │
                    │  /administration│  static     │
                    │  /scheduling     │  hosting   │
                    │  /competencies  ┘             │
                    │  /oidc, /interaction  proxy   │
                    └──────┬───────────────┬───────┘
                           │               │
                    ┌──────▼──────┐  ┌─────▼──────────────┐
                    │ PostgreSQL  │  │ docPouch (OIDC)    │
                    │ :5432       │  │ :3030, intern      │
                    └─────────────┘  └────────────────────┘
```

**Session sharing.** All four SPAs are mounted under the same origin and the session cookie is
host-scoped, so a single login at `/user_entry` grants access to all three tools. Each tool's
route guard only calls `api.me()` against the backend.

**OIDC through a same-origin proxy.** The whole OIDC conversation (discovery, authorize, token,
interaction login pages, end-session) is served through the backend under `/oidc`. The provider
advertises endpoints under the UniWeaver origin, so the browser never talks to the provider's
internal hostname directly.

The tools the user picks are plain links to `/administration`, `/scheduling`, `/competencies` —
each app is a separate SPA with its own Vite build, mounted by the backend.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere (ESM) |
| Frontend | Vue 3.5, Vuetify 4, Pinia, Vue Router |
| Build | Vite 8, `vite-plugin-vuetify` with auto-import |
| Icons | `@mdi/font` (Material Design Icons) |
| OIDC client | `oidc-client-ts` |
| Backend | Express 5, `iron-session`, `jose`, `http-proxy-middleware` |
| Database | PostgreSQL 16, `pg` |
| Linting | ESLint 10, `typescript-eslint`, `eslint-plugin-vue` |
| Typecheck | `tsc --noEmit`, `vue-tsc --noEmit` |
| Runtime | Node.js ≥ 22 |

---

## Quick Start

### Docker Compose (recommended)

Requires Docker with the Compose plugin. This is the only setup that satisfies the Node ≥ 22
requirement without touching your host installation.

```bash
git clone https://github.com/BFH-JTF/UniWeaver.git
cd UniWeaver

cp .env.example .env
# Set SESSION_SECRET (>= 32 chars) and BOOTSTRAP_ADMIN_SECRET to your own values:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up -d --build
```

The stack then comes up on <http://localhost:3000>, which redirects to the portal at
`/user_entry`.

| Service | Port | Purpose |
|---|---|---|
| `app` | `3000` | Backend + all four SPAs + OIDC proxy |
| `postgres` | `5432` | Database, data persisted in `./postgres-data` |
| `doc-pouch` | `127.0.0.1:3030` | OIDC identity provider (optional admin access) |

Common commands:

```bash
docker compose up -d --build   # build and start
docker compose logs -f app     # follow backend logs
docker compose down            # stop, keep data
docker compose down -v         # stop and delete all volumes
```

**First login.** docPouch starts empty, so create the first account in its admin UI
(<http://127.0.0.1:3030>) and log in through UniWeaver with it. On a fresh deployment
`GET /api/auth/bootstrap-status` reports `bootstrapRequired: true` — the first account signs in
as a regular user and can then elevate itself to administrator by entering the
`BOOTSTRAP_ADMIN_SECRET` in the portal. This protects against an arbitrary user claiming the
first admin account.

### Local Development

Requires Node.js ≥ 22 and a reachable PostgreSQL. Run the four SPAs in hot-reload mode plus the
backend in watch mode:

```bash
npm ci
cp .env.example .env            # adjust POSTGRES_* to your database

npm run dev                     # backend :3000 + SPAs on :5173-:5176
```

`npm run dev` starts all five processes concurrently (`npm run dev:backend` starts only the
backend). In dev mode each Vite app proxies `/api` to `http://localhost:3000`, and cross-app
links use the dev ports (5173–5176) via `import.meta.env.DEV`.

Other scripts:

```bash
npm run build       # build shared + all four SPAs into dist/
npm start           # run the backend against an existing dist/
npm run typecheck   # tsc + vue-tsc across all workspaces
npm run lint        # ESLint over packages, backend, apps
npm run lint:fix
npm test            # backend API tests (requires PostgreSQL)
```

---

## Configuration

All configuration is environment-based. Copy `.env.example` to `.env`; the backend loads it via
`dotenv`. `.env` is git-ignored.

### Variables actually read by the code

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Backend HTTP port |
| `NODE_ENV` | — | `production` marks the session cookie `secure` and disables the auto-start guard in tests |
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | `uniweaver` | Database name |
| `POSTGRES_USER` | `uniweaver` | Database user |
| `POSTGRES_PASSWORD` | `uniweaver` | Database password |
| `SESSION_SECRET` | — | **Required.** Signs/encrypts the session cookie, ≥ 32 chars |
| `BOOTSTRAP_ADMIN_SECRET` | — | Secret for elevating the first account to administrator |
| `OIDC_ISSUER` | `http://localhost:3000/oidc` | Browser-facing issuer URL |
| `OIDC_INTERNAL_ISSUER` | `http://doc-pouch:3030/oidc` | Upstream URL the backend uses for discovery, JWKS and proxying |
| `OIDC_CLIENT_ID` | *(empty)* | Pin the `aud` claim to a pre-registered client. Empty = the SPA self-registers via dynamic client registration |
| `OIDC_PROVIDER_NAME` | `docPouch` | Display name on the login button |
| `DATABASE_URL` | — | Alternative to the individual `POSTGRES_*` variables for the API helper's base URL |

`OIDC_ISSUER` is what the provider advertises and what the browser uses; `OIDC_INTERNAL_ISSUER`
is only the docker-internal hop. They differ when the provider is reverse-proxied same-origin.

### Variables declared in `.env.example` but not read

`APP_TITLE`, `OIDC_CLIENT_SECRET`, `ADMINISTRATION_URL`, `SCHEDULING_URL` and
`COMPETENCIES_URL` are not referenced anywhere in the source. The tool apps derive their URLs
from `window.location.origin` in production instead. `USER_ENTRY_URL` is read, but only by the
`user_entry` SPA itself as a dev-time override.

### Using an external identity provider

Remove the `doc-pouch` service from `docker-compose.yml` and point `OIDC_ISSUER` /
`OIDC_INTERNAL_ISSUER` at your provider (Keycloak, EduID, …). Any standard OIDC provider works.

---

## Design System

The four SPAs share one design system, aligned with the sibling apps CourseWeaver and TimeWeaver
so the product family looks consistent.

**Theme** (`apps/*/src/plugins/vuetify.ts`, identical in all four apps):

| Token | Value |
|---|---|
| `primary` | `#0B5DBA` (BFH blue) |
| `secondary` | `#15489B` |
| `accent` | `#F2A900` |
| `error` / `success` / `warning` / `info` | `#C62828` / `#2E7D32` / `#EF6C00` / `#0277BD` |
| `surface` / `surface-bright` / `surface-variant` | `#F5F7FA` / `#FFFFFF` / `#E8EEF7` |
| border radius root | `12px` |

A dark theme is defined as well but not enabled by default. Component defaults are centralised
too: cards `lg` with elevation 1, buttons `lg`, text fields and selects `outlined` + `compact`.

**Global styles** (`apps/*/src/styles/app.css`, imported in `main.ts`):

| Class | Purpose |
|---|---|
| `.app-bg` | Page background: two subtle radial gradients plus a vertical light gradient, fixed attachment |
| `.card-lift` | Hover lift (translate + shadow) for cards |
| `.view-hero` | Blue gradient header block used at the top of views |
| `.bar-logo` / `.brand-logo` | Logo sizing in the app bar and navigation drawer |
| scrollbar styling | Thin blue-tinted scrollbars |

**Branding.** `favicon.ico` comes from TimeWeaver's public folder; the logo is UniWeaver's own
`apps/logo.png`. Both are shipped in each app's `public/` directory and referenced base-relatively
(`/Logo.png`, `/favicon.ico`), which Vite rewrites to the app's mount path
(`/user_entry/Logo.png`, …) at build time.

The logo's transparent margins were trimmed (1024×341 → 934×216, lossless) so that the existing
`height: 45px` rule yields the same visual size as in the sibling apps. The original
`apps/logo.png` is left untouched.

---

## API Reference

Twelve endpoints, all of them covering authentication and user management. There are **no**
endpoints for curriculum entities yet.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | `{ status, databaseConnected, timestamp }` |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/config` | — | `{ issuer, clientId, providerName }` for the SPA to configure OIDC |
| `GET` | `/api/auth/probe-client` | — | Validates a client id / redirect URI pair before login |
| `GET` | `/api/auth/bootstrap-status` | — | `{ bootstrapRequired, adminCount }` |
| `POST` | `/api/auth/session` | — | Exchanges a verified ID token for a session cookie. Body: `{ idToken }` |
| `POST` | `/api/auth/bootstrap-admin` | session | Elevates the current user to administrator. Body: `{ secret }` |
| `POST` | `/api/auth/me` | session | Returns the current user profile |
| `POST` | `/api/auth/logout` | — | Clears the session and redirects to the provider's end-session endpoint |

The `/api/auth/session` endpoint is deliberately narrow: the SPA performs the OIDC flow in the
browser, the backend only verifies the ID token (JWKS via `jose`) and creates the local user.

### Users (admin only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/search` | Search users |
| `GET` | `/api/users/:id` | Single user |
| `PATCH` | `/api/users/:id` | Update a user |

---

## Data Model

The full model is documented in [`docs/data_model.md`](docs/data_model.md) as an ER diagram.
The architecture is described in
[`docs/tool_architecture.md`](docs/tool_architecture.md).

Migrations live in `backend/src/migrations/` and are applied automatically on startup in
alphabetical order, each inside a transaction, tracked in the `schema_migrations` table.

| Migration | Contents |
|---|---|
| `001_users.sql` | `local_users` — OIDC-linked local accounts with roles and admin flag |
| `002_curriculum_core.sql` | 17 curriculum tables: departments, programs, degrees, lecturers, locations, rooms, semesters, taxonomy items, competency matrices, matrix competencies, competencies, proofs of competency, curriculum versions, modules, lessons, class entities, weeks, scheduling rules |

---

## Testing

One test file exists, `backend/test/api.test.ts`. It is a hand-written script with its own
`assert()` helper — there is no test framework dependency in the project.

```bash
npm test
```

It starts the backend on a fixed port (3456), so it needs a reachable PostgreSQL and runs the
migrations. It covers the health endpoint, bootstrap status, the auth guards (401 without a
session), ID token validation, logout, and the rate limiter's threshold and reset behaviour.

There are no frontend tests.

---

## Known Gaps

These are worth knowing before relying on the administration app:

1. **Administration data is stored in `localStorage`, not PostgreSQL.** The administration SPA
   calls REST endpoints for curriculum entities that the backend does not implement, and silently
   falls back to browser storage on every failure. Data therefore does not survive a different
   browser and is not shared between users. The schema in migration 002 exists but is not
   populated by the app yet.
2. **`scheduling` and `competencies` are placeholders.**
3. **Table name mismatch.** The frontend's entity table map expects `classes`, while the
   migration creates `class_entities`. `schedule_entries`, `lecturer_availability` and
   `room_availability` have no migration at all.
4. **Dead code in the administration app.** Several form dialogs and composables for rooms,
   weeks, scheduling and competencies are prepared but unused.
5. **Legacy storage keys.** The administration app's localStorage keys still carry
   `courseweaver_*` names from a predecessor project.
6. **`scripts/generate-tool-apps.ts` is outdated and dangerous.** It writes `outDir: 'dist'`,
   but the apps actually build to `dist/apps/<slug>`. Running it would break the production
   mount. It is not wired to any npm script.

---

## License

MIT — see [LICENSE](LICENSE).
