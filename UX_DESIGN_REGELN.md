# UX/UI Design-Regeln — OOS & APOS

Verbindliche Interaktions- und Design-Muster für beide Projekte. Jede
Komponente, Seite und Interaktion muss diesen Regeln folgen. Abweichungen
nur mit expliziter Begründung und nach Absprache.

Diese Datei ist **lebendig** — wenn eine neue Regel eingeführt wird,
wandert sie hier rein.

---

## 1. Undo / Redo

- **Scope:** pro Formular / pro Aktion (nicht global)
- **Verhalten:** nach dem Speichern erscheint ein diskreter Button „Rückgängig machen"
- **Position:** klein, unterhalb oder neben dem Speichern-Button
- **Timeout:** Button verschwindet nach ca. 8 Sekunden automatisch
- **Stil:** dezent, nicht aufdringlich — kein Modal, kein Toast
- **Hotkey:** `Strg+Z` / `Cmd+Z` triggert Rückgängig (systemweit)

---

## 2. Autosave vs. manuelles Speichern

- **Autosave:** automatisch als Arbeitsentwurf (Status: Entwurf)
  - greift bei Texteingaben, Formularen, Editoren
  - speichert im Hintergrund ohne explizite User-Aktion
  - kein visuelles Feedback nötig (diskret)
- **Manuelles Speichern:** für das Überschreiben / Finalisieren von Daten
  - expliziter „Speichern"-Button
  - ändert den Status von Entwurf → Aktiv (falls Freigabe-Workflow)
  - erfordert bewusste User-Aktion
- **Hotkey:** `Strg+S` / `Cmd+S` triggert Speichern (Browser-Default überschreiben)
- **Seitenwechsel:** stiller Autosave (kein Modal, keine Rückfrage)

---

## 3. Bestätigungsdialoge

- **Löschen:** immer mit Bestätigungsdialog
  - Ausnahme: leere Einträge oder Einträge mit Name „Kopie" dürfen ohne Bestätigung gelöscht werden
- **Status-Änderungen:** keine Bestätigung nötig
- **Archivieren:** keine Bestätigung nötig (reversibel)
- **Irreversible Aktionen:** immer Bestätigung + klarer Hinweistext
- **Umsetzung:** als eigene `<ConfirmDialog>`-Komponente (siehe §16)

---

## 4. Keine Browser-Dialoge

**Absolute Regel:** niemals `window.confirm()`, `window.alert()` oder `window.prompt()` verwenden. Auch nicht kurzzeitig „nur zum Prototyp".

- **Bestätigungen** (Löschen, Verwerfen, Entfernen) → `<ConfirmDialog>` mit
  Titel, Beschreibung, Cancel-Button (neutral) und Destructive-Button (rot)
- **Fehlermeldungen** → Toast oder Inline-Error im Komponenten-State
- **Eingaben** → eigenes Modal mit Form

**Warum:** Browser-Dialoge brechen das Design, blockieren den Thread, sehen
auf jedem OS anders aus. Der User hat das explizit mehrfach eingefordert.

**Bei Berührung einer Stelle mit `confirm()`:** diese direkt mitumbauen,
nicht stehen lassen.

---

## 5. Kalender / Datumsfelder

**Absolute Regel:** niemals `<input type="date">` oder andere native
Browser-Datepicker verwenden. Immer eine **eigene, schön gestaltete
Kalender-Komponente** mit umschaltbaren View-Modi.

### View-Modi (alle müssen unterstützt werden)
- 1 Woche
- 2 Wochen
- 1 Monat
- 3 Monate
- Mehrere Monate (Scroll / Overview)

### Umsetzung
- In OOS: `components/ui/DatePicker.tsx` — vorhanden und wiederzuverwenden
- In APOS: selbe Datei wurde beim Extrakt übernommen — dort vorhanden
- **Vor dem Einbau eines Datumsfelds prüfen**, ob die Calendar-Komponente
  bereits alle View-Modi hat. Falls nicht → ergänzen, nicht parallel neu bauen.
- Für jedes neue Feld mit Datums-Semantik (Deadline, Review-Datum,
  Start-Datum, Fälligkeit, Termin, `scheduledDate`, `dueDate`, `reviewDate`,
  `startDate`, etc.) die Custom-Komponente verwenden

### Technische Schuld
- Bestehende native `<input type="date">` in älterem Code (z. B.
  `app/apps/oos/app/(app)/strategie/massnahmen/page.tsx`) bei Gelegenheit
  migrieren. Keine neuen native Date-Inputs hinzufügen.

---

## 6. Loading States

- **Skeleton-Loader** verwenden (nicht Spinner)
- Skelette spiegeln die tatsächliche Seitenstruktur wider
- Platzhalter für Überschriften, Karten, Tabellen, Listen
- Keine leeren weißen Flächen während des Ladens

