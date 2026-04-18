# Migrationsassistent OOS ⇄ APOS

**Status:** Architekturkonzept (noch nicht implementiert)
**Zielgruppe:** Entwickler:innen, die später mit dem Tool arbeiten oder es bauen
**Pflege:** Jede Änderung am Verfahren aktualisiert dieses Dokument. Es ist die einzige Referenz, bis ein eigenes Repo für das Tool steht.

---

## 1. Zielbild

OOS entwickelt sich kontinuierlich weiter. Viele UI-Muster, technische Standards und Feature-Ideen entstehen dort zuerst, weil es das operativ genutzte System ist. APOS soll von dieser Reife profitieren können — aber **nicht durch Copy-Paste und nicht durch automatische Spiegelung**.

Das Ziel ist ein **Migrationsassistent**, der eine kontrollierte Portierung zwischen den beiden getrennten Projekten ermöglicht: Analyse vorne, Bewertung in der Mitte, Patch-Vorschläge hinten. Kein Magic-Sync, sondern ein strukturierter Vorbereitungsschritt, der menschliche Entscheidung erhält.

### Warum kein Full-Sync

- **Verschiedene Domänen.** OOS ist operatives OS (Prozesse, Kanban, Rollen, Organisation). APOS ist Projekt-Engine (Meilensteine, Risiken, Budgets, Gewerke). Viele OOS-Features wären in APOS fremd — etwa das Jour-Fixe-Modul oder das Rollen-Onboarding. Full-Sync würde Ballast einschleppen.
- **Verschiedene Datenmodelle.** OOS hat `OperativeTask`, `OpsProject`, `Stelle`. APOS hat `Project`, künftig `WorkPackage`, `Risk`. Das gleiche UI-Konzept muss gegen unterschiedliche Backends arbeiten.
- **Verschiedene Lebenszyklen.** OOS ist Produktion, APOS ist Rohbau. Beide haben eigene Deploy-Zyklen, eigene DBs, eigene User-Basis.
- **Gemeinsame Semantik nur für Tasks.** Die bereits etablierte zentrale Task-API (siehe `docs/tasks-api.md` im OOS) ist die einzige echte Kopplung. Sie bleibt dünn.

### Warum kontrollierte Portierung

- Übernahme ist eine bewusste fachliche Entscheidung pro Feature.
- Der Assistent liefert **Transparenz** (was hängt zusammen?), **Bewertung** (lohnt sich die Portierung?) und **Vorbereitung** (konkrete Patch-Vorschläge), aber **nicht die Ausführung**.
- Der Mensch entscheidet final. Der Assistent verhindert Zufallsfehler und beschleunigt die handwerkliche Arbeit.

---

## 2. Grundprinzip

Der Assistent arbeitet in vier Phasen, die klar getrennt bleiben:

```
┌────────────┐   ┌────────────┐   ┌──────────────────┐   ┌─────────────────┐
│  ANALYSE   │ → │ VERGLEICH  │ → │ MIGRATIONS-      │ → │  PATCH /        │
│            │   │            │   │ VORBEREITUNG     │   │  EXPORT         │
└────────────┘   └────────────┘   └──────────────────┘   └─────────────────┘
  Was gibt es    Wie unter-       Was ist          Konkretes Artefakt
  im OOS?        scheidet sich    übernehmbar?     (Files, Patches,
                 APOS?            Was müsste       Migrations-Doc)
                                  angepasst
                                  werden?
```

Jede Phase ist ein eigener Modus, idempotent, ohne Seiteneffekte auf die Ziel-Codebasis. Erst der explizite Export-Schritt erzeugt Artefakte, die der Mensch reviewt und anwendet.

### Was der Assistent tut

- Scannt beide Codebasen (Read-only).
- Erkennt einzelne **Migrations-Einheiten** (ein Feature, eine Komponente, ein API-Modul).
- Findet deren Abhängigkeiten (Imports, Models, Provider, Rollen, Routes).
- Klassifiziert die Portierbarkeit gegen das Ziel-System.
- Erzeugt ein **Migrationsartefakt**: Bericht + Datei-Mapping + TODO-Liste + optionale Patch-Vorlage.

