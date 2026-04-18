# APOS — Vollständiger Kontextdokument für LLM-Austausch

**Stand:** 2026-04-18  
**Zweck:** Dieses Dokument ist der vollständige Kontext für APOS. Es ist so verfasst, dass ein fremdes LLM (Claude, GPT o. ä.) nach dem Lesen sofort mit Feature-Ideen und technischen Diskussionen zu APOS arbeiten kann — ohne Rückfragen wie „Was ist APOS?" oder „Gibt es dazu auch Backend?".

---

## 1. TL;DR

APOS (Apricus Project Operating System) ist eine eigenständige Next.js-Anwendung für Bauprojekt-Management bei der Apricus Solar AG. Das System befindet sich im Rohbau-Stadium (Skeleton): Authentifizierung, Dark Mode und Projektverwaltung laufen, alle Sub-Module (Arbeitspakete, Risiken, Budget, VOB etc.) existieren als UI-Skeleton, aber deren API-Routen sind bewusst als 501-Stubs markiert, bis das Datenbankschema erweitert wird. APOS läuft auf Railway, ist dort aktuell jedoch aufgrund eines Deploy-Problems nicht erreichbar. Dieses Dokument dient als Kontext-Anhang für Feature-Diskussionen in einem externen LLM-Chat.

---

## 2. Was ist APOS

**Voller Name:** Apricus Project Operating System — auch „Project Engine" oder „ProjectEngine" genannt.

**Zweck:** Projekt-Management-System für komplexe Bauprojekte der Apricus Solar AG (Photovoltaik-Anlagen, Solarparks, VOB-Nachträge, Arbeitspakete, Risiken, Budgets, Stakeholder, Kommunikation, Übergabeprotokolle, Terminpläne, Beschaffung, Entscheidungsregister, Dokumente).

**Zielgruppe:** Interne Projektleiter und Gewerke-Koordinatoren bei Apricus Solar AG. Kein öffentlicher Zugang, kein Kunden-Portal.

**Nicht enthalten (in aktueller Phase):** Task-Execution (das bleibt im OOS — siehe §13), Zeiterfassung, Onboarding, Handbuch, Jour Fixe. Diese Domänen gehören zu OOS.

---

## 3. Abgrenzung zu OOS

OOS (Organization Operating System) ist das Schwester-Projekt der Apricus Solar AG. Es ist das operative Betriebssystem der Organisation.

| Merkmal | OOS | APOS |
|---|---|---|
| Domäne | Organisation, Betrieb | Projektmanagement, Bau |
| Kernfunktionen | Kanban, Prozesse, Rollen, Onboarding, Zeiterfassung, Jour Fixe, Handbuch | Meilensteine, Arbeitspakete, VOB, Risiken, Budget, Stakeholder, Terminpläne |
| Task-Ownership | Ja — single source of truth | Nein — konsumiert OOS-Tasks via API |
| Deploy | Eigenes Railway-Service | Eigenes Railway-Service |
| Datenbank | Eigene Postgres-DB | Eigene Postgres-DB |
| Repo | OOS-Monorepo (pnpm workspaces) | Eigenständiges Repo (npm) |

**Kopplung:** Die einzige echte Kopplung zwischen beiden Systemen ist die zentrale Task-API im OOS (§13). Keine Shared-Packages, keine gemeinsame Datenbank, kein gemeinsames Auth-System.

---

## 4. Entstehungshistorie

APOS startete als Sub-App `apps/apos/` innerhalb des OOS-Monorepos (`pnpm-workspace.yaml`). Am 2026-04-18 wurde es vollständig extrahiert und in ein eigenständiges Projekt überführt.

**Git-Log (chronologisch):**

```
f14f134  initial: APOS extrahiert als eigenstaendiges Projekt aus OOS-Monorepo
e6f2740  db: initial migration (User, Organization, Project)
67b658d  feat(auth): Rechtestruktur aus OOS + Seed-Accounts
7a18753  docs: Architekturkonzept Migrationsassistent OOS <-> APOS
4e44396  fix(deploy): Railway-kompatibler start-Port (PORT-Env verwenden)
e35af6d  fix(deploy): prisma generate in postinstall + build
```

**Neues Repo:** `https://github.com/vlworld/APOS-Project-Engine`