---

## 7. Tastaturnavigation

Systemweit konsistent:

| Taste | Verhalten |
|---|---|
| `Tab` | nächstes Feld anwählen |
| `Enter` | neuen Eintrag hinzufügen (in Listen/Tabellen) — bei leerem Feld: Feld verlassen, kein neues Feld |
| `Esc` | Feld verlassen / Pop-Up schließen |
| `Strg+S` / `Cmd+S` | Speichern (Browser-Default überschrieben) |
| `Strg+Z` / `Cmd+Z` | Rückgängig |

### Pop-Up-Verhalten
- `Esc` schließt jedes Pop-Up / Modal
- Klick außerhalb des Pop-Ups schließt es ebenfalls
- Beides muss überall implementiert sein

### Enter-Logik im Detail
- Listen/Tabellen: Enter bei nicht-leerem Feld = neue Zeile/Eintrag hinzufügen
- Enter bei leerem Feld = Feld verlassen, kein neues Feld erstellen
- Single-Inputs: Enter = Formular absenden (falls valide)

### Inline-Bearbeitung
- Klick in ein leeres Feld aktiviert den Bearbeitungsmodus direkt
- Kein separater Klick auf Bearbeitungs-Icon nötig bei leerem Feld
- Doppelklick auf gefüllte Felder / Tabellenzeilen öffnet die Bearbeitung

---

## 8. Default-Werte

- Keine automatisch vorausgefüllten Defaults
- Felder starten leer mit Placeholder-Text als Hinweis
- Keine Rückmeldung bei fehlenden Defaults

---

## 9. Offline-Verhalten

- Keine Offline-Funktionalität
- Keine spezielle Rückmeldung bei Verbindungsverlust
- System ist online-only

---

## 10. Erfolgs-Feedback

- **Toast-Meldungen** für Erfolgsmeldungen
- **Position:** unten rechts
- **Dauer:** 3 Sekunden (5 Sekunden bei Link/Aktion)
- **Stil:** dunkler Hintergrund (`gray-900`), weißer Text
- Keine Inline-Erfolgsmeldungen

---

## 11. Empty States

- **Immer** einen CTA-Button anzeigen
- Text-Muster: „Noch keine [Einträge] angelegt"
- Button-Text: „Ersten [Eintrag] anlegen" oder „[Eintrag] hinzufügen"
- Optional: passendes Icon darüber (dezent, `opacity-30`)
- Kein leerer weißer Bereich ohne Hinweis

---

## 12. Responsive Design

- **Desktop-First:** primär für Desktop optimiert
- **Mobile:** voll funktionsfähig und nutzbar
- Keine Desktop-Only-Funktionalität
- Mobile Breakpoints müssen getestet werden
- **Tabellen auf Mobile:** als Cards oder horizontales Scrollen
- **Sidebar auf Mobile:** eingeklappt / als Burger-Menü

---

## 13. Drag & Drop

Standardmäßig überall aktiviert.

### Tabellen & Listen
- Alle Tabelleninhalte sind per Drag & Drop verschiebbar
- Visueller Drop-Indikator: blaue Linie an der Zielposition
- Drag-Handle (`GripVertical`-Icon von lucide) links in jeder Zeile
- Reihenfolge wird in DB persistiert (`sortOrder`- oder `order`-Feld)

### Datei-Upload
- Das gesamte Ablagefeld wird zur Drag-&-Drop-Fläche
- Bei Drag-Over: visuelle Veränderung (Rahmen, Hintergrundfarbe, Icon)
- Upload muss **immer** bestätigt werden (kein Auto-Upload)
- Unterstützt parallel auch Klick zum Datei-Auswählen

### Kanban
- Spalten-Reihenfolge fix (via Konfiguration)
- Karten innerhalb einer Spalte: DnD
- Karten zwischen Spalten: DnD löst Status-Änderung aus

---

## 14. Tabellen-Aktionen

### Zeilen-Aktionen (immer sichtbar, rechts in der Zeile)
- ✏️ Bearbeiten (Stift-Icon)
- 📋 Duplizieren
- 📦 Archivieren
- 🗑️ Löschen

### Tabellen-Fußzeile
- Immer unten die Möglichkeit, neue Einträge hinzuzufügen
- Button „+ Eintrag hinzufügen" oder Inline-Eingabefeld

### Tabellen-Kopfzeile
- Immer oben Filter- / Sortier-Optionen
- Filter-Dropdown oder Suchfeld

### Batch-Aktionen
- Checkboxen links in jeder Tabellenzeile
- Bei Auswahl: Batch-Aktionsleiste einblenden
- Aktionen: Status ändern, Archivieren, Löschen (mit Bestätigung)

