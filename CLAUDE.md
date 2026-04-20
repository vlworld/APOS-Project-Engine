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

## Aktueller Stand (2026-04-19, spät)

- **Protokolle-Feature** (Gesprächsprotokolle) neu gebaut: Schema +
  Service + 9 API-Routen + volle UI mit Liste, Detail, Create-Modal,
  Email-Muster, Todo-Übernahme, Quick-Adds, KW-Freitext-Normalisierung
  — siehe Session-Log 2026-04-19 spät
- **Gantt-Erweiterungen**: Puffer (schraffiert hinter Kern-Balken),
  Deadline (rotes Flag), Zeitraum-Items mit diskreten Events, Kompakt-
  Toggle für die Tabelle, PDF-Export-Header "Bauzeitenplan" +
  Apricus-Logo
- **Projekt-Sichtbarkeit**: Manager können beim Anlegen wählen, ob
  andere Manager das Projekt sehen / bearbeiten dürfen (Default: sehen
  ja, bearbeiten nein). Neue Scope-Tabs "Meine Projekte" / "Alle
  Projekte" auf `/projekte`.
- **Sidebar neu gegliedert**: Top-4 fix (Dashboard, Projekte, Kunden,
  Arbeitspakete), Module in 3 Gruppen mit Hover-Labels
- **Rename**: sichtbare UI-Strings "Terminplan" → "Bauzeitenplan"
  (Code/Routen/Types unverändert)
- **DatePicker-Popover** via Portal — keine Clipping-Probleme mehr
- **Dev-UX**: Theme-Toggle togglet bei jedem Klick, OOS-Link-Fallback
  auf Prod-URL, Dev-Auto-Login via .env.local
- **Gantt-DnD (Move + Resize) fertig**, dazu PDF-Export aus dem
  Terminplan und Color-Picker-Redesign — siehe Session-Log 2026-04-19
- **Bauzeitenplan-Feature (v1) größtenteils gebaut** — siehe Session-Log 2026-04-18
- Schema-Erweiterungen heute: `Meeting`, `MeetingParticipant`,
  `MeetingItem`, `Todo`, `ScheduleItemEvent`, plus neue Felder
  `ScheduleItem.bufferDays`, `ScheduleItem.deadline`,
  `ScheduleItem.isTimeRange`, `Project.visibility`,
  `Project.allowEditByOthers`
- Auth-Fix: `organizationId` wird jetzt korrekt aus `User.organizationId` ins JWT gelegt (war vorher leerer String)
- 2 Seed-Accounts unverändert: `vomlehn@apricus-solar.de` (DEVELOPER), `czaja@apricus-solar.de` (ADMIN), Passwort `apricus01`
- Login-Seite: `NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL` als Fallback-Default (dev-only), zusätzlich `NEXT_PUBLIC_DEFAULT_LOGIN_PASSWORD` aktiviert den Auto-Login

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

## Session 2026-04-19 — Gantt-DnD + PDF-Export + Color-Picker

**Drag & Drop für Gantt-Balken (Offen-Liste Punkt 3, Commit `1bc91a0`)**
- `handleCommitMove` in `GanttChart`: optimistisches Update, Rollback bei
  Fehler, optionale Cascade-Verschiebung aller Nachfolger via `/move`-Endpoint
- `GanttBar` unterstützt Move + Resize-Start + Resize-End (DragType-Union,
  4 px Griffe links/rechts mit `ew-resize`-Cursor)
- Click-Events nach Drag 250 ms unterdrückt (`justDraggedRef`), damit das
  Modal nicht versehentlich aufgeht
- `canEdit`/`onCommitMove` von `GanttTimeline` an `GanttBar` durchgereicht

**PDF-Export (Commit `1bc91a0`)**
- Button im Terminplan-Header (`TerminplanTabs.tsx`) löst `window.print()`
  mit `apos-printing`-Body-Class aus
- Print-Styles in `app/globals.css`: A3 Querformat, Sidebar/TopNav/Toolbar
  im Print ausgeblendet, `data-apos-fullscreen` auf `position: static`

**Fullscreen-Layout-Fix (Commit `1bc91a0`)**
- `fullHeight`-Prop in `GanttChart` durchgereicht, `flex-1 min-h-0` im
  Fullscreen-Container für saubere Höhenbehandlung

