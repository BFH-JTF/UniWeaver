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
- ⏳ SEC-05: npm audit (3 high fixes ohne Breaking Changes möglich)
- ⏳ OPS-01, CODE-01, CODE-03, ARCH-01..04, TEST, ERR, DEP, PERF, A11Y, CODE-02, CODE-04, DOC, OPS-02
- ❓ Erwartet: keine Mensch-Entscheidung, ausser bei „Löschen von Daten“/DLP-Themen