Der ursprüngliche Ordner `apps/apos/` im OOS-Monorepo besteht noch als Altlast — ein Cleanup ist geplant, aber noch nicht erfolgt. Die Extraktion wurde durch ein Sub-Agenten-System durchgeführt; alle Extraktions-Entscheidungen sind im Initial-Commit dokumentiert.

---

## 5. Aktueller Status

**Gesamtzustand: Rohbau / Skeleton. Nicht produktionsreif.**

| Bereich | Status |
|---|---|
| Authentifizierung (Login, JWT, NextAuth) | Funktional |
| Dark Mode / ThemeProvider | Funktional |
| Projektverwaltung (Anlegen, Listen, Detail) | Funktional (echte Prisma-Queries) |
| Datenbankverbindung (Railway Postgres) | Verbunden |
| Basis-Schema (User, Organization, Project) | Migriert und aktiv |
| Seed-Accounts | Angelegt (`vomlehn`, `czaja`) |
| Sub-Modul-Seiten (VOB, Risiken, Budget, ...) | UI-Skeleton vorhanden |
| Sub-Modul-API-Routen (18 Routen) | 501-Stubs — nicht implementiert |
| Railway-Deployment | Angelegt, aktuell **nicht erreichbar** (aktiver Debug, Port-Binding + Prisma-Generate wurden bereits gepatcht, wartet auf Rebuild) |

**Seed-Accounts (Initial-Passwort: `apricus01` — muss nach erstem Login geändert werden):**

| E-Mail | Rolle | Kürzel |
|---|---|---|
| `vomlehn@apricus-solar.de` | DEVELOPER | OVL |
| `czaja@apricus-solar.de` | ADMIN | CZ |

---

## 6. Technik-Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16.2.0 (App Router) |
| UI | React 19.2.4, Tailwind CSS 4 (`@tailwindcss/postcss`), Lucide-Icons |
| Typen | TypeScript 5, strict mode |
| Persistenz | PostgreSQL (Railway), Prisma ORM 5.22 |
| Auth | NextAuth 4.24 mit CredentialsProvider + Prisma-Adapter |
| Passwörter | bcryptjs 3.x |
| Linting | ESLint 9 mit eslint-config-next 16.2.0 |
| Deploy | Railway (GitHub auto-deploy von `main`) |
| Paket-Manager | npm (kein pnpm, kein Monorepo) |

---

## 7. Datenmodell (Ist-Zustand)

Das aktuelle Schema enthält drei Models. Alle Migrations liegen unter `apos-standalone/prisma/migrations/`.

**Migration 1 — `20260418151149_init`:** Legt User, Organization, Project an (Basis-Felder).

**Migration 2 — `20260418154500_add_roles_and_org_fields`:** Fügt Rollen-Flags, Org-Felder und Indizes hinzu. Wurde via `prisma db push` auf die Railway-Instanz angewendet; die Migrationsdatei enthält idempotente `ALTER TABLE IF NOT EXISTS`-Statements.

### Model: User

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `id` | String (cuid) | auto | Primärschlüssel |
| `email` | String | — | Eindeutig, Login-Identifier |
| `name` | String | — | Pflichtfeld (NOT NULL) |
| `password` | String? | null | bcrypt-Hash; null bei SSO (noch nicht implementiert) |
| `role` | String | `"EMPLOYEE"` | Werte: `EMPLOYEE \| MANAGER \| ADMIN \| DEVELOPER` |
| `kuerzel` | String? | null | Initialen, max 3 Zeichen |
| `position` | String? | null | Stellenbezeichnung |
| `department` | String? | null | Abteilung |
| `image` | String? | null | Profilbild-URL |
| `emailVerified` | DateTime? | null | Für NextAuth-Adapter (noch nicht genutzt) |
| `isExternal` | Boolean | `false` | Externer Dienstleister |
| `isDisabled` | Boolean | `false` | Temporär gesperrt |
| `hasOosAccess` | Boolean | `true` | Zugriff auf OOS |
| `hasAposAccess` | Boolean | `true` | Zugriff auf APOS (default true, da eigene Instanz) |
| `mobileClockInAllowed` | Boolean | `false` | Mobile-Einstempeln freigegeben |
| `reasonRequiredOnShift` | Boolean | `false` | Begründung bei Datums-Verschiebung erzwingen |
| `isReportRequired` | Boolean | `false` | Bericht pro Sitzung Pflicht (nur für externe) |
| `betaMode` | Boolean | `false` | Beta-/Dev-Features sichtbar |
| `lastSeenAt` | DateTime? | null | Letzter Login |
| `createdAt` | DateTime | `now()` | — |
| `updatedAt` | DateTime | auto-update | — |
| `organizationId` | String | — | FK auf Organization (Cascade-Delete) |

