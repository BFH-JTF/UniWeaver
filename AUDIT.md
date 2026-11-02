# AUDIT.md — Bestandsaufnahme UniWeaver (Stand v0.4.4, 02.11.2026)

## Zweck der App

UniWeaver ist eine Sammlung von vier Web-Werkzeugen zur Verwaltung von
Hochschul-Curricula: Curriculum-Administration, Scheduling (Ressourcen,
Verfügbarkeiten, Stundenplan-Generierung mit Timefold-Solver) und
Kompetenz-Mapping, mit geteiltem Login (OIDC), geteilter PostgreSQL-Datenbank
und einem gemeinsamen Express-Backend, das gleichzeitig JSON-API, statischer
Host der vier SPAs und Reverse-Proxy für den OIDC-Provider (docPouch) ist.

## Verwendete Technologien

| Bereich | Technologie | Version |
|---|---|---|
| Sprache | TypeScript (ESM) + Java (Scheduler) | TS ~5.7, Java 21 |
| Backend | Express, iron-session, jose, pg | Express 5.3, iron-session 9, pg 8.23 |
| Frontend | Vue 3, Vuetify 4, Pinia, Vue Router, Vite 8 | Vue 3.5.44, Router 5.4 |
| Datenbank | PostgreSQL | 16 |
| Solver | Timefold Solver (Spring Boot, REST) | ghcr.io/bfh-jtf/uniweaver-scheduler |
| Linting | ESLint 10 + typescript-eslint + eslint-plugin-vue | 10.x |
| CI | GitHub Actions (lint, typecheck, tests, semantic-release, docker-publish, dependabot) | — |

## Ordnerstruktur (wichtigste Dateien)

```
backend/src/
  index.ts                # Express-Server, CORS, Mounting, OIDC-Proxy
  auth/session.ts         # iron-session (host-scope Cookie, lax, httpOnly)
  auth/verify.ts          # ID-Token-Verifikation (JWKS via jose)
  db/                     # init, migrate, entities, entityService (657),
                          # referenceChecks (484), restrictions
  routes/                 # auth, users, entities (470), rooms, lecturers,
                          # scheduling, schedules, restrictions
  migrations/             # 000-014, automatisches Start-Migration
  scheduler/assemble.ts   # Solver-Orchestrierung (508)
scheduler/                # Java: Timefold-Solver-Service (Spring Boot)
apps/user_entry|administration|scheduling|competencies/   # 4 SPAs (Vite)
packages/shared/src/      # geteilte Typen, restrictions (553), index (417)
```

## Gefundene Probleme (nach Schweregrad)

### Hoch

| # | Datei(en) | Zeile(n) | Beschreibung | Anforderung |
|---|---|---|---|---|
| H1 | `backend/src/index.ts` | 23 | CORS reflektiert **jeden** Origin mit `credentials: true` — jede fremde Website kann im Browser des Nutzers authentifizierte GET-API-Aufrufe (`/api/users`, `/api/:table`) lesen (Cookie wird bei Lax mitgesendet). Fix: Origin-Whitelist via Umgebungsvariable. | SEC-04 |
| H2 | `package-lock.json` (root devDeps) | — | `npm audit`: 54 Vulnerabilities (3 high: body-parser DoS GHSA-27r3-jxmh-p828, brace-expansion GHSA-q2hr-2g5m-vwhr / GHSA-qhr7-859c-m2p7), fixbar ohne Breaking Changes. | SEC-05 |

### Mittel

| # | Datei(en) | Zeile(n) | Beschreibung | Anforderung |
|---|---|---|---|---|
| M1 | `backend/src/index.ts` | (ganzes File) | Keine Security-Header (CSP, X-Content-Type-Options, …) — kein `helmet` o. ä. | SEC-04 |
| M2 | `apps/administration/src/views/CurriculumView.vue` | 1709 | Sehr grosse Datei/Views (weitere: CsvImportDialog 1051, RoomsView 826, MappingEditor 693, entityService.ts 657) | ARCH-02 |
| M3 | `apps/*/src/stores/auth.ts` + `composables/useAuth.ts` | ×3 | Auth-Logik in 3 Apps identisch dupliziert; gehört in `packages/shared` | ARCH-04 |
| M4 | `backend/src/db/index.ts`, `db/migrate.ts`, `index.ts`, `routes/lecturers.ts`, `routes/scheduling.ts` | jeweils 1 | `console.log`-Ausgaben (Debug-Reste prüfen) | CODE-03 |
| M5 | eslint-Bericht | — | 225 Warnings (0 errors), v. a. `no-explicit-any` | CODE-01 |
| M6 | `backend/src/routes/schedules.ts`, `scheduler/assemble.ts` | — | Solver-Eingaben: Schema-/Grössenvalidierung unaufgeräumt prüfen (payload size, limits) | SEC-03 |
| M7 | `backend/test/*` | — | 5 handgeschriebene Testskripte, kein Framework, keine Coverage; keine Frontend-Tests | TEST-01/03 |

### Niedrig

| # | Datei(en) | Zeile(n) | Beschreibung | Anforderung |
|---|---|---|---|---|
| N1 | `apps/*/src/views/*` | — | Lade-/Fehler-/Leer-Zustände nicht überall einheitlich (Spot-Check nötig) | ERR-02 |
| N2 | build-Warnungen | — | Vite-Chunks > 500 kB (585 kB index im user_entry), MDI-Font-Assets gross | PERF-01 |
| N3 | `README.md`, `docs/` | — | Doku überdurchschnittlich, aber `docs/ARCHITEKTUR.md`-Kurzform fehlt | DOC-02 |
| N4 | A11y | — | Lighthouse-Checks (Contrast, Labels, alt) noch nicht ausgeführt | A11Y-01/02 |

## Bereits erfüllt (positiv geprüft, nicht Teil des Backlogs)

- **SEC-01:** Keine Geheimnisse im Code; `.env` git-ignored und **nie in der Git-Historie**; `.env.example` vorhanden; App verweigert Start ohne `SESSION_SECRET` ≥ 32 Zeichen (`backend/src/auth/session.ts:20`).
- **SEC-02:** Frontend-Builds enthalten keine Geheimnisse (nur öffentliche URLs via `define`).
- **SEC-04 (Teil):** SQL ausschliesslich parametrisiert (`pg` Platzhalter); Tabellennamen nur aus internem `TABLE_SPECS`-Registry; Route-Guards (401/403) konsequent; ACL auf Ebene Entität vorhanden.
- **SEC-05 (Teil):** Workspaces (4 Apps + shared) jeweils 0 Vulnerabilities; Dependabot + Dependabot-Automerge aktiv.
- **OPS-01:** `.gitignore` vollständig (`node_modules`, `dist`, `.env`, Datenverzeichnisse); kein Build-Output im Repo; Lockfile committet.
- **OPS-02:** CI (lint + typecheck + Backend-Tests mit PostgreSQL-Service-Container) vorhanden; semantic-release Pipelines.
- **DOC-01:** README mit Architektur, Quick Start, env-var Tabelle, Skripten.
- **CODE-05:** TypeScript überall.

## Bewertung

Der Code ist bereits auf professionell strukturiertem Niveau (ACL, Migrations, CI, parametrierte SQL, Tests). Der grösste offene Sicherheitspunkt ist die CORS-Reflexion; danach Architektur-Refaktoring der sehr grossen View-Dateien und die Duplikate in den Apps.