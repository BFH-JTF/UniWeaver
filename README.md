# UniWeaver

A tool collection to administrate university curricula, manage scheduling resources,
maintain lecturer mappings and — in the future — generate semester schedules and
competency mappings.

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
| PostgreSQL schema migrations (14) | Implemented |
| First-administrator bootstrap with rate limiting | Implemented |
| Per-entity access control (read/write/admin ACL) | Implemented |
| Curriculum restrictions with inheritance | Implemented |
| `user_entry` — login + tool portal, bootstrap, lecturer opt-out | Implemented |
| `administration` — curriculum administration (departments, programs, degrees, modules, classes, semesters, curricula), user management, CSV import | Implemented, backed by PostgreSQL |
| `scheduling` — lecturer↔module mapping (list + matrix), rooms & locations (with map picker), room availability, lecturer unavailability | Implemented, backed by PostgreSQL |
| Semester schedule **generation** | **Not implemented** |
| `competencies` — competency mapping | **Placeholder** |

---

## Architecture

```
                    ┌──────────────────────────────────┐
   browser ────────▶│  backend (Express, :3000)        │
                    │                                  │
                    │  /api/*        JSON API          │
                    │  /user_entry   ┐                 │
                    │  /administration│   static       │
                    │  /scheduling     │   hosting     │
                    │  /competencies  ┘                 │
                    │  /oidc, /interaction  proxy       │
                    └──────┬───────────────┬────────────┘
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

**Role model.** Roles are flags on the local user account, checked by dedicated guards on the
backend (`backend/src/auth/middleware.ts`):

| Flag | Meaning |
|---|---|
| `is_admin` | Global administrator |
| `is_user_admin` | Delegated user administration (cannot manage global admins or admin flags) |
| `is_scheduler` | May edit rooms, locations, availabilities and module/lecturer mappings |
| `is_not_lecturer` | Opt-out: every active user account is a lecturer by default |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere (ESM) |
| Frontend | Vue 3.5, Vuetify 4, Pinia, Vue Router |
| Build | Vite 8, `vite-plugin-vuetify` with auto-import |
| Icons | `@mdi/font` (Material Design Icons) |
| Maps | Leaflet (room location picker, scheduling app) |
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
| `scheduler` | `127.0.0.1:8081` | Timefold scheduling service (used by the backend) |
| `postgres` | `5432` | Database, data persisted in `./postgres-data` |
| `doc-pouch` | `127.0.0.1:3030` | OIDC identity provider (optional admin access) |

Both application services default to the published GHCR images
(`ghcr.io/bfh-jtf/uniweaver`, `ghcr.io/bfh-jtf/uniweaver-scheduler`, pinned by the
`UNIWEAVER_TAG` variable, default `sha-893058b` for a specific commit); `--build`
overrides them with locally built images.

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
links use the dev ports (5173–5176) via `import.meta.env.DEV`. `npm run dev:all` additionally
brings up the infrastructure containers (`postgres` and `doc-pouch`) first — see
[`docs/development.md`](docs/development.md) for details, including how login works across
ports in dev mode.

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
| `USER_ENTRY_URL` | `http://localhost:5173` | Dev-time override, read by the `user_entry` SPA itself |
| `SCHEDULER_URL` | `http://scheduler:8081` | Scheduling service used for schedule generation (compose sets it; for local dev: `http://localhost:8081`) |
| `UNIWEAVER_TAG` | `sha-893058b` | Image tag used by the compose `app` and `scheduler` services |

In docker compose, the `app` service uses `OIDC_INTERNAL_ISSUER_DOCKER` (default
`http://doc-pouch:3030/oidc`); on the host, `.env` points at `http://localhost:3030/oidc`.

### Releases and images

The `main` branch is protected: all changes land via reviewed pull requests. When a
merge contains releasable commits (`feat:`, `fix:`, `BREAKING CHANGE:`), the Release
workflow (`.github/workflows/semantic-release.yml`) cuts a semantic version automatically:

1. semantic-release creates the git tag (`vX.Y.Z`) and the GitHub Release via the API.
2. The bumped `package.json` / `package-lock.json` are pushed to the `chore/version-bump`
   branch and a PR `chore(release): vX.Y.Z` is opened against `main` and auto-merged —
   so the repository version follows the release without anyone pushing to `main` directly.
3. The release event triggers the Docker workflow (`.github/workflows/docker-publish.yml`),
   which publishes `ghcr.io/bfh-jtf/uniweaver` and `ghcr.io/bfh-jtf/uniweaver-scheduler`
   with semver and SHA tags.

Merges without releasable commits (docs/chore/refactor) produce no release and no image.

### Variables declared in `.env.example` but not read

`APP_TITLE`, `OIDC_CLIENT_SECRET`, `ADMINISTRATION_URL`, `SCHEDULING_URL` and
`COMPETENCIES_URL` are not referenced anywhere in the source. The tool apps derive their URLs
from `window.location.origin` in production instead.

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