Indizes: `organizationId`, `role`.

### Model: Organization

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `id` | String (cuid) | auto | Primärschlüssel |
| `name` | String | — | Organisationsname |
| `slug` | String? | null | URL-freundlicher Kurzname, eindeutig |
| `logoUrl` | String? | null | Logo-URL |
| `createdAt` | DateTime | `now()` | — |
| `updatedAt` | DateTime | auto-update | — |

Seed-Eintrag: `{ name: "Apricus Solar AG", slug: "apricus-solar-ag" }`

### Model: Project

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `id` | String (cuid) | auto | Primärschlüssel |
| `name` | String | — | Projektname |
| `projectNumber` | String | — | Eindeutig (z. B. `P-2024-001`) |
| `description` | String? | null | Freitext |
| `status` | String | `"PLANNING"` | Werte: `PLANNING \| ACTIVE \| ON_HOLD \| COMPLETED \| ARCHIVED` |
| `clientName` | String? | null | Auftraggeber |
| `address` | String? | null | Projektadresse |
| `budget` | Float? | null | Gesamtbudget in EUR |
| `startDate` | DateTime? | null | Geplanter Starttermin |
| `endDate` | DateTime? | null | Geplantes Enddatum |
| `organizationId` | String | — | FK auf Organization |
| `managerId` | String | — | FK auf User (Projektleiter) |
| `createdAt` | DateTime | `now()` | — |
| `updatedAt` | DateTime | auto-update | — |

Indizes: `organizationId`, `managerId`, `status`.

---

## 8. Datenmodell (geplante Erweiterungen)

Aus `README.md`, `CONVENTIONS.md` und den TODO-Kommentaren in `prisma/schema.prisma` ist dokumentiert, welche Sub-Models als Nächstes portiert werden. Vorlage ist das `apps/apos/`-Schema im OOS-Monorepo (Suche nach `Apos`-Präfix-Models dort).

Jedes geplante Model hängt als 1:n-Relation an `Project`:

| Model | Zweck |
|---|---|
| `WorkPackage` | Arbeitspakete / WBS-Hierarchie |
| `ScheduleItem` | Terminplan-Einträge (Meilensteine, Vorgänge) |
| `VobItem` | VOB-Nachträge (Vergabe- und Vertragsordnung für Bauleistungen) |
| `BudgetItem` | Budget-Positionen und Kostenverfolgung |
| `Risk` | Risikoregister-Einträge |
| `Procurement` | Beschaffungsvorgänge |
| `Stakeholder` | Stakeholder-Verwaltung |
| `Decision` | Entscheidungsregister |
| `HandoverProtocol` | Übergabe-Protokolle |
| `CommunicationLog` | Kommunikationslog-Einträge |
| `Document` | Dokumente und Dateizuordnungen |

Sobald die Sub-Models im Schema existieren, werden die 18 API-Stub-Routen aktiviert und gegen echte Prisma-Queries ersetzt.

---

## 9. App-Struktur (Routen und Zweck)

### Öffentliche Routen

| Pfad | Typ | Zweck | Status |
|---|---|---|---|
| `/` | Seite | Redirect: eingeloggt → `/dashboard`, sonst → `/login` | Funktional |
| `/login` | Seite | Login-Formular (NextAuth CredentialsProvider), immer hell via `<LightOnly>` | Funktional |

### Geschützte App-Routen (nach Login, unter `app/(app)/`)

Das Layout `app/(app)/layout.tsx` übernimmt den Auth-Guard: nicht eingeloggte User werden zu `/login` weitergeleitet. Alle Seiten liegen in `AppShell` (Sidebar + TopNav).

