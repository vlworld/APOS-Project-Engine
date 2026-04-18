# APOS Entwicklungs-Konventionen

Dieses Dokument beschreibt die verbindlichen Entwicklungsprinzipien für APOS. Es ist kein optionaler Style-Guide, sondern eine Sammlung der Regeln, die aus konkreten Fehlern und Designentscheidungen gewachsen sind. Jede Regel hat eine Begründung — wer die Begründung versteht, kann sicher entscheiden, wann Ausnahmen sinnvoll sind.

---

## Dark Mode

### Light-first-Grundsatz

Neue Komponenten werden zuerst für den hellen Modus entworfen. Dark Mode ist der Sekundärfall. Diese Reihenfolge verhindert, dass Dark-Mode-Optimierungen den hellen Modus kaputt machen — ein Fehler, der in der anderen Richtung viel häufiger vorkommt.

**Konkret:**

1. **Plain Tailwind-Utility-Klassen brauchen keine `dark:`-Variante.** `bg-white`, `bg-gray-50`, `text-gray-900`, `border-gray-200`, `bg-blue-50` und alle anderen Standard-Klassen werden von den globalen Fallbacks in `app/globals.css` automatisch auf Dark Mode gemappt. Keine manuellen `dark:bg-gray-800`-Annotationen nötig — das skaliert nicht und führt zu Inkonsistenzen.

2. **Explizite `dark:`-Klassen gewinnen gegen die Fallbacks** — und sollen deshalb nur gesetzt werden, wenn eine Komponente eine *spezifische* Dark-Mode-Darstellung braucht, die vom globalen Fallback abweicht (z. B. ein besonderer Akzent-Kontrast, ein invertierter Gradient).

3. **Immer-helle Surfaces** (Login-Seite, Extern-Portal, PDF-Export) werden mit `<LightOnly>` aus `components/theme/LightOnly.tsx` oder einer `light`-Klasse am Wrapper geschützt. Der CSS-Selektor `:not(:where(.light, .light *))` in `globals.css` hebelt den Dark-Mode für diesen Teilbaum aus. Ohne diesen Schutz würden Login-Formulare im Dark Mode dunkel werden — was die UX bricht (Login soll immer neutral-hell wirken).

4. **Inline-Styles mit Hex/RGB umgehen das System** — `style={{ background: "#fff" }}`, SVG `fill="#fff"`, `style={{ color: "black" }}` werden von den CSS-Fallbacks nicht erfasst. Immer Tailwind-Klassen verwenden. Bei SVGs: `currentColor` nutzen und die Farbe über `text-*` steuern.

5. **Der globale Fallback-Block in `globals.css` ist UNLAYERED.** Er darf nicht in `@layer components` oder `@layer utilities` verschoben werden — in Tailwind v4 würde er sonst von den Utility-Klassen überschrieben (Layers-Priorität schlägt Selektor-Spezifität). Der Kommentar „WICHTIG: Dieser Block ist UNLAYERED" darf nicht entfernt werden.

6. **Pastel-Gradients (`from-blue-50 via-indigo-50 to-violet-50`) benötigen explizite Neutralisierung.** Tailwind v4 erzeugt für Gradient-Stops eine interne Variablen-Kette, die nicht von einfachen `background-color`-Overrides erfasst wird. `globals.css` enthält einen Blanket-Override für die gängigsten Pastel-Gradient-Kombinationen. Wer einen neuen Pastel-Gradient einführt, muss prüfen ob der Fall abgedeckt ist — oder einen neuen Override ergänzen.

7. **Vor jedem Commit: Dark-Mode visuell prüfen** — mindestens Dashboard, Login und das neue Feature in beiden Modi ansehen. Automatisierte Tests fangen visuelle Fehler nicht zuverlässig ab.

---

## Datumsfelder

**Kein `<input type="date">` verwenden.** Native Date-Inputs sehen auf jedem OS und Browser anders aus, reagieren nicht auf Dark Mode, und lassen sich nicht auf Deutsch lokalisieren. Stattdessen:

