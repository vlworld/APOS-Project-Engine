# APOS — Kontext für Claude

Wenn du in einem neuen Chat bist: lies zuerst die Dateien weiter unten.
Dann verstehst du sofort Projekt, Status und Regeln.

## Was ist dieses Projekt

APOS = **Apricus Project Operating System** (Project Engine).
Projekt-Management für komplexe Projekte der Apricus Solar AG.
Rohbau-Status, keine Produktion. Eigenständige Next.js-App, aus dem
OOS-Monorepo am 2026-04-18 extrahiert.

Repo: `https://github.com/vlworld/APOS-Project-Engine`
Deploy: `https://apos.up.railway.app/` (Railway)

## Pflicht-Lektüre (in dieser Reihenfolge)

1. **`UX_DESIGN_REGELN.md`** (Root) — **KRITISCH**. Gemeinsame Interaktions-
   und Design-Muster für OOS und APOS: Kalender (Custom, nie native),
   Drag & Drop, Modals statt Browser-Dialoge, Tastatur, Loading-States,
   Toasts, Empty-States, Tabellen-Aktionen. **Jede neue Komponente muss
   diesen Regeln folgen.**

2. **`docs/20260418_Apos_Kontext.md`** — vollständige Projekt-Dokumentation
   (17 Abschnitte: Technik-Stack, Datenmodell, alle Routen, Konventionen,
   Deployment, offene Baustellen, Glossar). Wenn du nur eine weitere Datei
   liest: diese.

3. **`CONVENTIONS.md`** — projektspezifische Ergänzungen:
   - Dark-Mode-Check (10 Punkte)
   - Service-Layer-Pattern (Logik in `lib/<domain>/service.ts`, nicht in Routes)

4. **`docs/MIGRATION_ASSISTANT.md`** — Architekturkonzept für den
   Migrationsassistenten (lebt im OOS, Gegenspieler hier in APOS geplant).

## Schwesterprojekt

OOS (Organization Operating System) ist das Mutter-System. Eigenes Repo:
`https://github.com/vlworld/OSS-APP`. Kopplung nur über die zentrale
Task-API (siehe `docs/20260418_Apos_Kontext.md` §13).

## Technik-Kurzform

- Next.js 16, React 19, TypeScript strict, Tailwind 4
- Prisma 5 auf eigener Postgres (Railway)
- NextAuth 4 (CredentialsProvider + Prisma-Adapter)
- npm (kein pnpm, kein Monorepo)

## Aktueller Stand (2026-04-18)

- Basis-Schema: User, Organization, Project
- 2 Seed-Accounts: `vomlehn@apricus-solar.de` (DEVELOPER), `czaja@apricus-solar.de` (ADMIN)
- Passwort beider: `apricus01` (bcrypt, beim ersten Login ändern)
- 19 API-Routen als `501`-Stubs, kommentiert mit `TODO(apos-extract)` —
  werden reaktiviert, sobald Sub-Models ins Schema kommen

## Session 2026-04-18 — was gemacht wurde

- ✅ APOS aus OOS-Monorepo extrahiert in standalone Next.js-Projekt
- ✅ Eigenes GitHub-Repo (`APOS-Project-Engine`), eigene Railway-DB verbunden, Migration angewandt
- ✅ OOS-Rechtestruktur übernommen, zwei Seed-Accounts angelegt (`vomlehn@`, `czaja@`)
- ✅ Dark Mode komplett portiert (inkl. Pastel-Gradient-Fix, Glass-Design)
- ✅ Custom DatePicker portiert
- ✅ Migrationsassistent-Konzept (`docs/MIGRATION_ASSISTANT.md`) finalisiert
- ✅ Vollständige Kontext-Doku (`docs/20260418_Apos_Kontext.md`) für LLM-Austausch
- ✅ Railway-Deploy durchgezogen (Port-Binding, Prisma-Generate, Healthcheck, Target-Port 8080)
- ✅ UX-Design-Regeln ins Repo übernommen (`UX_DESIGN_REGELN.md`)
- ✅ Healthcheck-Endpoint `/api/health` (200 ohne DB-Berührung) angelegt

## Noch offen (nicht dringend, priorisiert)

1. `/api/health` als offiziellen Healthcheck-Pfad in Railway-Settings eintragen
2. Passwörter der Seed-Accounts ändern (aktuell `apricus01` für beide)
3. Sub-Models ausbauen (WorkPackage, Risk, Budget, Stakeholder, Schedule, VOB, Procurement, Decision, HandoverProtocol, CommunicationLog, Document)
4. Die 19 API-Stubs wieder funktional machen
5. Migrationsassistent v0.1 im OOS bauen — Gegenspieler-Endpoint hier in APOS
6. Altes `apps/apos/` im OOS-Monorepo entfernen (nach Review)

## Commit-Regel

Jede Änderung an der Task-Domäne oder am Migrationsassistent-Konzept
aktualisiert die betreffende Doku im selben Commit. Siehe „Pflegeabkommen"
am Ende der jeweiligen Docs. Neue UX-Regeln gehören ins
`UX_DESIGN_REGELN.md` (Root).

Wenn eine Session-Arbeit abgeschlossen ist: „Heute gemacht" und „Noch
offen" in dieser Datei aktualisieren, damit der nächste Chat anknüpfen kann.