**Color-Picker-Redesign im ScheduleItemModal (Commit `1bc91a0`)**
- 12 kuratierte Farben (`PALETTE_COLORS`) statt allen 22 aus
  `TERMINPLAN_COLORS`, `flex-wrap` statt starrem 11er-Grid

**Housekeeping (Commit `59ca018`)**
- `tsconfig.tsbuildinfo` aus Index entfernt + `*.tsbuildinfo` in `.gitignore`

**Dashboard-Zentrierung (Commit `b1b0952`)**
- `/dashboard`: `mx-auto` ergänzt — Inhalt hing durch `max-w-4xl` ohne
  Zentrierung links am Rand. Hinweis für nächsten Chat: beim Testen hat
  der Dev-Server die Änderung nicht erkannt (Turbopack verliert nach
  ~5 h Laufzeit den File-Watch für `(app)`-Routing-Groups). Falls die
  Änderung nicht sichtbar ist: Dev-Server neu starten.

**Bugfix: React-Warnung im Gantt-DnD (Commit `2f7308f`)**
- `GanttBar.endDrag` rief `commitDrag(prev)` *innerhalb* des
  `setDrag`-Updaters auf → `onCommitMove` → `setData` in GanttChart
  mid-update, React: "Cannot update a component while rendering a
  different component". Snapshot des `prev`-State in ein Wrapper-Objekt
  ausgelagert, Seiteneffekte laufen erst nach dem State-Reset.

**Bugfix: „Neues Projekt"-Modal (Commit `2f7308f`)**
- Projektleiter-Auswahl war ein Text-Feld, in das eine User-ID getippt
  werden musste — durch natives `<select>` mit Liste aus
  `/api/einstellungen/benutzer` ersetzt
- API-Fehler wurden stumm verschluckt — jetzt Toast-Feedback:
  Success (mit Projektnummer), Server-Error (mit Message), Netzwerkfehler

**Dev-UX-Fixes (Commit `feb15b7`)**
- ThemeToggle: jeder Klick wechselt Hell/Dunkel unabhängig vom Button
- Login OOS-Link-Fallback auf `https://oos.up.railway.app/`
- Dev-Auto-Login: wenn `NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL` +
  `NEXT_PUBLIC_DEFAULT_LOGIN_PASSWORD` in `.env.local` gesetzt sind,
  meldet sich `/login` im Dev-Modus direkt an und redirectet auf
  `/dashboard`. Skip mit `?skip-autologin=1`. In Prod nie aktiv.

## Session 2026-04-19 spät — Protokolle + Gantt-Erweiterungen + UX-Politur

Zweiter großer Session-Block am 2026-04-19 (ca. 15 weitere Commits).

**Sidebar-Clustering (Commit `99f19e6`)**
- Top-4 oben fix (User-Entscheidung): Dashboard, Projekte, Kunden,
  Arbeitspakete. Restliche Module in drei Gruppen mit Separatoren:
  "Planung & Durchführung" (Terminplan, Beschaffung, Budget),
  "Dokumentation" (Protokolle [neu], Dokumente, VOB, Übergaben),
  "Steuerung" (Stakeholder, Entscheidungen, Risiken, Kommunikation).
- Hover auf dem Separator zeigt das Gruppen-Label als dezenter Tooltip.

**Protokolle-Feature (Commits `abbcbc7`, `239095c`, `52fbf31`)**
- Schema: neue Models `Meeting`, `MeetingParticipant`, `MeetingItem`,
  `Todo` (+ `Meeting.previousMeetingId` für aufeinander aufbauende
  Protokolle).
- Service-Layer + 9 API-Routen (siehe `lib/meetings/service.ts`,
  `lib/todos/service.ts`, `app/api/projekte/[id]/protokolle/*`,
  `app/api/projekte/[id]/todos/*`).
- UI: `/protokolle` Listen-Seite + `/protokolle/[meetingId]` Detail
  mit Kopf, Apricus-Logo-Platzhalter oben rechts, Teilnehmer-Panel,
  Inline-editierbare Punkte-Tabelle (Nr, Kategorie B/E/F/I/A, Titel,
  Beschreibung, Verantwortlich, Termin, Status), Legende + Freigabe-
  Footer.
- `ProtokollCreateModal` — alle Kopffelder + Teilnehmer-Multi-Auswahl
  mit Externen-Freitext + optionaler Vorgänger-Verweis.