```tsx
import DatePicker from "@/components/ui/DatePicker";

<DatePicker
  value={formData.startDate}           // "YYYY-MM-DD" oder ""
  onChange={(v) => setFormData(f => ({ ...f, startDate: v }))}
  placeholder="Startdatum wählen..."
/>
```

Der `DatePicker` ist in `components/ui/DatePicker.tsx` implementiert, portiert von OOS. Er unterstützt `autoOpen`, `onClose`, `hideTrigger` und `error`-Styling.

---

## Keine Browser-Dialoge

**`window.confirm()`, `window.alert()`, `window.prompt()` sind verboten.** Browser-native Dialoge:
- sehen auf jedem OS/Browser anders aus (bricht das Design)
- lassen sich nicht stylen oder in den App-Zustand integrieren
- blockieren den Browser-Rendering-Thread
- können vom Nutzer für alle zukünftigen Dialoge gesperrt werden

Stattdessen: In-App-Modal mit dem eigenen Design. Ein einfaches Muster:

```tsx
const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

// Bestätigungs-Modal
{confirmDelete && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Löschen bestätigen</h3>
      <p className="text-sm text-gray-600 mb-6">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
      <div className="flex gap-3 justify-end">
        <button onClick={() => setConfirmDelete(null)} className="...">Abbrechen</button>
        <button onClick={() => { handleDelete(confirmDelete); setConfirmDelete(null); }} className="...">Löschen</button>
      </div>
    </div>
  </div>
)}
```

---

## Buttons und Aktionen

### Konventionen

- **Primäre Aktion** (Speichern, Anlegen): `bg-emerald-600 text-white hover:bg-emerald-700`
- **Sekundäre Aktion** (Abbrechen): `text-gray-700 hover:bg-gray-100` (kein Border, kein Hintergrund)
- **Gefährliche Aktion** (Löschen): `bg-red-600 text-white hover:bg-red-700`
- **Archivieren** (nicht löschen): Icon `Archive`, Status-Änderung auf `ARCHIVED`
- **Bearbeiten**: Icon `Pencil` oder `Edit2`, öffnet Inline-Formular oder Modal
- **Undo**: Sofort nach destruktiver Aktion anbieten (Toast mit Undo-Button, 5s TTL)

### Loading-States

Buttons, die eine API-Aktion auslösen, müssen während des Ladens deaktiviert werden und einen Spinner zeigen:

```tsx
<button disabled={saving} className="... disabled:opacity-50">
  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
  Speichern
</button>
```

### Status-Badges

Für Enums (Projekt-Status, Arbeitspaket-Status etc.) immer ein `STATUS_CONFIG`-Objekt verwenden:

```ts
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PLANNING:  { label: "Planung",          bg: "bg-blue-100",    text: "text-blue-700" },
  ACTIVE:    { label: "Aktiv",            bg: "bg-emerald-100", text: "text-emerald-700" },
  COMPLETED: { label: "Abgeschlossen",    bg: "bg-gray-100",    text: "text-gray-600" },
};
```

Niemals Farben direkt in JSX hart verdrahten — das verhindert eine einheitliche Änderung.

---

## Tastatur-Shortcuts

Jedes Modal und jeder Drawer muss auf **Escape** schließen:

```tsx
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [onClose]);
```

Formulare innerhalb von Modalen sollen auf **Ctrl+S** (bzw. Cmd+S auf Mac) speichern:

```tsx
function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    handleSubmit();
  }
}
```

Diese Shortcuts sind keine netten Extras — sie sind Standard-Erwartungen von Power-Usern.

---

## API-Design

### Service-Layer-Pattern

Route-Handler sind dünn — sie validieren den Input und delegieren die Logik an den Service-Layer. Kein Business-Code direkt in `app/api/*/route.ts`:

