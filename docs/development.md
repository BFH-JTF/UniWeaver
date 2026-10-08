UniWeaver runs in two modes: as a single docker image (production) and with the Vite dev servers (local development). Both modes use the same backend, the same database and the same OIDC provider.

## Production mode (docker)

```
docker compose up -d --build
```

Everything is served from one origin: `http://localhost:3000`. The backend serves the built apps from `dist/apps/<app>` and redirects `/` to `/user_entry`. The OIDC provider is reached same-origin through the backend proxy under `/oidc` and `/interaction`.

## Development mode (Vite dev servers)

```
npm install
npm run dev:all
```

`dev:all` first starts the infrastructure containers (`npm run dev:infra`: `postgres` and `doc-pouch`, *not* the `app` container) and then `npm run dev`, which runs the backend and all four apps on the host with hot reload.

| URL                              | Served by                     |
|----------------------------------|-------------------------------|
| http://localhost:5173/           | user_entry (login + portal)   |
| http://localhost:5174/           | administration                |
| http://localhost:5175/           | scheduling                    |
| http://localhost:5176/           | competencies                  |
| http://localhost:3000/api/...    | backend (Express)             |
| http://localhost:3000/oidc/...   | OIDC provider (backend proxy) |
| localhost:5432                   | PostgreSQL (container)        |
| http://127.0.0.1:3030            | docPouch admin UI (container) |

Notes:

- Every app keeps its production sub-path as Vite `base` (`/user_entry/`, `/administration/`, ...). The bare root of a dev server redirects to that sub-path, so `http://localhost:5173/` lands on `http://localhost:5173/user_entry/`.
- Start the **apps you need plus the backend**. A single app alone is not enough: opening `http://localhost:5173/` while only `apps/administration` runs gives "connection refused", and every app needs the backend on port 3000 for `/api` (each `vite.config.ts` proxies `/api` there).
- Do not run the compose `app` service at the same time as the dev backend — both bind port 3000.
- The portal links to the tools by their dev ports (`apps/user_entry/src/config.ts`), so keep the port numbers above.
- Stop the containers again with `npm run dev:infra:stop`.

### Tests

The backend tests need a reachable PostgreSQL (the dev database works). `npm test` from the
repo root runs `api.test.ts` and `restrictions.test.ts`; `entityAcl.test.ts` is not wired into
the test script and must be run manually:

```bash
cd backend
npx tsx test/entityAcl.test.ts
```

All tests are hand-written scripts with their own `assert()` helper (no test framework); each
starts its own backend instance on a fixed port (3456/3457).

### Environment

Configuration lives in the repo-root `.env` (read by the backend through `dotenv` and by docker compose). Because the backend is started per workspace (`npm run dev -w backend`, cwd `backend/`), `backend/src/db/index.ts` loads that root `.env` by absolute path.

Two variables differ between the modes:

- `OIDC_ISSUER` — browser-facing issuer, `http://localhost:3000/oidc` in both modes; docPouch advertises it, so the `iss` claim matches.
- `OIDC_INTERNAL_ISSUER` — provider URL as seen by the backend. In `.env` it is the host-visible `http://localhost:3030/oidc` (dev). The compose `app` container instead uses `OIDC_INTERNAL_ISSUER_DOCKER`, which defaults to the docker-network URL `http://doc-pouch:3030/oidc`.

`SESSION_SECRET` must be at least 32 characters, otherwise every `/api/auth` request fails.

### Login in dev mode

The SPA on port 5173 talks to the provider on port 3000 cross-origin. That works because the provider sends permissive CORS headers on discovery, registration and token endpoints, and because the session cookie is host-scoped (cookies ignore the port), so a session created via the 5173 proxy is also sent by the apps on 5174–5176. The OIDC client is registered dynamically with the dev callback `http://localhost:5173/user_entry/callback`; the registered client id is cached in `localStorage` and re-probed on every login.