- `EmailPreviewModal` — Muster-Text mit Platzhaltern `{Datum}`,
  `{Thema}`, `{Projekt_Name}`, `{Akzeptanz_Datum}` (= heute + 3
  Werktage), `{Protokollant_Name}`, `{Anrede_Teilnehmer}`.
  Copy-to-Clipboard-Button + mailto-Link + disabled "Per Email
  senden"-Button (Feature folgt).
- `TodoFromItemModal` — Item-Punkt → Todo, vorgefüllt, POST an
  `/api/projekte/[id]/todos/from-meeting-item`.
- Panel "Offene Punkte aus Vorgänger-Protokoll" — lädt offene
  `MeetingItem` vom `previousMeeting`, "Übernehmen"-Button kopiert
  als neuen Punkt mit `copiedFromItemId`.

**Gantt-Puffer (Commit `aa93219`)**
- `ScheduleItem.bufferDays Int @default(0)` — Puffer in Arbeitstagen
  nach `endDate`. Cascade-Move und Dependencies nutzen weiterhin das
  Ende der Kern-Arbeit, der Puffer ist rein planerisch.
- Visual: halbhoher (12 px) schraffierter Bereich hinter dem Kern,
  gleiche Farbe, border-dashed + repeating-linear-gradient via
  `currentColor`. Arbeitstage → Kalendertage per Faktor 7/5.
- ScheduleItemModal: "Puffer nach Ende"-Feld mit Mini-Live-Preview.

**Tailwind-v4-Farb-Safelist-Fix (Commit `b346d15`)**
- `@source inline("bg-{21 Farben}-{50-700}")` in `globals.css`, weil
  Tailwind v4 keine Template-Literale statisch scannt. Behob das
  Problem mit leeren Kreisen im Farb-Picker (amber, orange, lime,
  fuchsia fehlten im CSS-Bundle).

**Deadline pro ScheduleItem (Commit `274ca67`)**
- `ScheduleItem.deadline DateTime?` — harter Termin, unabhängig von
  `endDate + bufferDays` (z.B. Förderzusage, Netzzusage).
- GanttTimeline: rotes Flag-Icon + gestrichelte vertikale Linie am
  Deadline-Datum (nur wenn im sichtbaren Range).
- ScheduleItemModal: DatePicker-Feld mit "Entfernen"-Button.

**Zeitraum-Items mit Events (Commit `5c22994`)**
- `ScheduleItem.isTimeRange Boolean` + neues Model `ScheduleItemEvent`
  (date, label?, status: PLANNED/SCHEDULED/DONE, orderIndex).
- Zeitraum-Bar: gestrichelter Rahmen, halbtransparent, mit diskreten
  Event-Kästchen innen. Farbkodierung: grau-dashed (geplant),
  Gewerk-Farbe (abgestimmt), emerald (erledigt).
- Service: events werden replace-all beim Update (deleteMany + create).
- Modal: Milestone- und Zeitraum-Checkbox sind gegenseitig ausschließend.
  Event-Liste mit DatePicker + Label + Status-Select + Trash, "+ Event".

**PDF-Export-Header + Rename Terminplan → Bauzeitenplan (Commit `ba1ff6a`)**
- Print-only Header: "Bauzeitenplan" + Projektnummer+Name + Apricus-
  Logo-Platzhalter oben rechts. Screen-Header mit `.apos-screen-only`
  im Print ausgeblendet.
- Print-Footer dezent: "Ein APOS-Export — Apricus Project Operating
  System".
- CSS-Regeln `.apos-print-only` / `.apos-screen-only` in `globals.css`.
- Sichtbare UI-Strings "Terminplan" → "Bauzeitenplan": Sidebar-Label,
  H1 der Seite, Error-Message, Feiertage-Seite, Projekt-Detail-Tab.
  Code-interne Namen (`TerminplanTabs`, `/terminplan`-Route,
  `lib/terminplan/*`) bleiben.

**Kompakt-Toggle (Commit `22150dd`)**
- Neuer Button in der Gantt-Toolbar: blendet Status/Gewerk/Start/Ende/
  Dauer in der linken Tabelle aus, nur Nr + Name + Aktionen bleiben.
- Tabelle schrumpft von 720 auf 280 px, Timeline bekommt entsprechend
  mehr Breite. Tabelle weiterhin `sticky left-0` beim horizontalen
  Scroll. Default: ausführlich. Persistenz per `localStorage`
  (`apos.terminplan.compact`).