| Pfad | Typ | Zweck | Status |
|---|---|---|---|
| `/dashboard` | Seite | Willkommens-Dashboard, Link zu Projekten | Funktional (Skeleton, keine KPIs) |
| `/projekte` | Seite | Projektliste mit Anlegen-Modal, Status-Badges, Karten-Grid | Funktional |
| `/projekte/[id]` | Seite | Projekt-Detail: Metadaten + Modul-Karten-Übersicht | Funktional (sub-model counts stubbed) |
| `/projekte/[id]/arbeitspakete` | Seite | Arbeitspakete eines Projekts | UI-Skeleton |
| `/projekte/[id]/terminplan` | Seite | Terminplan eines Projekts | UI-Skeleton |
| `/projekte/[id]/vob` | Seite | VOB-Nachträge eines Projekts | UI-Skeleton |
| `/projekte/[id]/budget` | Seite | Budget-Positionen eines Projekts | UI-Skeleton |
| `/projekte/[id]/beschaffung` | Seite | Beschaffungsvorgänge eines Projekts | UI-Skeleton |
| `/projekte/[id]/stakeholder` | Seite | Stakeholder eines Projekts | UI-Skeleton |
| `/projekte/[id]/entscheidungen` | Seite | Entscheidungsregister eines Projekts | UI-Skeleton |
| `/projekte/[id]/risiken` | Seite | Risikoregister eines Projekts | UI-Skeleton |
| `/projekte/[id]/dokumente` | Seite | Dokumente eines Projekts | UI-Skeleton |
| `/projekte/[id]/uebergaben` | Seite | Übergabe-Protokolle eines Projekts | UI-Skeleton |
| `/projekte/[id]/kommunikation` | Seite | Kommunikationslog eines Projekts | UI-Skeleton |
| `/arbeitspakete` | Seite | Globale Arbeitspakete-Übersicht (alle Projekte) | UI-Skeleton |
| `/terminplan` | Seite | Globaler Terminplan | UI-Skeleton |
| `/vob` | Seite | Globale VOB-Übersicht | UI-Skeleton |
| `/budget` | Seite | Globale Budget-Übersicht | UI-Skeleton |
| `/beschaffung` | Seite | Globale Beschaffungs-Übersicht | UI-Skeleton |
| `/stakeholder` | Seite | Globale Stakeholder-Übersicht | UI-Skeleton |
| `/entscheidungen` | Seite | Globales Entscheidungsregister | UI-Skeleton |
| `/risiken` | Seite | Globales Risikoregister | UI-Skeleton |
| `/dokumente` | Seite | Globale Dokument-Übersicht | UI-Skeleton |
| `/uebergaben` | Seite | Globale Übergabe-Protokolle | UI-Skeleton |
| `/kommunikation` | Seite | Globaler Kommunikationslog | UI-Skeleton |

### API-Routen (`app/api/`)

**Echte Implementierungen (Prisma-Queries aktiv):**

| Pfad | Methoden | Zweck | Status |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth-Handler (Login, Session, Logout) | Funktional |
| `/api/projekte` | GET, POST | Projekt-Liste abfragen / neues Projekt anlegen | Funktional |
| `/api/projekte/[id]` | GET, PATCH, DELETE | Einzelnes Projekt lesen / bearbeiten / löschen | Funktional |

**501-Stubs (`TODO(apos-extract)` — warten auf Schema-Erweiterung):**

Alle 18 folgenden Routen geben `{ message: "TODO(apos-extract): implement with own schema" }` mit HTTP 501 zurück. Sie prüfen die Session bereits korrekt via `requireSession()`, schreiben aber noch keine Daten.

| Pfad | Methoden |
|---|---|
| `/api/projekte/[id]/arbeitspakete` | GET, POST, PATCH, DELETE |
| `/api/projekte/[id]/arbeitspakete/[wpId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/terminplan` | GET, POST, PATCH, DELETE |
| `/api/projekte/[id]/terminplan/[itemId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/vob` | GET, POST |
| `/api/projekte/[id]/vob/[vobId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/budget` | GET, POST |
| `/api/projekte/[id]/budget/[budgetId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/beschaffung` | GET, POST |
| `/api/projekte/[id]/beschaffung/[procId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/stakeholder` | GET, POST |
| `/api/projekte/[id]/entscheidungen` | GET, POST |
| `/api/projekte/[id]/risiken` | GET, POST |
| `/api/projekte/[id]/risiken/[riskId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/dokumente` | GET, POST |
| `/api/projekte/[id]/uebergaben` | GET, POST |
| `/api/projekte/[id]/uebergaben/[protocolId]` | GET, PATCH, DELETE |
| `/api/projekte/[id]/kommunikation` | GET, POST |