---

## API Reference

All endpoints live under `/api` and return JSON. Every route that touches user data requires a
valid session cookie; role-guarded routes are marked. Entity routes are generic over the
registered curriculum tables (`departments`, `programs`, `degrees`, `modules`, `classes`,
`lecturers`, `semesters`, `curriculums`, `curriculum_versions`); `{table}` below stands for one
of them.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | `{ status, databaseConnected, timestamp }` |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/config` | — | `{ issuer, clientId, providerName, authorizationEndpoint }` for the SPA to configure OIDC |
| `GET` | `/api/auth/probe-client` | — | Validates a client id / redirect URI pair before login |
| `GET` | `/api/auth/bootstrap-status` | — | `{ bootstrapRequired, adminCount }` |
| `POST` | `/api/auth/session` | — | Exchanges a verified ID token for a session cookie. Body: `{ idToken }` |
| `POST` | `/api/auth/bootstrap-admin` | session, rate-limited | Elevates the current user to administrator. Body: `{ secret }` |
| `POST` | `/api/auth/me` | session | Returns the current user profile |
| `POST` | `/api/auth/logout` | — | Clears the session |

The `/api/auth/session` endpoint is deliberately narrow: the SPA performs the OIDC flow in the
browser, the backend only verifies the ID token (JWKS via `jose`) and creates the local user.

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users/search?q=` | session | Search active users (for access-control dialogs) |
| `GET` | `/api/users` | user admin | List all users |
| `PATCH` | `/api/users/me` | session | Self-service: only the own lecturer opt-out flag |
| `GET` | `/api/users/:id` | user admin | Single user |
| `PATCH` | `/api/users/:id` | user admin | Update user; delegated user admins cannot touch global admins or admin flags; last-admin protection |

### Curriculum entities (generic CRUD + access control)

Entities are stored per-table with a per-object access-control list (`entity_access`); the
creator becomes the entity's first admin. Responses include `_isAdmin` / `_canEdit`.
Non-admins only see entities shared with them.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/{table}` | session | List entities (visibility filtered by ACL) |
| `GET` | `/api/{table}/:id` | ACL read | Fetch one entity |
| `POST` | `/api/{table}` | ACL admin over referenced parents | Create entity |
| `PUT` | `/api/{table}/:id` | ACL write | Update entity |
| `DELETE` | `/api/{table}/:id` | ACL admin | Delete entity and its ACL rows |
| `GET` | `/api/{table}/:id/access` | ACL read | List ACL entries |
| `POST` | `/api/{table}/:id/access` | ACL admin | Grant/upsert `{ userId, role }` (read/write/admin) |
| `PUT` | `/api/{table}/:id/access/:userId` | ACL admin | Change role (last-admin protection) |
| `DELETE` | `/api/{table}/:id/access/:userId` | ACL admin | Revoke access (last-admin protection) |
| `POST` | `/api/curriculums` | global admin | Create curriculum with a first version in one transaction |
| `POST` | `/api/curriculums/:id/versions` | global admin | Copy the active version into a new version |

### Restrictions

Scheduling restrictions on curriculum entities, validated against the shared
[restriction catalog](docs/restrictions.md). Restrictions are inherited down the curriculum
hierarchy (department → program → degree → module/class).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/{table}/:id/restrictions` | ACL read | Restrictions directly owned by the entity |
| `GET` | `/api/{table}/:id/restrictions/effective` | ACL read | Restrictions including inherited ones |
| `POST` | `/api/{table}/:id/restrictions` | ACL write | Create restriction (validates rule type + params) |
| `PUT` | `/api/{table}/:id/restrictions/:restrictionId` | ACL write | Update restriction |
| `DELETE` | `/api/{table}/:id/restrictions/:restrictionId` | ACL write | Delete restriction |

### Scheduling (rooms, lecturers, mapping)