```ts
// route.ts — dünn
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const result = await createProjekt(body, session.user);  // ← Service-Funktion
  return NextResponse.json(result, { status: 201 });
}

// lib/projekte.ts — Business-Logik
export async function createProjekt(body: CreateProjektInput, user: SessionUser) {
  // Validation, DB-Calls, Fehlerbehandlung
}
```

Dieses Muster macht Logik testbar (ohne HTTP), ermöglicht Wiederverwendung zwischen Routes und hält die Routen lesbar.

### Auth in API-Routes

Jede geschützte Route beginnt mit:

```ts
const { session, error } = await requireSession();
if (error) return error;
```

`requireSession()` aus `lib/api-helpers.ts` gibt bei fehlendem Session-Cookie automatisch `401 Unauthorized` zurück.

### Organisationsscoping

Alle DB-Queries müssen durch `organizationId: session.user.organizationId` auf die eigene Organisation eingeschränkt werden. Kein Query ohne diesen Filter — sonst können Nutzer Daten anderer Organisationen sehen oder schreiben.

---

## TypeScript

**strict: true** — keine Ausnahmen. `any` ist nur in klar gekennzeichneten Ausnahmen erlaubt (`// eslint-disable-next-line @typescript-eslint/no-explicit-any`). Typen für API-Responses werden als Interfaces in der jeweiligen Komponente definiert oder in `types/` zentralisiert, wenn sie über mehrere Dateien gebraucht werden.

---

## Keine Inline-Farben

Tailwind-Klassen verwenden, keine Hex-Codes im JSX:

```tsx
// Falsch:
<div style={{ color: "#6b7280" }}>Text</div>

// Richtig:
<div className="text-gray-500">Text</div>
```

Ausnahme: CSS-Custom-Properties über `var(--...)`, wenn eine Farbe aus dem Design-Token-System kommt (z. B. `style={{ backgroundColor: "var(--sidebar-bg)" }}`).

---

## Drag-and-Drop

Wenn DnD benötigt wird (z. B. für Kanban-Boards, Reihenfolge von Arbeitspaketen), ist **`@hello-pangea/dnd`** die Bibliothek der Wahl (kompatibel mit `react-beautiful-dnd`-API, React 19 kompatibel). Sie muss konsistent eingesetzt werden — keine Mischung mit anderen DnD-Libraries.

```bash
npm install @hello-pangea/dnd
```

Die Bibliothek muss in `package.json` dokumentiert sein. DnD-Logik gehört in die Komponente (nicht in die Route) und braucht einen klaren `onDragEnd`-Handler, der den neuen State sowohl lokal als auch per PATCH-Route persistiert.

---

## Dokumentations-Pflicht

**API-Änderungen aktualisieren die Doku im selben Commit.** Wenn eine neue Route, ein neues Model oder eine Breaking Change an einer bestehenden API eingeführt wird, wird gleichzeitig:
- der entsprechende Abschnitt in diesem Dokument (oder einer `docs/`-Datei) angepasst
- die `.env.example` aktualisiert wenn neue Env-Vars hinzukommen
- das Prisma-Schema per `prisma generate` neu generiert

Kein Commit mit API-Änderung ohne Doku-Aktualisierung. Der Grund: neue Entwickler (oder KI-Agenten) arbeiten ohne dieses Wissen und verursachen Regressionen.

---

## Checkliste vor jedem PR / Commit

- [ ] TypeScript-Check grün: `npx tsc --noEmit`
- [ ] Dark Mode visuell geprüft: Dashboard + Login + neue Komponente in beiden Modi
- [ ] Keine `window.confirm/alert/prompt` eingeführt
- [ ] Keine `<input type="date">` eingeführt (nur `DatePicker`)
- [ ] Neue API-Routes haben `requireSession()` und `organizationId`-Filter
- [ ] Buttons haben Loading-State wenn async
- [ ] Escape schließt alle neuen Modals
- [ ] Keine neuen `workspace:*`-Dependencies (Standalone bleibt Standalone)