---

## 10. Konventionen und Entwicklungsprinzipien

Quelle: `apos-standalone/CONVENTIONS.md` (verbindlich, keine optionalen Empfehlungen).

### Dark Mode — 7 Kernregeln

1. **Light-first:** Neue Komponenten werden zuerst für den hellen Modus entworfen.
2. **Keine manuellen `dark:`-Klassen** für Standard-Utilities — die `globals.css` mappt automatisch via unlayered Override-Block.
3. **Explizite `dark:`-Klassen** nur für spezifische Abweichungen vom globalen Fallback.
4. **Immer-helle Surfaces** (Login, PDF-Export) werden mit `<LightOnly>` aus `components/theme/LightOnly.tsx` geschützt.
5. **Keine Inline-Styles mit Hex/RGB** — umgehen das CSS-Override-System. Immer Tailwind-Klassen. Bei SVGs: `currentColor`.
6. **Der globale Fallback-Block in `globals.css` ist UNLAYERED** — darf nicht in `@layer` verschoben werden (Tailwind v4 Priority-Regel).
7. **Pastel-Gradients** brauchen explizite Neutralisierung — `globals.css` enthält Blanket-Overrides für gängige Kombinationen; neue Pastel-Gradients prüfen.

### Weitere Konventionen

**DatePicker:** Kein `<input type="date">`. Stattdessen immer `<DatePicker>` aus `components/ui/DatePicker.tsx` (Custom-Kalender, portiert von OOS, deutsch lokalisiert, Dark-Mode-kompatibel).

**Keine Browser-Dialoge:** `window.confirm()`, `window.alert()`, `window.prompt()` sind verboten. Stattdessen In-App-Modals im eigenen Design.

**Button-Konventionen:**
- Primär (Speichern, Anlegen): `bg-emerald-600 text-white hover:bg-emerald-700`
- Sekundär (Abbrechen): `text-gray-700 hover:bg-gray-100` (kein Border)
- Gefährlich (Löschen): `bg-red-600 text-white hover:bg-red-700`
- Archivieren: Icon `Archive`, Status auf `ARCHIVED` setzen (nicht löschen)
- Loading-State: Button während API-Calls deaktiviert + `<Loader2 className="animate-spin">`

**Status-Badges:** Immer über ein `STATUS_CONFIG`-Objekt mit `label`, `bg`, `text` — nie Farben direkt in JSX.

**Tastatur-Shortcuts:** `Escape` schließt jedes Modal/Drawer (via `useEffect + window.addEventListener`). `Ctrl+S` / `Cmd+S` speichert Formulare in Modals.

**Service-Layer-Pattern:** API-Routes sind dünn — sie validieren Input und delegieren an `lib/<domain>/service.ts`. Keine Business-Logik direkt in `route.ts`.

**Auth in API-Routes:** Jede geschützte Route beginnt mit `const { session, error } = await requireSession();` aus `lib/api-helpers.ts`.

**Organisations-Scoping:** Jede DB-Query enthält `organizationId: session.user.organizationId` als Filter — kein Query ohne diesen Filter.

**TypeScript:** strict: true, kein `any` ohne expliziten Kommentar. Keine Inline-Farben (`style={{ color: "#6b7280" }}` verboten — Tailwind-Klassen verwenden).

**Drag-and-Drop:** `@hello-pangea/dnd` (React 19 kompatibel, `react-beautiful-dnd`-API-kompatibel) wenn DnD benötigt.

---

## 11. Authentifizierung und Rollen

**Konfiguration:** `apos-standalone/lib/auth.ts`

- Strategy: JWT (30 Tage)
- Provider: CredentialsProvider (E-Mail + bcrypt-Passwort)
- Prisma-Adapter: `@next-auth/prisma-adapter`
- Login-Seite: `/login`

**Rollen (identisch zu OOS — bewusstes Design für spätere Task-API-Integration ohne Rollen-Mapping):**