### Was der Assistent niemals tut

- Er committet oder pusht in das Ziel-Repo **nicht automatisch**.
- Er überschreibt bestehende APOS-Dateien nicht ohne expliziten Befehl.
- Er löscht nichts.
- Er synchronisiert keine Datenbanken.
- Er trifft keine fachlichen Entscheidungen („dieses Feature gehört nach APOS") — er bewertet nur Machbarkeit.
- Er kopiert keine Secrets oder `.env`-Werte.

---

## 3. Analyse-Ebenen

Der Assistent arbeitet feature-orientiert, aber über mehrere technische Schichten gleichzeitig. Jede Schicht hat eigene Erkennungs-Heuristiken.

| Ebene | Was wird erkannt | Wie |
|---|---|---|
| **UI-Komponenten** | React-Components unter `components/` | AST-Scan, Prop-Signaturen, JSX-Imports |
| **Seiten / Routen** | Next.js App-Router-Pages (`app/**/page.tsx`, `layout.tsx`, `route.ts`) | Pfad-basiert + Datei-Typ |
| **Hooks** | Custom Hooks (`useXxx`, in `hooks/` oder inline in Components) | Funktions-Export, Name-Konvention |
| **Services / Business-Logik** | Pures TypeScript in `lib/`, Service-Layer-Pattern | Export-Typen, Prisma-Usage |
| **API-Endpunkte** | `app/api/**/route.ts`, exportierte HTTP-Handler | Datei-Typ + Method-Exports |
| **Prisma-Models** | Models in `schema.prisma`, Relationen, Indizes | Prisma-AST |
| **Validierungslogik** | zod/yup-Schemas, eigene Guards | Import `zod` + Schema-Definition |
| **Utility-Funktionen** | reine Helpers in `lib/`, `utils/` | Pure Function, keine DB/IO |
| **Konfigurationen** | `tailwind.config`, `next.config`, `.eslintrc`, `CONVENTIONS.md` | Datei-Name |
| **Rollen- / Rechtekonzept** | `role`-Checks, Visibility-Helper, Middleware-Guards | Literal-Scan auf `"ADMIN"`, `"MANAGER"`, `isFK`, `canSee`, `canEdit` |
| **Designmuster / Layouts** | Card-Komponenten, Modal-Patterns, SlideOver, Dark-Mode-Klassen | Template-basierte Erkennung |
| **Feature-Flags** | `betaMode`, `hasOosAccess`, `hasAposAccess` | Feld-Namen + Usage |
| **Modul-Abhängigkeiten** | Import-Graph einer Einheit | Static analysis (ts-morph oder ähnlich) |

---

## 4. Klassifizierung der Portierbarkeit

Jede Migrations-Einheit bekommt einen `portabilityScore` und ein Label:

| Label | Score | Bedeutung |
|---|---|---|
| `direkt_portierbar` | 90–100 | Keine OOS-spezifischen Imports, Models, Routes. Datei kann 1:1 übernommen werden, nur Paketpfade anpassen. Typisch: `DatePicker`, `ThemeProvider`, `LightOnly`, isolierte Helpers. |
| `portierbar_mit_anpassungen` | 60–89 | Generische Logik, aber mit Ersetzungen. Z. B. Referenzen auf `OperativeTask` → APOS-eigenes `Task`-Äquivalent, oder Anpassung an zentrale Task-API. Liste konkreter Substitutionen wird geliefert. |
| `nur_als_vorlage` | 30–59 | Konzept und Struktur sind wertvoll, aber mindestens die Hälfte muss neu geschrieben werden. Typisch: OOS-spezifische Kanban-Logik, Jour-Fixe-Modul-Patterns. |
| `nicht_portierbar` | 0–29 | Feature ist OOS-spezifisch und hat in APOS keine Entsprechung (z. B. Unternehmenshandbuch, Onboarding-Rundgang, Zeiterfassung). Wird als solches dokumentiert, nicht migriert. |

Zusätzliche **Risiko-Flags**, die das Label schärfen:

- `db_schema_change` — Model-Änderung nötig
- `breaks_existing_apos_api` — Konflikt mit bestehendem APOS-Code
- `touches_auth` — betrifft NextAuth-Config oder Rechte-Check
- `requires_manual_review` — Mensch muss vor Patch drübersehen
- `cross_cutting` — Dark-Mode / i18n / Theme-Änderung — betrifft alle Surfaces
- `needs_data_migration` — braucht ein Backfill-Script in APOS-DB

---

## 5. Abhängigkeitsanalyse

Die Kopplung ans OOS ist der schwerste Teil. Der Assistent bewertet pro Datei:

### Harte Kopplungen (Rote Flaggen)

| Kopplung | Wie erkannt | Was der Assistent sagt |
|---|---|---|
| OOS-spezifisches Prisma-Model (z. B. `prisma.operativeTask`, `prisma.jourFixeItem`) | Literal-Scan | „Model-Ersetzung nötig — mappe auf APOS-Model X oder nutze Task-API" |
| OOS-Routen-Pfad (`/operativ/*`, `/organisation/*`) | Pfad-Scan | „Route existiert in APOS nicht — verwerfen oder auf anderen Pfad legen" |
| OOS-Rollen mit OOS-spezifischer Semantik (z. B. Stellen-Inhaber, Onboarding-Fortschritt) | Feld-Zugriff | „Konzept nicht in APOS-Schema vorhanden — neu modellieren oder verwerfen" |
| OOS-Provider-Context (z. B. `ZeiterfassungProvider`, `DevModeProvider`) | Import aus `components/zeiterfassung` etc. | „Context existiert in APOS nicht — verwerfen oder portieren inkl. Provider" |
| OOS-Auth-Session-Felder (`session.user.onboardingStatus`, `session.user.isExternal`) | Property-Access | „APOS-Session hat kein onboardingStatus — Logik anpassen oder entfernen" |
| Direkte DB-Queries gegen nicht-existente APOS-Tabellen | Prisma-Call-Analyse | „Tabelle X existiert in APOS nicht — Schema-Erweiterung nötig" |

### Weiche Kopplungen (Gelbe Flaggen)

- Utility-Import aus `@/lib/something` → Pfadanpassung nötig, aber trivial
- Icon-Import aus `lucide-react` mit OOS-gewöhnlichen Namen → direkt portierbar
- Tailwind-Klassen mit OOS-CSS-Variablen (`var(--sidebar-bg)`) → ggf. auch in APOS vorhanden, prüfen

### Entkopplungs-Vorschläge

Der Assistent geht nicht nur analysierend, sondern **schlägt aktiv vor**, wie entkoppelt werden kann:

- „OOS-spezifischer Hook `useTaskVisibility` → Parameter `ctx` statt global `useSession` — dann in APOS identisch einsetzbar"
- „Komponente `TaskCard` → Props-Interface erweitern um `status: string`, statt `KanbanStatus`-Enum zu importieren"
- „Service `lib/tasks/service.ts` → schon heute generisch genug, reiner Import-Pfad-Swap reicht"

---

## 6. Migrationsartefakte

Jeder Lauf produziert ein **Migrations-Dossier** als Set von Dateien:

```
migrations-out/
  <feature-slug>-<timestamp>/
    REPORT.md                  # Lesbarer Bericht für Menschen
    manifest.json              # Strukturiertes Artefakt für Agents/Tools
    file-mapping.tsv           # Quelle → Ziel, flach
    dependency-graph.json      # Was hängt woran?
    patches/
      <file1>.patch            # Diff-Format, bereit für `git apply`
      <file2>.patch
    TODOS.md                   # Was der Mensch manuell machen muss
    risks.md                   # Bekannte Stolperfallen
```

### Das `manifest.json`-Format (Spezifikation)

Einheitliches, versioniertes Format, damit andere Agents (z. B. ein LLM-Review-Agent) es konsumieren können:

```jsonc
{
  "manifestVersion": "1.0",
  "generatedAt": "2026-04-20T14:00:00Z",
  "feature": {
    "slug": "task-detail-slideover",
    "displayName": "Task-Detail-SlideOver",
    "description": "Slide-Over-Panel rechts zum Bearbeiten einer Task",
    "sourceRepo": "oos",
    "sourceCommit": "73ec73a",
    "targetRepo": "apos",
    "targetBranch": "main"
  },
  "portability": {
    "score": 72,
    "label": "portierbar_mit_anpassungen",
    "reasons": [
      "Nutzt OperativeTask-Model direkt — muss auf APOS-Task umgemappt werden",
      "DatePicker-Import bereits in APOS verfügbar",
      "Dark-Mode-Klassen sind bereits synchron"
    ]
  },
  "risks": [
    { "flag": "db_schema_change", "detail": "APOS hat kein `waitingReason`-Feld" },
    { "flag": "touches_auth", "detail": "Liest session.user.role für Edit-Recht" }
  ],
  "dependencies": {
    "imports": [
      { "from": "lucide-react", "status": "shared" },
      { "from": "@/components/ui/DatePicker", "status": "exists_in_target" },
      { "from": "@/lib/tasks/service", "status": "target_equivalent", "suggestion": "lib/tasks/service im APOS neu implementieren oder Task-API nutzen" }
    ],
    "models": [
      { "name": "OperativeTask", "action": "replace_with", "target": "Task", "note": "APOS nutzt vereinfachtes Task-Modell" }
    ],
    "routes": [],
    "providers": [
      { "name": "SessionProvider", "status": "exists_in_target" }
    ],
    "rolesUsed": ["ADMIN", "MANAGER"]
  },
  "files": {
    "toCreate": [
      "components/task/TaskDetailSlideOver.tsx",
      "components/task/TaskDetailHeader.tsx"
    ],
    "toEdit": [
      { "path": "lib/tasks/service.ts", "reason": "Funktionen ergänzen für SlideOver-Actions" }
    ],
    "notToMigrate": [
      { "path": "components/operativ/DelegationSection.tsx", "reason": "Delegations-Logik OOS-spezifisch (Staffelstab-Prinzip)" }
    ]
  },
  "patches": [
    { "file": "components/task/TaskDetailSlideOver.tsx", "patchFile": "patches/TaskDetailSlideOver.patch", "type": "new_file" }
  ],
  "migrationSteps": [
    "APOS-Schema: Feld `waitingReason String?` auf Task ergänzen + migrate",
    "Service-Layer: addTaskLink/changeStatus analog OOS implementieren",
    "Komponente patchen (Patch in patches/)",
    "Smoke-Test: Slide-Over öffnen, Status ändern, Assignment ändern",
    "PR-Review mit Dark-Mode-Check (siehe APOS CONVENTIONS.md)"
  ],
  "manualTodos": [
    "Delegations-Kopie-Logik aus OOS nicht übernehmen — APOS hat keine Delegations-Hierarchie",
    "Übersetzungen: OOS-Texte sind Deutsch, prüfen ob APOS auch nur Deutsch"
  ]
}
```

Das Format ist versioniert (`manifestVersion`), damit Tool-Evolutionen rückwärtskompatibel bleiben.

---

## 7. Technische Umsetzung

### Wo lebt das Tool?

**Empfehlung: eigenes kleines Repo oder Submodul**, nicht als Teil von OOS und nicht als Teil von APOS. Begründung:
- Es braucht Read-Zugriff auf beide Repos gleichzeitig → eigene Position sinnvoll.
- Es soll unabhängig versioniert werden, weil es mit beiden mitaltert.
- Es sollte von jedem Entwickler mit Zugriff auf beide Repos lokal ausführbar sein.

Arbeitsname: `apricus-migration-tool` (oder knapper: `amt`).

### CLI zuerst, UI später

**Phase 1 (v0.1):** Reine Node-CLI.
- Low Cost, schnell iterierbar
- Scripte laufen als Dev-Tool
- Output als Markdown + JSON → kann versioniert werden

**Phase 2 (optional, v0.2+):** Web-UI im APOS, Developer-only.
- Zeigt Features aus OOS als Liste
- Klick: Analyse läuft serverseitig, Artefakt wird gespeichert
- Commit/Push bleibt manuell

### Module

```
apricus-migration-tool/
├── src/
│   ├── bin/
│   │   └── amt.ts                  # CLI-Entrypoint
│   ├── scan/
│   │   ├── scanProject.ts          # Liest ein Repo ein (glob + AST)
│   │   ├── astParser.ts            # ts-morph / @typescript-eslint/parser Wrapper
│   │   ├── prismaParser.ts         # liest schema.prisma
│   │   └── featureDetector.ts      # gruppiert Dateien zu Features
│   ├── compare/
│   │   ├── dependencyGraph.ts      # baut Import-Graph
│   │   ├── modelDiff.ts            # vergleicht Prisma-Models
│   │   ├── routeDiff.ts            # vergleicht App-Router-Struktur
│   │   └── conventionCheck.ts      # CONVENTIONS.md Konformität
│   ├── evaluate/
│   │   ├── portabilityScorer.ts    # berechnet Score
│   │   ├── riskFlagger.ts          # setzt Flags
│   │   └── substitutionEngine.ts   # schlägt Ersetzungen vor
│   ├── prepare/
│   │   ├── patchGenerator.ts       # erzeugt unified diffs
│   │   ├── fileMapper.ts           # source → target Pfade
│   │   └── manifestBuilder.ts      # baut manifest.json
│   ├── export/
│   │   ├── reportWriter.ts         # schreibt REPORT.md
│   │   └── bundleWriter.ts         # legt migrations-out/<slug>/ an
│   ├── config/
│   │   ├── repoMap.ts              # Pfade zu OOS/APOS
│   │   └── conventions.ts          # gemeinsame Standards (Quelle: beider CONVENTIONS.md)
│   └── types/
│       └── manifest.ts             # TS-Typen zum manifest.json-Schema
├── tests/
│   └── fixtures/                   # Mini-Repos zum Testen
├── package.json
├── tsconfig.json
├── README.md
└── CONVENTIONS.md                  # gemeinsamer Standard-Kanon (siehe §8)
```

### CLI-Commands (Phase 1)

```bash
# Repos verknüpfen (einmalig)
amt link --oos /path/to/oos --apos /path/to/apos

# Analyse-Modus: listet Features
amt scan oos
amt scan apos

# Vergleichs-Modus: welche Features fehlen in APOS?
amt diff --source oos --target apos

# Feature auswählen und detailliert analysieren
amt analyze task-detail-slideover

# Migration vorbereiten (erzeugt Dossier in migrations-out/)
amt prepare task-detail-slideover

# Patches auf APOS anwenden (mit expliziter Bestätigung)
amt apply migrations-out/task-detail-slideover-20260420/ --dry-run
amt apply migrations-out/task-detail-slideover-20260420/ --commit
```

`apply --commit` ist die einzige Operation, die ins Ziel-Repo schreibt — und sie läuft nur mit explizitem Flag. `--dry-run` ist Default.

### Technologische Basis

- **Node / TypeScript** — weil beide Projekte TS sind, Tooling dort zuhause
- **ts-morph** für AST-Analyse (guter Kompromiss aus Power und Lesbarkeit)
- **prisma-schema-parser** für Schema-Vergleich
- **diff-match-patch** oder natives `git diff` für Patches
- **commander** oder **citty** für CLI
- **zod** für manifest.json-Validierung

Keine KI-APIs in Phase 1. Deterministische Regeln. LLM-Integration (Review-Agent, der das Manifest sichtet) wäre eine Phase-3-Option.

---

## 8. Gemeinsame Standards (vorab definieren)

Damit der Assistent überhaupt sinnvoll arbeiten kann, brauchen beide Projekte ein paar **bewusst angeglichene Konventionen**. Die sind das Fundament. Ohne die müssen wir jedes Feature manuell massieren.

### Konventionen, die JETZT synchronisiert werden sollten

| Bereich | Konvention | Status |
|---|---|---|
| **Statuswerte** | CoreStatus der zentralen Task-API: `draft \| open \| in_progress \| waiting \| blocked \| done \| cancelled` | ✓ dokumentiert in OOS `docs/tasks-api.md` |
| **Rollen** | `EMPLOYEE \| MANAGER \| ADMIN \| DEVELOPER` + Flags | ✓ in APOS übernommen |
| **Visibility-Scope** | `PRIVATE \| TEAM \| PROJECT \| ORG` | ✓ in OOS, zu übernehmen in APOS bei Task-Thema |
| **Dark-Mode-Klassen** | Light-first, `.light`-Wrapper-Override, globale Fallbacks | ✓ portiert nach APOS |
| **DatePicker** | Custom-Komponente statt native `<input type="date">` | ✓ portiert |
| **Service-Layer-Pattern** | API-Routes sind dünn, Logik in `lib/<domain>/service.ts` | ✓ in OOS, zu übernehmen in APOS |
| **Error-Format** | `{ error: "slug", message: "..." }` + HTTP-Code | ✓ OOS-Standard |
| **Prisma-Naming** | PascalCase, kein `Apos`/`Oos`-Präfix im standalone APOS | ✓ APOS bereinigt |

### Konventionen, die IN ZUKUNFT hinzukommen sollten

- **Feature-Ordnerstruktur**: jedes Feature liegt gebündelt (`components/<feature>/`, `lib/<feature>/`, `app/api/<feature>/`) — dann kann der Assistent das Feature als Einheit erkennen.
- **Export-Barrel** (`index.ts` pro Feature), der die öffentliche API eines Features definiert.
- **CONVENTIONS.md** in beiden Repos gleich strukturiert (Abschnitts-Überschriften identisch), damit `amt` Abweichungen automatisch flaggen kann.
- **JSDoc-Tags** für Metadaten: `@migration: portable | not-portable | depends-on(foo)` direkt am Code. Der Assistent liest diese Tags und gewichtet sie höher als seine Heuristik.

### Shared Core — bewusst KEIN gemeinsames Paket

Man könnte versucht sein, „gemeinsame Utilities" in ein `@shared/*`-Paket zu ziehen. **Das empfehle ich explizit nicht**, solange OOS und APOS getrennte Repos bleiben. Begründung:
- Sobald beide von einem gemeinsamen Paket abhängen, haben sie wieder Kopplung auf Modul-Ebene.
- Updates auf Shared führen zu synchronisierten Releases — das ist genau der Zustand, den wir vermeiden wollten.
- Besser: **Konventionen angleichen, Code dupliziert zulassen**. Der Migrationsassistent macht die Duplikation beherrschbar.

---

## 9. Grenzen und Guardrails

Die folgende Liste ist verbindlich für die Implementierung. Was hier steht, darf der Assistent auch auf Knopfdruck nicht tun.

- **Kein Auto-Commit.** Patches werden vorbereitet, nie automatisch committet.
- **Kein Auto-Push.** Remote-Operationen sind Sache des Menschen.
- **Keine DB-Operationen.** Das Tool schreibt nie in eine der beiden Datenbanken. Wenn eine Migration nötig ist, liefert es eine `prisma migrate`-SQL-Datei zum manuellen Anwenden.
- **Keine `.env`-Manipulation.** Secrets werden nicht gelesen, nicht übertragen, nicht kopiert.
- **Keine Löschung in APOS.** Wenn eine Datei in APOS durch eine migrierte ersetzt werden würde, wird das als Risiko geflagt und benötigt explizites `--allow-overwrite`.
- **Kein Schema-Merge ohne Review.** Prisma-Schema-Änderungen werden als separater Patch ausgewiesen und brauchen `--accept-schema-change`.
- **Keine blinde Vollmigration.** Es gibt kein `amt migrate-all`. Migrationen sind immer einzeln angestoßen.
- **Kein Abhängigkeits-Pull.** Wenn Feature A von Feature B abhängt und B fehlt im APOS, wird das gemeldet, nicht automatisch mitgezogen.

---

## 10. Beispielablauf

**Ausgangslage:** In OOS wurde die Komponente `TaskCard` verbessert — jetzt zeigt sie Projekt-Namen direkt neben dem Prioritätspunkt, mit Toggle-Persistenz. Diese Verbesserung soll in APOS übernommen werden.

**Schritt 1 — Feature scannen**
```
$ amt analyze task-card-project-display

▸ Feature erkannt: TaskCard mit showProject-Prop
▸ Quelldatei:       apps/oos/components/operativ/TaskCard.tsx
▸ Zusätzlich:       apps/oos/components/operativ/KanbanBoard.tsx (Prop-Durchreiche)
▸ API-Änderung:     app/api/operativ/tasks/route.ts (project in select)
▸ Schema-Änderung:  keine
▸ Test-Coverage:    keine (im OOS nicht vorhanden)
```

**Schritt 2 — Abhängigkeitsanalyse**
```
Dependencies:
  ✓  lucide-react                       (shared, beide installieren gleiche Version)
  ✓  React 19                           (shared)
  ⚠  @/lib/tasks/types                  (OOS-spezifisch, APOS hat kein equivalent)
  ⚠  task.processInstance.project       (OOS-Beziehung — APOS-Task müsste Projekt-Relation haben)
  ⚠  UserPreference "kanban-show-project" (OOS-Model)

Resolution-Vorschläge:
  - @/lib/tasks/types → im APOS lokaler Typ (oder Task-API-Response nutzen)
  - project-Relation → in APOS bereits vorhanden (Task hat kein direkter Projekt-Link, 
    aber über workPackageId → WorkPackage.projectId auflösbar)
  - UserPreference → APOS hat kein UserPreference-Model. Alternative: localStorage-only 
    Persistenz, oder UserPreference nachziehen (kleiner Schema-Patch).
```

**Schritt 3 — Portability-Score**
```
Score: 74 / 100
Label: portierbar_mit_anpassungen
Risiken: [db_schema_change (UserPreference oder localStorage-Entscheidung)]
```

**Schritt 4 — Dossier erzeugen**
```
$ amt prepare task-card-project-display

✓ migrations-out/task-card-project-display-20260420-1400/
  ├─ REPORT.md               (Mensch-Bericht, 3 Seiten)
  ├─ manifest.json           (Tool-Format)
  ├─ file-mapping.tsv
  ├─ patches/
  │   └─ TaskCard.patch      (neue Datei für APOS mit angepassten Imports)
  ├─ TODOS.md                
  │     ▸ Entscheidung treffen: UserPreference-Model einführen oder localStorage-only?
  │     ▸ project-Resolution prüfen: WorkPackage.projectId matched Erwartung?
  │     ▸ Dark-Mode-Check durchlaufen (siehe APOS CONVENTIONS.md)
  └─ risks.md
```

**Schritt 5 — Dry-Run**
```
$ amt apply migrations-out/task-card-project-display-... --dry-run

Would create: apos/components/task/TaskCard.tsx
Would create: apos/components/task/KanbanBoard.tsx
Would edit:   apos/lib/tasks/types.ts (+showProject prop type)
No destructive operations.
```

**Schritt 6 — Manuell committen**
Mensch reviewt, entscheidet für `localStorage-only`-Variante (vermeidet Schema-Change), passt den Patch an, wendet ihn an, committet manuell.

**Ergebnis:** Feature ist in APOS, APOS-Schema blieb sauber, Ursprung ist durch manifest.json nachvollziehbar.

---

## 11. Implementierungs-Plan (grob)

| Meilenstein | Inhalt | Aufwand grob |
|---|---|---|
| **M1 — Skeleton + repoMap + Scan** | CLI steht, kann beide Repos einlesen, listet Dateien strukturiert | 1–2 Tage |
| **M2 — Feature-Detector + Dependency-Graph** | Gruppiert Dateien zu Features, baut Import-Graph | 2–3 Tage |
| **M3 — Prisma-Diff + Route-Diff** | Schema- und Routenvergleich liefert strukturierte Unterschiede | 2 Tage |
| **M4 — Portability-Scorer + Risk-Flagger** | Regeln aus Abschnitt 4 + 5 als deterministischer Algorithmus | 2 Tage |
| **M5 — Patch-Generator + Manifest-Builder** | Erzeugt die Dossier-Struktur | 2 Tage |
| **M6 — apply-Command mit Safeguards** | Dry-Run, --commit, Overwrite-Schutz | 1 Tag |
| **M7 — Tests gegen Fixture-Repos** | Mini-Repos in `tests/fixtures/` für Regression | 1–2 Tage |

Gesamtumfang **ca. 10–14 Entwicklertage für v0.1**, nicht inkl. UI-Phase.

---

## 12. Offene strategische Entscheidungen

Vor Implementierungsstart sollten die folgenden Fragen beantwortet sein. Ich markiere je eine Empfehlung.

1. **Wo lebt das Tool?**
   Eigenes kleines Repo (`apricus-migration-tool`) / Submodul / oder als Ordner in APOS?
   → **Empfehlung:** eigenes Repo, weil es an beiden Projekten gleichzeitig arbeitet.

2. **Reicht CLI, oder brauchen wir gleich eine UI?**
   → **Empfehlung:** CLI zuerst (Phase 1), UI optional später.

3. **Wer soll das Tool bedienen?**
   Nur Entwickler oder auch PMs?
   → **Empfehlung:** Entwickler. PMs arbeiten mit dem Ergebnis-REPORT.md.

4. **Soll das Tool irgendwann LLM-gestützt werden** (z. B. natürlichsprachliche Feature-Beschreibungen erzeugen)?
   → **Empfehlung:** Erst deterministisch fertigstellen. LLM-Review als Phase-3-Erweiterung.

5. **Wie aggressiv automatisch ist die Patch-Generierung?**
   Nur „new file"-Patches (sichere Variante) oder auch Line-Edits in bestehenden Dateien?
   → **Empfehlung:** Start mit „new file only" + explizite Erwähnung der nötigen Edits in TODOS.md. Echte Line-Patches erst in v0.2.

6. **Welche Ebene ist die Migrations-Einheit — Datei, Komponente, Feature?**
   → **Empfehlung:** Feature (Cluster von Dateien). Einzel-Datei-Migration führt zu halbportierten Features.

7. **Soll das Tool in CI laufen, z. B. nachts einen Diff-Report erzeugen?**
   → **Empfehlung:** Ja, als read-only Nightly-Run. `amt diff` als GitHub-Action, Output als kommentierte Issue im APOS-Repo. Entwickler sieht morgens: „3 neue Features im OOS, 1 davon potentiell interessant für APOS".

8. **Soll der Assistent Konventions-Drift erkennen?**
   Z. B. wenn OOS-`CONVENTIONS.md` eine neue Regel bekommt, die APOS nicht hat?
   → **Empfehlung:** Ja, als Diff-Command: `amt conventions-diff` vergleicht beide `CONVENTIONS.md` und flaggt Abweichungen.

9. **Was passiert, wenn OOS und APOS dieselbe Datei (Name + Pfad) haben, aber mit unterschiedlichem Inhalt?**
   → **Empfehlung:** Konflikt-Modus. Der Assistent zeigt beide Versionen side-by-side und lässt den User wählen. Auto-Merge nie.

10. **Versionierung der manifest.json-Schema.**
    → **Empfehlung:** `manifestVersion` im Root, streng Semver. Alle Tools, die Manifests lesen (auch zukünftige LLM-Agents), müssen die Version checken.

---

## 13. Zusammenfassung

Der Migrationsassistent ist **kein Sync-Tool**, sondern ein **Vorbereitungs-Tool**. Er macht Arbeit sichtbar, bewertet Machbarkeit, bereitet Patches vor — aber die endgültige Entscheidung und Ausführung bleibt beim Menschen.

Drei Kernprinzipien:
1. **Analyse und Ausführung sind getrennt.** Kein unbeaufsichtigtes Schreiben ins Ziel.
2. **Portierbarkeit ist eine Skala, keine Binär-Aussage.** Der Assistent klassifiziert und begründet.
3. **Gemeinsame Standards schlagen gemeinsamen Code.** Besser doppelte Komponenten mit gleicher API als ein Shared-Package, das beide Projekte wieder verkettet.

Mit diesem Assistenten wird jede Portierung ein 30-Minuten-Job statt ein halbtägiger Bastel-Akt — und vor allem: nachvollziehbar.

---

## Pflegeabkommen

Änderungen am Migrationsprozess (neue Analyse-Ebene, neuer Risk-Flag, neues Feld im manifest.json) aktualisieren dieses Dokument im selben Commit. Das Dokument ist die Referenz, auf die sich alle Implementierungsschritte beziehen.