### Sortierung
- Letzte Sortierung pro Tabelle wird gemerkt (session-basiert)
- Klick auf Spaltenheader wechselt Sortierrichtung

---

## 15. Suche & Filter

### Suchfelder (Standard / klein)
- Sofortfilter beim Tippen (kein Enter nötig)
- Maximal 5 Treffer im Dropdown
- Debounce ca. 300 ms

### Suchfelder (groß / Hauptsuche)
- Sofortfilter beim Tippen
- Bis zu 10 Treffer anzeigen
- Debounce ca. 300 ms

### Allgemein
- Kein Enter zum Suchen nötig
- Suche beginnt ab 2 Zeichen
- „Keine Ergebnisse"-Hinweis bei 0 Treffern

---

## 16. Wiederverwendbare Komponenten

Vor dem Eigenbau **immer** prüfen, ob bereits vorhanden:

| Zweck | Komponente | Pfad (OOS) |
|---|---|---|
| Datum wählen | `DatePicker` | `components/ui/DatePicker.tsx` |
| Bestätigen | `ConfirmDialog` | noch zu bauen, bei erstem Bedarf als wiederverwendbare Komponente anlegen |
| Toast-Meldungen | — | noch zu definieren, wenn gebaut → hier eintragen |
| Modal-Shell | — | noch zu definieren, wenn gebaut → hier eintragen |

Wenn eine Komponente noch nicht existiert: **als erstes bauen und dann nutzen** — nicht lokal im Feature duplizieren.

---

## 17. Breadcrumbs

- Nur bei verschachtelten Seiten (z. B. Prozess → Schritt → Detail)
- Nicht auf Hauptseiten
- Format: `Übergeordnete Seite > Aktuelle Seite`
- Übergeordnete Seite ist klickbar (Link zurück)

---

## 18. Doppelklick-Verhalten

- Doppelklick auf Tabellenzeilen → öffnet den Eintrag / aktiviert Bearbeitung
- Doppelklick auf leere Felder → aktiviert Inline-Bearbeitung
- Einfacher Klick auf leere Felder mit Bearbeitungs-Icon → aktiviert Bearbeitung

---

## 19. Dark Mode

Siehe `apps/oos/AGENTS.md` → Abschnitt „Dark Mode" für den vollständigen
10-Punkte-Prüfkatalog. Kernregeln in Kürze:

- **Light-first:** neue Komponenten werden für hellen Modus entworfen,
  Dark kommt danach.
- Plain Tailwind-Klassen (`bg-white`, `text-gray-900`, `bg-blue-50`)
  brauchen **keine** `dark:`-Variante — globale Fallbacks in `globals.css`
  übernehmen das.
- Für Surfaces, die **immer hell** bleiben müssen (Login, Register,
  Onboarding, Extern, PDF-Export): `<LightOnly>`-Wrapper oder
  `className="light"`
- Keine harten Inline-Farben (`style={{ background: "#fff" }}`) — umgeht
  das System
- Pastel-Gradients (`bg-gradient-to-br from-blue-50`) haben separate
  Fallbacks in `globals.css`
- Backdrop-Blur sparsam

---

## 20. Zusammenfassung der Interaktionsmuster

```
Speichern      → Strg+S / Cmd+S + Toast „Gespeichert" + diskreter Rückgängig-Button
Rückgängig     → Strg+Z / Cmd+Z
Löschen        → ConfirmDialog (außer leere / Kopie-Einträge)
Autosave       → still im Hintergrund als Entwurf
Seitenwechsel  → stiller Autosave (kein Modal)
Laden          → Skeleton-Loader
Leerer Bereich → CTA „Ersten Eintrag anlegen"
Pop-Up         → Esc oder Klick außerhalb schließt
Navigation     → Tab / Enter / Esc konsistent
Feedback       → Toast unten rechts
Tabellen       → Drag & Drop + Zeilen-Aktionen + Batch-Checkboxen + Filter oben + Hinzufügen unten
Suche          → Sofortfilter (5 / 10 Treffer)
Doppelklick    → öffnet Bearbeitung
Sortierung     → wird pro Tabelle gemerkt
Datei-Upload   → Drag & Drop auf gesamtes Feld + Bestätigung
Breadcrumbs    → nur bei verschachtelten Seiten
Datumsfelder   → immer Custom-Kalender (1W / 2W / 1M / 3M / mehr)
Browser-Dialoge → verboten (eigene Modals)
```

---

## Pflegeabkommen

- Neue UX-Regel etabliert? → hier eintragen, im selben Commit.
- Bestehende Regel gelockert oder verschärft? → im Abschnitt kenntlich
  machen, Datum vermerken, nicht stumm überschreiben.
- Ein „bei Berührung direkt mitmachen"-Fix auf Technische-Schuld-Stellen
  wird positiv bewertet — nicht aufschieben.