| Rolle | Berechtigungen |
|---|---|
| `EMPLOYEE` | Standard-Mitarbeiter, eigene Daten |
| `MANAGER` | Erweiterte Sichtbarkeit, Team-Boards, kann `PRIVATE`-Objekte anderer mit Badge sehen |
| `ADMIN` | Alles im Organisations-Scope |
| `DEVELOPER` | Technische Systemansichten; Dev-PRIVATE-Objekte für niemanden sichtbar |

**User-Flags:**

| Flag | Zweck |
|---|---|
| `isExternal` | Externer Dienstleister (kein regulärer Mitarbeiter) |
| `isDisabled` | Temporär gesperrt (kann sich nicht einloggen) |
| `hasOosAccess` | Zugriff auf OOS erlaubt |
| `hasAposAccess` | Zugriff auf APOS erlaubt |
| `mobileClockInAllowed` | Mobile-Einstempeln freigeschaltet |
| `reasonRequiredOnShift` | Zwingt Begründung beim Verschieben von Daten |
| `isReportRequired` | Nur isExternal: Bericht pro Sitzung Pflicht |
| `betaMode` | Sieht Beta-Features |

**Seed-Accounts:**

| E-Mail | Rolle | Kürzel | Initial-Passwort |
|---|---|---|---|
| `vomlehn@apricus-solar.de` | DEVELOPER | OVL | `apricus01` — muss geändert werden |
| `czaja@apricus-solar.de` | ADMIN | CZ | `apricus01` — muss geändert werden |

**Hinweis:** Die `lib/auth.ts` enthält aktuell noch einen `TODO(apos)`: `organizationId` wird nach Login als leerer String `""` im JWT gesetzt. Der vollständige Organization-Lookup (Abfrage per User-FK aus DB) muss noch nachgezogen werden.

---

## 12. Deployment und Infrastruktur

**GitHub-Repo:** `https://github.com/vlworld/APOS-Project-Engine`  
Auto-Deploy von Branch `main` zu Railway.

**Railway-Deployment:**

| Parameter | Wert |
|---|---|
| Public URL | `https://apos.up.railway.app/` (Stand 2026-04-18: **nicht erreichbar**, Debugging läuft) |
| Build-Kommando | `prisma generate && next build` |
| Start-Kommando | `next start --port ${PORT:-3001}` |
| Postinstall | `prisma generate` (in `package.json`) |

**Bekannte Deploy-Probleme (Stand 2026-04-18):**
- Port-Binding war ursprünglich auf 3001 fest verdrahtet — der Fix (`${PORT:-3001}`) ist committet (`4e44396`).
- Prisma-Generate fehlte im Build-Schritt — ebenfalls gepatcht (`e35af6d`).
- Ob der aktuelle `main`-Stand auf Railway erfolgreich baut, steht zum Zeitpunkt der Dokumentenerstellung aus.

**Environment-Variablen (müssen auf Railway und lokal gesetzt sein):**

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | PostgreSQL-Connection-String (Railway-Postgres) |
| `NEXTAUTH_SECRET` | JWT-Signing-Secret (min. 32 Zeichen, zufällig) |
| `NEXTAUTH_URL` | Basis-URL der App (`https://apos.up.railway.app/` in Production, `http://localhost:3001` lokal) |

Die lokale `.env`-Datei ist gitignored. Eine Vorlage existiert unter `.env.example`.

---

## 13. Beziehung zur zentralen Task-API im OOS

Die vollständige Task-API-Dokumentation liegt unter:
`/Users/vomlehn/Claude_Code_Testprojekt B_OS/app/apps/oos/docs/tasks-api.md`

**Das Prinzip:** APOS hat bewusst keine eigene Task-Tabelle. Tasks existieren als single source of truth im OOS. Ein Unternehmen hat eine Aufgabe — nicht zwei, je nachdem welches System sie anschaut.

APOS erzeugt, liest und aktualisiert Tasks ausschließlich via HTTP-API des OOS:

- `POST /api/tasks` — Task aus APOS-Trigger anlegen (z. B. überfälliger Meilenstein)
- `POST /api/task-ingest` — Strukturiertes Signal ingesten (mit Confidence-Score und Review-Queue)
- `GET /api/tasks?projectId=...` — Tasks zu einem Projekt lesen
- `PATCH /api/tasks/:id/status` — Status ändern
- `PATCH /api/tasks/:id/assign` — Zuweisung ändern
- `POST /api/tasks/:id/link` — Task mit APOS-Objekt verknüpfen (z. B. `entityType: "APOS_MILESTONE"`)

