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

1. **`docs/20260418_Apos_Kontext.md`** — vollständige Projekt-Dokumentation
   (17 Abschnitte: Technik-Stack, Datenmodell, alle Routen, Konventionen,
   Deployment, offene Baustellen, Glossar). Wenn du nur eine Datei liest:
   diese.

2. **`CONVENTIONS.md`** — Entwicklungsregeln. Besonders kritisch:
   - Dark-Mode-Check (10 Punkte, verpflichtend für neue Features)
   - Custom DatePicker statt native Date-Inputs
   - Keine Browser-Dialoge (eigene Modals)
   - Service-Layer-Pattern (Logik in `lib/<domain>/service.ts`, nicht in Routes)

3. **`docs/MIGRATION_ASSISTANT.md`** — Architekturkonzept für den geplanten
   Migrationsassistenten zwischen OOS und APOS (lebt später im OOS).

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

## Offene Baustellen

1. Sub-Models ausbauen (WorkPackage, Risk, Budget, Stakeholder etc.)
2. API-Stubs reaktivieren
3. Passwörter der Seed-Accounts ändern
4. Alter `apps/apos/`-Ordner im OOS-Monorepo löschen (nach Review)

## Commit-Regel

Jede Änderung an der Task-Domäne oder am Migrationsassistent-Konzept
aktualisiert die betreffende Doku im selben Commit. Siehe „Pflegeabkommen"
am Ende der jeweiligen Docs.
