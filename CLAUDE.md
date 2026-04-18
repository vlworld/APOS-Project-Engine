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

## Aktueller Stand (2026-04-18, Abend)

- **Bauzeitenplan-Feature (v1) größtenteils gebaut** — siehe Session-Log unten
- Schema erweitert: `TradeCategory`, `ScheduleItem`, `ScheduleDependency`, `Holiday`, `ProjectMember`, `ScheduleUndoEntry`, plus `Project.isSample` und `Holiday.isSample`
- Auth-Fix: `organizationId` wird jetzt korrekt aus `User.organizationId` ins JWT gelegt (war vorher leerer String)
- 2 Seed-Accounts unverändert: `vomlehn@apricus-solar.de` (DEVELOPER), `czaja@apricus-solar.de` (ADMIN), Passwort `apricus01`
- Login-Seite: `NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL` als Fallback-Default (dev-only), wird durch localStorage überschrieben

## Session 2026-04-18 Abend — Bauzeitenplan v1

Parallel-Attacke mit 6 Agenten + Main-Thread:

**Schema + Migration**
- Prisma-Schema um 6 neue Models erweitert, via `db push` auf Railway-DB angewendet
- Auth-Fix für organizationId (`lib/auth.ts`)

**UX-Grundbausteine (Commit 2)**
- `ConfirmDialog` — ersetzt `window.confirm`, Escape/Click-outside/Enter handhabend
- `Toast` + `ToastProvider` — unten rechts, dunkel, Hover-Pause, Portal
- `UndoButton` — diskret, 8s TTL, Cmd/Ctrl+Z-Hotkey
- `ToastProvider` in `app/layout.tsx` gemountet

**Algorithmik (rein funktional, keine DB)**
- `lib/terminplan/workdays.ts` — Arbeitstage Mo-Fr minus Holidays, `addWorkdays`, `countWorkdays`
- `lib/terminplan/time.ts` — ISO-Wochen, Timeline-Range, Columns (DAY/WEEK/MONTH), Pixel↔Tag-Umrechnung
- `lib/terminplan/critical-path.ts` — CPM mit Forward/Backward-Pass, Zyklen-Erkennung
- `lib/terminplan/samples.ts` — 12 Gewerke, NRW-Feiertage 2025-2027, Muster-PV-Projekt „Nottuln" mit 38 Items in 4 Phasen

**Permissions (lib/projekte/permissions.ts)**
- Projekt-Manager + ADMIN + DEVELOPER = volle Rechte
- MANAGER = lesen in eigener Org
- `ProjectMember.role = WRITE` = Schreibrecht für einzelne Projekte
- `requireProjectAccess(user, projectId, "read"|"write")` für API-Routes

**CRUD-Features mit Service + API + UI**
- Gewerke (Commit 3): `/einstellungen/gewerke` + TradeCategory CRUD
- Feiertage (Commit 4): `/einstellungen/feiertage` + Holiday CRUD mit deutscher Datumsanzeige
- ProjectMembers (Commit 5): `components/projekte/ProjectMembersPanel.tsx` + API unter `/api/projekte/[id]/mitglieder`
- ScheduleItem (Commit 6): Service (1082 Zeilen) mit Cascade-Move, WBS-Nummerierung, Derived-Fields
- API-Routen: GET/POST/PATCH/DELETE + `/move`, `/reorder`, `/dependencies`

**Gantt-Tabs (Commit 7)**
- `TerminplanTabs.tsx` — schaltet zwischen Gantt und Kalender, localStorage-persistiert
- `CalendarView.tsx` — Monats-/Wochen-Kalender mit Events pro Tag, Klick auf Tag öffnet Deadline-Modal
- `CalendarCell.tsx` — Tages-Zelle mit bis zu 3 Events, Heute-Badge, Wochenend-Shading
- `DeadlineModal.tsx` — schnelle Deadline-Erfassung (Milestone am Tag)
- Gantt-UI-Komponenten (read-only): läuft noch / siehe `components/terminplan/*`

**Realtime (Commit 13)**
- `lib/terminplan/realtime.ts` — In-Memory-PubSub
- `app/api/projekte/[id]/terminplan/stream/route.ts` — SSE-Endpoint mit Heartbeat
- `lib/terminplan/useRealtime.ts` — Client-Hook mit Exponential-Backoff

**Musterdaten-Toggle**
- `/einstellungen/muster` — Ein-Klick-Toggle lädt/entfernt Muster-Daten
- `/api/muster` — GET/POST/DELETE für Status/Apply/Remove
- `lib/muster/service.ts` — sampling-Logik, markiert alles mit `isSample=true`

**Sidebar-Update**
- Icon für Terminplan: `Calendar` → `GanttChart` (semantisch passender)
- Neue Sektion „Einstellungen" unten: Briefcase (Gewerke), CalendarCheck (Feiertage), FlaskConical (Musterdaten)

## Noch offen (priorisiert)

1. **Gantt-UI-Integration** abschließen (Agent K läuft noch)
2. **Realtime-Broadcast** in ScheduleItem-Service einhängen (`broadcast(projectId, event)` nach jedem Write)
3. **DnD** für Gantt-Balken (Move + Resize) — Commit 8
4. **DnD** für Hierarchie (Zeilen-Reorder) — Commit 9
5. **Dependencies-UI** (Draw + Render mit SVG-Pfeilen) — Commit 10
6. **Critical-Path visualisieren** (Algorithmus fertig, muss in `loadTerminplan` eingebaut + rot markiert werden) — Commit 12
7. **Global-View + Personal-View** — `/terminplan` und `/terminplan/mein` — Commit 14
8. **Undo** für Gantt-Aktionen (`ScheduleUndoEntry`-Model ist da) — Commit 15
9. `/api/health` als offiziellen Healthcheck-Pfad in Railway-Settings eintragen
10. Passwörter der Seed-Accounts ändern
11. Migrationsassistent v0.1 im OOS bauen
12. Altes `apps/apos/` im OOS-Monorepo entfernen

## Commit-Regel

Jede Änderung an der Task-Domäne oder am Migrationsassistent-Konzept
aktualisiert die betreffende Doku im selben Commit. Siehe „Pflegeabkommen"
am Ende der jeweiligen Docs. Neue UX-Regeln gehören ins
`UX_DESIGN_REGELN.md` (Root).

Wenn eine Session-Arbeit abgeschlossen ist: „Heute gemacht" und „Noch
offen" in dieser Datei aktualisieren, damit der nächste Chat anknüpfen kann.