APOS hat eigene Projekt-, Milestone-, Risk- und WorkPackage-Semantik — die Ausführung (wer, bis wann, erledigt?) bleibt jedoch OOS-Domäne. Begründung: Ein User soll eine Aufgabe nicht zweimal sehen müssen — einmal im APOS-Projektkontext und einmal im persönlichen OOS-Kanban.

**TaskLink** ist die Kopplung: APOS reservierte `entityType`-Werte sind `APOS_PROJECT`, `APOS_MILESTONE`, `APOS_RISK`, `APOS_ISSUE`, `APOS_DELIVERABLE`. Über diesen Mechanismus kann eine Task gleichzeitig im OOS-Kanban des Assignees und in der APOS-Projektansicht erscheinen — als dieselbe Task, ohne Datenduplizierung.

Der **CoreStatus** (systemübergreifend): `draft | open | in_progress | waiting | blocked | done | cancelled`.

---

## 14. Migrationsassistent (geplant)

Dokumentation: `apos-standalone/docs/MIGRATION_ASSISTANT.md`

OOS entwickelt sich als produktiv genutztes System kontinuierlich weiter. Der Migrationsassistent ermöglicht eine kontrollierte Portierung ausgewählter OOS-Features nach APOS — als Analyse-Tool, nicht als Sync-Tool.

**Finale Architektur-Entscheidungen (2026-04-18):**

| Frage | Entscheidung |
|---|---|
| Wo lebt das Tool? | Im OOS (Variante B) — der Hauptentwicklungsort |
| UI vorhanden? | Ja, unter `/developer/migration` im OOS (nur DEVELOPER-Rolle) |
| Umfang v0.1 | Option C: Scanner + Feature-Detector (M1 + M2), keine Patches, kein Apply |
| APOS-Gegenspieler | Minimaler Empfangs-Endpoint + Admin-Stub-Seite in APOS (nimmt Manifeste an, keine Auto-Anwendung) |

**Datenfluss:**
```
OOS → manifest.json → HTTP POST → APOS Empfang → Review durch Dev → manuelle Übernahme
```

OOS liest APOS-Codebase nicht direkt. Der Informationsfluss ist einseitig (OOS schickt, APOS empfängt).

**Portierbarkeits-Klassifizierung:**
- `direkt_portierbar` (Score 90–100): 1:1 übertragbar, nur Import-Pfade anpassen
- `portierbar_mit_anpassungen` (60–89): Generische Logik, aber mit Substitutionen
- `nur_als_vorlage` (30–59): Konzept wertvoll, aber >50 % neu schreiben
- `nicht_portierbar` (0–29): OOS-spezifisch, kein APOS-Äquivalent

**Umfang v0.2+:** Patch-Generator, Apply-Command (erst nach v0.1-Feedback).

Das `manifest.json`-Format ist versioniert (`manifestVersion: "1.0"`) und strukturiert (Feature-Slug, Portierbarkeits-Score, Risiko-Flags, Datei-Mapping, Migrations-Steps).

---

## 15. Offene Baustellen (Stand 2026-04-18)

1. **Railway-Deploy-Problem lösen** — 502-Fehler auf `https://apos.up.railway.app/`. Port-Binding-Fix und Prisma-Generate-Fix sind committet, wartet auf erfolgreichen Rebuild.
2. **Sub-Models ins Schema ziehen** — Die 11 geplanten Models (WorkPackage, ScheduleItem, VobItem, BudgetItem, Risk, Procurement, Stakeholder, Decision, HandoverProtocol, CommunicationLog, Document) per Prisma-Migration ergänzen.
3. **Die 18 API-Stubs reaktivieren** — Nach Schema-Erweiterung echte Prisma-Queries einsetzen, `TODO(apos-extract)`-Markierungen entfernen.
4. **`organizationId` im Auth-Flow vervollständigen** — `lib/auth.ts` um echten Org-Lookup aus DB erweitern (aktuell leerer String im JWT).
5. **Alten `apps/apos/`-Ordner im OOS-Monorepo löschen** — Altlast aus vor der Extraktion.
6. **Passwörter der Seed-Accounts ändern** — `apricus01` ist ein bekanntes Passwort, muss nach erstem Deploy ersetzt werden.
7. **`NEXTAUTH_URL` auf die echte Production-URL setzen** — muss auf Railway als Env-Var gesetzt sein.
8. **DatePicker in vorhandenen Formularen nachrüsten** — `app/(app)/projekte/page.tsx` enthält noch zwei `<input type="date">` (Startdatum, Enddatum im Anlegen-Modal), die gegen den Custom DatePicker ausgetauscht werden müssen.