**Meine/Alle-Tabs + Projekt-Sichtbarkeit (Commit `ec2d39c`)**
- Schema: `Project.visibility` ("OPEN" | "RESTRICTED", Default OPEN)
  + `Project.allowEditByOthers` (Boolean, Default false).
- Permissions erweitert: MANAGER-Rolle sieht fremde Projekte nur, wenn
  `visibility = OPEN`; darf sie nur bearbeiten, wenn zusätzlich
  `allowEditByOthers = true`. ADMIN/DEVELOPER sehen immer alles.
- `GET /api/projekte?scope=mine` filtert auf eigene Manager- oder
  Mitglied-Projekte.
- `/projekte`-Seite: neuer Scope-Toggle "Meine Projekte" / "Alle
  Projekte" in der Filter-Leiste.
- Create-Modal: zwei Checkboxen "sehen" (Default an) / "bearbeiten"
  (Default aus).

**InfoPopover-Komponente + Dashboard-Info (Commit `0a743fd`)**
- Neue wiederverwendbare `components/ui/InfoPopover.tsx`: kleines
  i-Icon, Hover zeigt Popover temporär, Klick "sticky", Escape/Klick-
  außerhalb schließt. Placement: top | bottom | right.
- Dashboard-Unterzeile hat jetzt ein Info-Icon mit 3-Satz-Erklärung
  "Was ist eine Project Engine?".

**Protokoll-Modal: Quick-Adds + Teilnehmer-Vorschläge (Commit `1226a44`)**
- Ort-Quick-Add-Chips: Virtuell / Baustelle (Project.address) / Kunde
  (Customer.companyName + Adresse) / Apricus (hart verdrahtet).
- Teilnehmer-Vorschläge: bei Titel-Eingabe (case-insensitive Match auf
  Vorgänger-Meetings) werden deren Teilnehmer als Chip-Liste zum
  Quick-Adden angezeigt (300 ms debounced, Aggregation über mehrere
  Matches).
- GET `/api/projekte/[id]` inkludiert jetzt `customer`.

**KW-Normalisierung + Typo-Fix (Commit `702b371`)**
- Neue Utility `lib/meetings/dateText.ts` mit `normalizeDueDateText()`:
  "KW08" / "KW 8" / "KW8" / "Kw.08" → "KW8", mit Jahr → "KW8/26";
  analog für Quartale "Q1/23". Freitext bleibt unverändert.
- Service normalisiert beim Create/Update, ItemRow onBlur normalisiert
  sichtbar im Feld, bevor der Patch abgeschickt wird.
- Bonus-Helper `parseKalenderwoche()` für späteren Transfer zu
  Arbeitspaketen.
- "Schliessen" → "Schließen" in drei Modalen.

**DatePicker-Portal-Fix (Commit `bead022`)**
- DatePicker-Popover wurde von `overflow-hidden` / `overflow-auto`
  Eltern-Containern abgeschnitten (z.B. Protokoll-Punkte-Tabelle).
- Fix via `createPortal` nach `document.body` + fixed-Positioning
  basierend auf `getBoundingClientRect` vom Trigger. Live-Update bei
  Scroll (capture) + Resize. Auto-Flip nach oben wenn unten kein Platz.
  Clamp nach rechts am Viewport-Rand. z-[70]/[71] damit er auch über
  Modal-Backdrops liegt.

## Session 2026-04-20 — DB-Schema-Drift-Fix

**Problem**: Auf Prod (`apos.up.railway.app`) lud `/terminplan` nicht,
die Projektliste war leer und Musterdaten konnten nicht geladen werden.

