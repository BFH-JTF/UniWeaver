# FORTSCHRITT.md — Qualitätsarbeit UniWeaver

Massstab: `QUALITAETS-ANFORDERUNGEN.md` (im übergeordneten Apps-Verzeichnis).
Legende: ✅ erledigt · ⏳ offen · ❓ braucht Entscheidung des Menschen

---

### AUDIT-01: Bestandsaufnahme — ✅ erledigt (02.11.2026)

**Was wurde gemacht?** Vollständige Analyse von UniWeaver v0.4.4: Ordnerstruktur,
Sicherheits-Suchen (Secrets, SQL, CORS, Headers, Historie), npm audit,
Lint, CI-Workflows, Tests, grosse Dateien, Code-Duplikate.

**Datei:** `AUDIT.md` (neu; Probleme nach Schweregrad, jeweils mit Anforderungs-Zuordnung)

**Ergebnis in Kürze:** 0 kritische, 2 hoch (CORS-Reflexion, npm-Vulnerabilities),
7 mittel (u. a. riesige View-Dateien, Auth-Duplikate, Lint-Warnings), 4 niedrig.
Vieles (Geheimnisse, SQL-Parametrisierung, ACL, CI, README) ist bereits erfüllt.

---

## Offene Punkte (Reihenfolge gemäss Dokument)

- ✅ SEC-01: Keine Geheimnisse im Code (Sweep bestätigt: keine Hardcodes; .env ignored,
  Historie sauber; **neu:** Server startet nun mit klarer Fehlermeldung ohne `SESSION_SECRET`)
- ✅ SEC-02: Geheimnisse nicht im Browser — Nachweis per Production-Build (Docker-Image):
  `dist/` enthält keine Secret-Werte/Var-Namen; nur öffentliche URLs
- ✅ SEC-03: Eingaben prüfen — verifiziert: `schedules` (ranges 5–600 s, semesterExistenz,
  Namenskürzung), `users` (Feld-Whitelist + Boolean-Coercion), `entities` (TABLE_SPECS +
  Pflichtspalten + Referenzprüfung + atomarer Bulk-Import), `restrictions` (Tabell whitelist),
  kein `v-html` im Code; JSON-Limit 10 MB bewusst belassen (Import-Volumen), dokumentiert
- ✅ SEC-04: Daten und Zugriffe schützen — CORS refl. entfernt (Whitelist via
  `CORS_ORIGINS`, Fallback localhost-only), Security-Header (nosniff, X-Frame-Options,
  Referrer-Policy, CSP-Report-Only) ergänzt; Verifikation: fremder Origin erhält keine
  ACA-Header mehr, 209 Backend-Tests grün
- ✅ SEC-05: npm audit — `npm audit fix` angewendet (54 → 50, alle runtime-Vulns entfernt;
  `npm audit --omit=dev`: 0). Rest: 1 high (`undici`) **dev-only** in der semantic-release
  CI-Toolchain — kein Runtime-Risiko; Dependabot übernimmt Upgrades. 209 Backend-Tests grün.
- ✅ CODE-01: Linter — **`npm run lint`: 0 Fehler, 0 Warnungen** (vorher 225+
  warnings). backend/src komplett getippt (pg-Rows, `errText`-Helfer statt
  `catch (x: any)`), Frontend-Apps: gemeinsame `errorMessage`-Helfer aus
  `packages/shared`, typsichere CSV-Pipelines und typed `as`-Casts statt `any`;
  Tests von `no-explicit-any` befreit (bewusste loose Payloads, kommentiert).
  **Unterwegs latente Bugs entdeckt und gefixt:** (1) Solver-Restrictions kamen
  snake_case und wurden als camelCase gelesen → `ruleType undefined`, Regeln
  stillschweigend ignoriert (`scheduler/assemble.ts`); (2) dieselbe Klasse
  Fehlverhalten in `mapRowToUser` verhindert durch typsichere `LocalUserRow`.
  Verifikation: full typecheck ✅ · 209 Backend-Tests ✅ · lint ✅
- ✅ ARCH-01: Ordnerstruktur verifiziert — pro App `components/composables/plugins/
  router/stores/types/utils/views`, Backend `auth/db/routes/scheduler/migrations`,
  geteilter Code in `packages/shared` → passt, kein Umbau nötig
- ⏳ ARCH-02: Grosse Dateien — **Phase 1 erledigt:** CurriculumView.vue 1709 → 1573
  Zeilen: Delete-with-References-Flow → `composables/useDeleteWithReferences.ts`
  (Dialog-State, Referenz-Prüfung, 409-Re-Show), Header-Definitionen + `formatDate`
  → `utils/curriculumTables.ts`, `severityTitle`/`isReferencesBody` → `utils/deleteRefs.ts`;
  Template unverändert (Null-Risiko), Docker-Build ✅. Rest: weitere Splits je Datei
  (CsvImportDialog 1051, RoomsView 826, MappingEditor 693, entityService.ts 657 …)
- ✅ ARCH-04: Duplikate — 3× identische `useAuth`-Composables (administration/
  scheduling/competencies) → `createToolAuth`-Factory in `packages/shared/src/toolAuth.ts`,
  Apps halten nur dünne Wrapper (Store/Router/Config injiziert). Die ×4 identischen
  Vuetify-Plugins/app.css sind **bewusst** (Design-System laut README) — dokumentiert.
  Auth-Stores unterscheiden sich pro App legitim. Docker-Build + lint ✅
- ✅ OPS-01: Git sauber — verifiziert: `.env`, `dist/`, Datenverzeichnisse ignored;
  Lockfile committet; keine Build-/Runtime-Artefakte im Repo
- ✅ CODE-03 (Teil): 6 Format-Warnings via `lint:fix` behoben; `console.log`-Stellen
  geprüft = bewusste Operations-Meldungen ([Database]/[Server]/[Scheduling]) **beibehalten**;
  keine unused-vars-Funde; offener Rest: siehe CODE-01 (219 `no-explicit-any`)
- ⏳ OPS-01, CODE-01, CODE-03, ARCH-01..04, TEST, ERR, DEP, PERF, A11Y, CODE-02, CODE-04, DOC, OPS-02
- ❓ Erwartet: keine Mensch-Entscheidung, ausser bei „Löschen von Daten“/DLP-Themen