---

## 16. Glossar

**APOS** — Apricus Project Operating System. Eigenständige Next.js-App für Bauprojekt-Management der Apricus Solar AG.

**OOS** — Organization Operating System. Schwester-App, operatives Betriebssystem der Apricus Solar AG. Kanban, Prozesse, Rollen, Onboarding, Zeiterfassung, Jour Fixe, Handbuch.

**CoreStatus** — Systemübergreifendes Task-Statusmodell: `draft | open | in_progress | waiting | blocked | done | cancelled`. Wird von OOS und APOS identisch genutzt, kein Mapping nötig.

**VisibilityScope** — Feingranulare Sichtbarkeit für Tasks und Objekte: `PRIVATE | TEAM | PROJECT | ORG`. Default ist `ORG`.

**Rolle** — Zugriffsstufe eines Users: `EMPLOYEE` (Standard) | `MANAGER` (Team-Sicht) | `ADMIN` (Org-Admin) | `DEVELOPER` (System-intern). Identisch in OOS und APOS.

**WorkPackage** — APOS-Begriff. Arbeitspaket in der WBS-Hierarchie (Work Breakdown Structure) eines Projekts. Noch nicht im Schema.

**Milestone** — APOS-Begriff. Terminplan-Meilenstein. Teil des geplanten `ScheduleItem`-Models.

**Risk** — APOS-Begriff. Eintrag im Risikoregister. Noch nicht im Schema.

**ProcessInstance** — OOS-Begriff. Eine laufende Ausführung eines Prozess-Templates. Gehört zu OOS, nicht zu APOS.

**Kanban** — OOS-Begriff. Persönliche und Team-Task-Boards im OOS. APOS hat keine eigenen Kanban-Boards.

**Jour Fixe** — OOS-Begriff. Regelmäßige Meetings mit strukturierten Tagesordnungspunkten und Task-Extraktion. Gehört zu OOS.

**TaskLink** — OOS-Model. Polymorphe n:m-Verknüpfung zwischen einer `OperativeTask` und einem beliebigen Fachobjekt. Ermöglicht APOS, Tasks mit `APOS_PROJECT`, `APOS_MILESTONE`, `APOS_RISK` etc. zu verknüpfen.

**manifest.json** — Strukturiertes Artefakt des Migrationsassistenten (Format-Version 1.0). Enthält Portierbarkeits-Score, Risiko-Flags, Datei-Mapping und Migrations-Steps für ein konkretes OOS-Feature.

**Monorepo** — Das ursprüngliche OOS-Repository (pnpm workspaces), aus dem APOS am 2026-04-18 extrahiert wurde. APOS ist jetzt standalone (npm, kein Workspace).

**Standalone** — APOS-Betriebsmodus ab 2026-04-18. Eigenes Repo, eigene DB, eigenes Deploy. Keine `workspace:*`-Dependencies, kein Shared-Package.

---

## 17. Wie man dieses Dokument am besten nutzt

Dieses Dokument als System-Prompt-Anhang oder als erste Chat-Nachricht in einem neuen LLM-Chat mitgeben (Claude, GPT o. ä.). Das fremde LLM kann danach Feature-Ideen direkt gegen die APOS-Domäne prüfen — es kennt dann die Technik, die Grenzen, die geplanten Sub-Models und die Kopplung an OOS via Task-API. Rückfragen wie „Was ist VOB?" oder „Wo liegen die Routen?" entfallen.

Bei Diskussionen zu neuen Features ist §7 (Ist-Datenmodell) und §8 (geplante Erweiterungen) der Ankerpunkt für Schema-Fragen; §13 (Task-API) ist der Ankerpunkt für alles, was Tasks und OOS-Kopplung betrifft.