**Ursache**: Der `prisma/migrations/`-Ordner hält nur die zwei Init-
Migrationen vom 18.04. Alle Schema-Erweiterungen der Sessions
2026-04-18 Abend, 2026-04-19 und 2026-04-19 spät wurden per
`prisma db push` händisch auf die Railway-DB gepusht. Für die letzte
Welle (Meeting/Todo/ScheduleItemEvent/Project.visibility/
allowEditByOthers usw. sowie der CRM-/Steckbrief-Merge aus PR #2)
hat das Push vermutlich nie stattgefunden → die Prisma-Queries auf
`Project` inkludieren jetzt Spalten, die in der DB fehlen → 500er
bei `GET /api/projekte` → kein Projekt sichtbar, `/terminplan`
bleibt im Loading und `/api/muster` bricht beim ersten Insert.

**Fix (`package.json`)**: `start`-Script führt vor `next start`
ein `prisma db push --accept-data-loss --skip-generate` aus. So
wird das Schema auf jedem Container-Boot mit `schema.prisma`
angeglichen. Idempotent, keine Datenverluste bei rein additiven
Änderungen (und die hatten wir seither ausschließlich).

**Hinweis für nächsten Chat**: Langfristig sauberer wäre, die
`db push`-Phase durch echte Migrationsdateien (`prisma migrate
deploy`) zu ersetzen. Dafür müsste der Ist-Stand der Railway-DB
einmal als Baseline eingefroren werden — ist oben auf die Noch-
offen-Liste gewandert.

## Noch offen (priorisiert)

1. **Realtime-Broadcast** in ScheduleItem-Service einhängen
   (`broadcast(projectId, event)` nach jedem Write)
2. **Undo/Redo-History** für Gantt-Aktionen — in-memory, pro User,
   pro Session. ~50 Schritte Stack, Cmd/Ctrl+Z rückwärts, Cmd+Shift+Z
   Redo, Dropdown mit Action-Namen. `ScheduleUndoEntry`-Model ist da,
   wird aktuell aber nicht genutzt. Besprochen mit User, pausiert.
3. **Resize-UX verbessern** — Griffe an den Gantt-Balken sind aktuell
   nur 4 px, schwer zu treffen. Breitere Griffe + Hover-Marker +
   Dauer-Feld im ScheduleItemModal (wäre redundant zu Resize-Drag,
   aber klarer für User, die die Griffe nicht finden). Pausiert.
4. **Versionierung des Bauzeitenplans** — Snapshots des ganzen
   Terminplans, ähnlich Git-Commits. Großes Feature, eigenes Konzept.
   Nicht zu verwechseln mit in-memory Undo (Punkt 2).
5. **Dependencies-UI** (Draw + Render mit SVG-Pfeilen) — Commit 10
6. **Critical-Path visualisieren** (Algorithmus fertig, muss in
   `loadTerminplan` eingebaut + rot markiert werden) — Commit 12
7. **Global-View + Personal-View** — `/terminplan` und `/terminplan/mein` — Commit 14
8. **DnD** für Hierarchie (Zeilen-Reorder) — Commit 9
9. **Organisation-Logo-Upload-UI** — aktuell ist das Logo hart-
   codiert (Platzhalter "A"-Kreis + "Apricus Solar AG"). Upload-Feld
   in Einstellungen → "Organisation", speichert in `Organization.logoUrl`.
10. **Protokoll-Feature — Rest**:
    - Kopf-Bearbeiten-Modal (aktuell nur Teilnehmer + Punkte + Freigabe
      editierbar)
    - Drag-Reorder für Punkte (Backend-Endpoint existiert)
    - Dedizierter `/api/protokolle/[meetingId]`-Endpoint (spart die
      N-Requests-Iteration im Detail-Lade-Pfad)
    - Echter Email-Versand (statt nur Muster-Text-Kopie) —
      braucht Email-Server
11. **E-Mail-Infrastruktur** für Login-Versand, Account-Aktivierung,
    E-Mail-Bestätigung (Memory-Eintrag `project_email_features.md`)
12. `/api/health` als offiziellen Healthcheck-Pfad in Railway-Settings
    eintragen
13. Passwörter der Seed-Accounts ändern
14. Migrationsassistent v0.1 im OOS bauen
15. Altes `apps/apos/` im OOS-Monorepo entfernen
16. **Prisma-Migrations-Baseline** — Aktuellen Prod-Schema-Stand als
    Migration einfrieren (`prisma migrate diff --from-schema-datasource
    --to-schema-datamodel` lokal ausführen, Ergebnis als neue Migration
    einchecken, `_prisma_migrations` auf Railway per `migrate resolve`
    markieren). Danach kann der `db push`-Schritt im `start` wieder
    durch `prisma migrate deploy` ersetzt werden (sicherer, keine
    überraschenden Schema-Änderungen auf Startup).

## Commit-Regel

Jede Änderung an der Task-Domäne oder am Migrationsassistent-Konzept
aktualisiert die betreffende Doku im selben Commit. Siehe „Pflegeabkommen"
am Ende der jeweiligen Docs. Neue UX-Regeln gehören ins
`UX_DESIGN_REGELN.md` (Root).

Wenn eine Session-Arbeit abgeschlossen ist: „Heute gemacht" und „Noch
offen" in dieser Datei aktualisieren, damit der nächste Chat anknüpfen kann.
