// ─── Terminplan Realtime (SSE In-Memory PubSub) ─────────────────────────────
//
// Leichtgewichtiger, prozess-lokaler PubSub für Terminplan-Events.
// Benutzung:
//   - SSE-Route ruft `subscribe(projectId, send)` beim Öffnen der Verbindung,
//     hält die zurückgegebene Unsubscribe-Funktion fest und ruft sie im
//     Abort/Cancel-Handler auf.
//   - Service-Layer ruft nach jeder Write-Operation
//     `broadcast(projectId, event)` auf. Der Call ist non-blocking; Fehler
//     in einzelnen Writer-Callbacks werden still geschluckt und der Writer
//     wird automatisch aus der Registry entfernt.
//
// Absichtlich pure In-Memory (kein Redis, keine Queue). Für v1 reicht das,
// weil APOS aktuell als Single-Instance auf Railway läuft. Sobald Mehrfach-
// Instanzen im Spiel sind, muss hier ein externer PubSub-Adapter rein.

import type { ScheduleEvent } from "@/lib/terminplan/types";

type EventWriter = (event: ScheduleEvent) => void;
type Registry = Map<string, Set<EventWriter>>;

// ─── Globale Registry (überlebt Next.js HMR) ────────────────────────────────
//
// In Dev-Mode ersetzt Next.js Module bei HMR, wodurch normalerweise der
// Modul-State verloren geht. Mit einem Symbol.for-Key auf `globalThis`
// bleibt die Registry stabil, damit bestehende Subscriber nicht nach jedem
// Save-Reload hängen.
const globalKey = Symbol.for("apos.terminplan.realtime.registry");
const globalSlot = globalThis as unknown as Record<symbol, Registry | undefined>;
const registry: Registry = globalSlot[globalKey] ?? new Map<string, Set<EventWriter>>();
globalSlot[globalKey] = registry;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Registriert einen Writer für ein Projekt. Rückgabewert ist eine
 * Unsubscribe-Funktion, die idempotent ist (mehrfaches Aufrufen schadet
 * nicht).
 */
export function subscribe(projectId: string, writer: EventWriter): () => void {
  let bucket = registry.get(projectId);
  if (!bucket) {
    bucket = new Set<EventWriter>();
    registry.set(projectId, bucket);
  }
  bucket.add(writer);

  return () => {
    const current = registry.get(projectId);
    if (!current) return;
    current.delete(writer);
    if (current.size === 0) registry.delete(projectId);
  };
}

/**
 * Sendet ein Event an alle Subscriber des Projekts. Iteriert über eine Kopie,
 * damit Unsubscribes während des Sends sicher sind. Writer, die einen Fehler
 * werfen, werden automatisch aus der Registry entfernt.
 */
export function broadcast(projectId: string, event: ScheduleEvent): void {
  const bucket = registry.get(projectId);
  if (!bucket || bucket.size === 0) return;

  // Snapshot, damit Unsubscribes innerhalb des Sends (z.B. weil ein Writer
  // wirft und sich deregistriert) die Iteration nicht kaputtmachen.
  const writers = Array.from(bucket);
  for (const writer of writers) {
    try {
      writer(event);
    } catch {
      // Writer ist nicht mehr erreichbar (Controller geschlossen, o.Ä.) —
      // raus aus der Registry, damit wir nicht ewig tote Callbacks halten.
      bucket.delete(writer);
    }
  }

  if (bucket.size === 0) registry.delete(projectId);
}

/**
 * Anzahl aktiver Subscriber pro Projekt. Für Debugging und Metrics gedacht.
 */
export function subscriberCount(projectId: string): number {
  const bucket = registry.get(projectId);
  return bucket ? bucket.size : 0;
}

/**
 * Housekeeping-Hook. Entfernt leere Buckets aus der Registry, damit sie
 * nicht ewig wachsen, wenn viele Projekte einmalig angesprochen wurden.
 * Für den normalen Betrieb reicht das selbstreinigende Verhalten von
 * `broadcast` und `subscribe`; `cleanup` ist explizit für Tests und für
 * Wartungs-Endpunkte da.
 */
export function cleanup(projectId: string): void {
  const bucket = registry.get(projectId);
  if (!bucket) return;
  if (bucket.size === 0) registry.delete(projectId);
}
