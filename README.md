# APOS — Apricus Project Operating System

APOS ist die Projekt-Steuerungs-Engine der Apricus-Plattform. Während OOS (Organisation Operating System) die Unternehmensorganisation, Operative, Personal und Wissen managt, ist APOS spezialisiert auf **Bauprojekt-Management**: Arbeitspakete, Terminpläne, VOB-Nachträge, Budget, Beschaffung, Risiken, Stakeholder, Übergabeprotokolle.

APOS und OOS sind komplementäre Systeme. APOS ist dabei so ausgelegt, dass es perspektivisch **operative Aufgaben aus OOS über dessen Task-API konsumiert** — ein Projekt in APOS wird zu einem koordinierten Arbeitsauftrag im OOS-Operativsystem.

> **Status: Skeleton / Grundgerüst — nicht produktionsreif.**  
> Das Projekt ist aus dem Monorepo extrahiert und bereinigt. Alle Pages und API-Routen existieren, die Datenbank-Integration ist mit dem minimalen Schema teilweise implementiert. Sub-Modelle (Arbeitspakete, Risiken, etc.) sind als TODOs markiert und müssen mit dem eigenen DB-Schema ausgebaut werden.

---

## Starten

### 1. Voraussetzungen

- Node.js 20+
- PostgreSQL (lokal oder via Docker)
- `npm` (kein pnpm, kein workspace)

### 2. Einrichtung

```bash
# Repository klonen / in den Ordner wechseln
cd apos-standalone

# Dependencies installieren
npm install

# Prisma-Client generieren
npm run db:generate

# .env anlegen (Vorlage: .env.example)
cp .env.example .env
# Dann .env anpassen: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
```

### 3. Datenbank initialisieren

```bash
# Migrations ausführen (erstmalig oder bei Schema-Änderungen)
npm run db:migrate

# Optional: Prisma Studio zur DB-Einsicht
npm run db:studio
```

### 4. Dev-Server starten

```bash
npm run dev
# APOS läuft auf http://localhost:3001
# OOS (falls aktiv) läuft auf http://localhost:3000
```

---

## Projektstruktur

```
apos-standalone/
├── app/
│   ├── layout.tsx                Root-Layout mit Dark-Mode-Bootstrap + SessionProvider
│   ├── page.tsx                  Landing → redirect /dashboard oder /login
│   ├── globals.css               Tailwind v4 + Dark-Mode-Fallbacks (portiert von OOS)
│   ├── login/page.tsx            Login-Seite (immer hell, via LightOnly)
│   ├── (app)/
│   │   ├── layout.tsx            Auth-Guard + AppShell
│   │   ├── dashboard/page.tsx
│   │   ├── projekte/             Projektliste + Detailseite
│   │   ├── arbeitspakete/        WBS-Hierarchie
│   │   ├── terminplan/           Terminplanung
│   │   ├── vob/                  VOB-Nachträge
│   │   ├── budget/               Budget-Tracking
│   │   ├── beschaffung/          Beschaffungsvorgänge
│   │   ├── stakeholder/          Stakeholder-Verwaltung
│   │   ├── entscheidungen/       Entscheidungsregister
│   │   ├── risiken/              Risikoregister
│   │   ├── dokumente/            Dokumente
│   │   ├── uebergaben/           Übergabe-Protokolle
│   │   └── kommunikation/        Kommunikationslog
│   └── api/
│       ├── auth/[...nextauth]/   NextAuth-Handler
│       └── projekte/             CRUD für Projekte + alle Sub-Ressourcen
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          Haupt-Layout (Sidebar + TopNav + Main)
│   │   ├── Sidebar.tsx           APOS-Navigation (Ikonen-Leiste links)
│   │   └── TopNav.tsx            Top-Bar mit Titel + ThemeToggle + User
│   ├── theme/
│   │   ├── ThemeProvider.tsx     Context für Light/Dark/System
│   │   ├── ThemeToggle.tsx       3-Knopf-Umschalter
│   │   └── LightOnly.tsx        Wrapper für immer-helle Bereiche (Login)
│   ├── ui/
│   │   └── DatePicker.tsx        Custom-Kalender (kein nativer date-Input)
│   └── SessionProvider.tsx       NextAuth Session-Bridge (client)
├── lib/
│   ├── prisma.ts                 Prisma-Client (Singleton-Pattern)
│   ├── auth.ts                   NextAuth-Config (CredentialsProvider)
│   ├── api-helpers.ts            requireSession, isAdmin, isManagerOrAbove
│   └── theme.ts                  ThemeMode, THEME_BOOTSTRAP_SCRIPT, THEME_COOKIE
├── prisma/
│   └── schema.prisma             Minimal-Schema: User, Organization, Project
├── types/
│   └── next-auth.d.ts            Session/JWT Type-Augmentation
├── .env.example                  Template (kein echtes .env committen!)
├── .gitignore
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── package.json
```

---

## Verlinkung zur OOS Task-API

APOS ist darauf ausgelegt, perspektivisch Aufgaben über die OOS Task-API zu koordinieren. Die Dokumentation der Task-API liegt im OOS-Repo:

```
apps/oos/docs/tasks-api.md
```

(Sobald das OOS-Repo separat ist: Link wird hier nachgepflegt.)

---

## Nächste Ausbauschritte

1. **Eigenes DB-Schema ausbauen** — Das minimale `prisma/schema.prisma` um die vollständigen APOS-Modelle erweitern: `WorkPackage`, `ScheduleItem`, `VobItem`, `BudgetItem`, `Risk`, `Procurement`, `Stakeholder`, `Decision`, `HandoverProtocol`, `CommunicationLog`, `Document`. Vorlage: `packages/database/prisma/schema.prisma` im Monorepo (nach `Apos`-Präfix-Models suchen).

2. **API-Routen aktivieren** — Alle mit `TODO(apos-extract)` markierten Stub-Routes reaktivieren, sobald die Models im Schema existieren.

3. **Auth vervollständigen** — `lib/auth.ts` um `organizationId`-Lookup erweitern (erfordert vollständige Organization-Verknüpfung im Schema). Passwort-Hashing bei User-Erstellung einbauen.

4. **Integration gegen OOS Task-API** — API-Client in `lib/oos-api.ts` implementieren, der Arbeitspakete aus APOS als Tasks in OOS anlegt / synchronisiert.

5. **Eigenes GitHub-Repo anlegen** — Repository erstellen, Push, GitHub Actions für CI/CD konfigurieren.

6. **Deployment-Strategie** — Railway / Vercel / eigener Server: `DATABASE_URL` auf Produktions-DB zeigen lassen, `NEXTAUTH_SECRET` sicher setzen, `NEXTAUTH_URL` auf Produktions-URL.

7. **Seeding** — Initialen Admin-User anlegen (Skript in `prisma/seed.ts`).

8. **DatePicker konsequent einsetzen** — In allen Formularen (Projekte, Terminplan, VOB) den `DatePicker` aus `components/ui/DatePicker.tsx` statt nativer `<input type="date">` verwenden.