Reads are open to every authenticated user; all writes require the scheduler role
(global admin or `is_scheduler`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/scheduling/locations` | List locations |
| `POST` | `/api/scheduling/locations` | Create location |
| `PUT` | `/api/scheduling/locations/:id` | Update location |
| `DELETE` | `/api/scheduling/locations/:id` | Delete location |
| `GET` | `/api/scheduling/rooms` | List rooms with location labels + availability count |
| `POST` | `/api/scheduling/rooms` | Create room |
| `PUT` | `/api/scheduling/rooms/:id` | Update room |
| `DELETE` | `/api/scheduling/rooms/:id` | Delete room |
| `GET` | `/api/scheduling/rooms/:id/availability` | Room availability slots (weekId `null` = all weeks) |
| `PUT` | `/api/scheduling/rooms/:id/availability` | Full replace of availability slots |
| `GET` | `/api/scheduling/lecturers` | List lecturers (auto-provisioned from user accounts) |
| `GET` | `/api/scheduling/lecturers/:id/unavailability` | List unavailability entries (`:id` may be `me`) |
| `PUT` | `/api/scheduling/lecturers/:id/unavailability` | Full replace of unavailability entries (self or scheduler) |
| `GET` | `/api/scheduling/mapping` | Bulk load: lecturers, departments, programs, degrees, modules, versions, all module/lecturer pairs |
| `POST` | `/api/scheduling/mapping/pairs` | Apply a lecturer↔module assignment diff atomically |

---

## Data Model

The planned model is documented in [`docs/data_model.md`](docs/data_model.md) as an ER diagram;
the restriction catalog in [`docs/restrictions.md`](docs/restrictions.md) and the tool
architecture in [`docs/tool_architecture.md`](docs/tool_architecture.md).

Migrations live in `backend/src/migrations/` and are applied automatically on startup in
alphabetical order, each inside a transaction, tracked in the `schema_migrations` table.

| Migration | Contents |
|---|---|
| `001_users.sql` | `local_users` — OIDC-linked local accounts with role flags |
| `002_curriculum_core.sql` | 18 curriculum tables: departments, programs, degrees, lecturers, locations, rooms, semesters, taxonomy items, competency matrices, matrix competencies, competencies, proofs of competency, curriculum versions, modules, lessons, class entities, weeks, scheduling rules |
| `003_entity_access.sql` | `entity_access` ACL table + `extra` JSONB audit bag on entity tables |
| `004_entity_restrictions.sql` | `entity_restrictions` — typed scheduling restrictions with weight/priority |
| `005_semester_timeslots.sql` | Semester timeslot grid (`slot_duration_minutes`, `slot_start_times`) |
| `006_version_created_by_semester.sql` | `curriculum_versions.created_by` and target semester |
| `007_module_timeslots.sql` | `modules.timeslots` |
| `008_drop_contact_hours.sql` | Drops obsolete `modules.contact_hours` |
| `009_curriculums.sql` | `curriculums` table; versions linked to curricula; `programs.curriculum_id` replaces the active-version pointer |
| `010_user_roles.sql` | `is_user_admin`, `is_scheduler` delegated role flags |
| `011_module_lecturer_mapping.sql` | `module_lecturers` join table for the mapping tool |
| `012_user_not_lecturer.sql` | `is_not_lecturer` opt-out flag |
| `013_room_availability.sql` | `room_availability` — weekly room time windows, optionally scoped to a week |
| `014_lecturer_unavailability.sql` | `lecturer_unavailability` — weekly recurring / individual-date unavailability |

---

## Testing

Three test scripts exist in `backend/test/`, run via `tsx` with a hand-written `assert()`
helper — there is no test framework dependency in the project.

| File | Covers |
|---|---|
| `api.test.ts` | Health, bootstrap status, auth guards (401 without session), ID token validation, logout, rate limiter threshold + reset |
| `restrictions.test.ts` | Restriction fixtures, validation, CRUD, inheritance, access control |
| `entityAcl.test.ts` | Entity ACL: visibility, creation rules, grant/change/revoke, last-admin protection, user search |

```bash
npm test
```

The tests start the backend on a fixed port and need a reachable PostgreSQL. Note that
`npm test` currently runs only `api.test.ts` and `restrictions.test.ts`; for the ACL tests run
`npx tsx test/entityAcl.test.ts` manually from `backend/`.

There are no frontend tests.

---

## Known Gaps

These are worth knowing before relying on the apps:

1. **Semester schedule generation does not exist yet.** The restriction catalog, the
   inheritance logic and `packages/shared/src/restrictionSolver.ts` (a rule assembler that
   prepares `SchedulingRuleDTO`s for a future solver) are in place, but there is no solver and
   no generation endpoint.
2. **`competencies` is a placeholder.** The competency model exists in migration 002, but
   there is no mapping UI or API yet.
3. **Offline fallback.** The administration app writes entities to PostgreSQL first, but on
   *network* failure (server unreachable) it silently falls back to a per-table
   `localStorage` cache (`uw_pg_jsonb_<table>`), so data can diverge between browsers. API
   rejections (401/403) are surfaced, not masked.
4. **Dead code in the administration app.** Composables and form dialogs for rooms, weeks,
   schedule entries, availabilities, competencies and proofs of competency are prepared but
   unused; the scheduling app has its own live implementations of rooms and availability.
5. **Legacy storage keys.** The administration app's localStorage keys still carry
   `courseweaver_*` names from a predecessor project.
6. **`schedule_entries` and `lecturer_availability` have no tables yet.** The frontend's
   entity table map references them, but no migration creates them and the backend does not
   serve them (`class_entities` vs `classes` is resolved at the API layer).
7. **`scripts/generate-tool-apps.ts` is outdated and dangerous.** It writes
   `outDir: 'dist'`, but the apps actually build to `dist/apps/<slug>`. Running it would
   overwrite the app scaffolds with placeholder versions and break the production mount. It
   is not wired to any npm script. The same holds for `scripts/fix-tool-apps.ts`.

---

## License

MIT — see [LICENSE](LICENSE).