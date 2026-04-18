"use client";

// ─── useScheduleEvents: Client-Hook für Terminplan-SSE ──────────────────────
//
// Öffnet eine EventSource-Verbindung zu `/api/projekte/[id]/terminplan/stream`
// und ruft `onEvent` für jedes eintreffende Event auf. Stabil gegen
// Re-Renders (Handler wird in einem Ref gehalten) und gegen kurze
// Verbindungsabbrüche (Exponential-Backoff-Reconnect, max 30s).

import { useEffect, useRef } from "react";
import type { ScheduleEvent } from "@/lib/terminplan/types";

type Handler = (event: ScheduleEvent) => void;

export function useScheduleEvents(
  projectId: string | null | undefined,
  onEvent: Handler,
): void {
  // Handler in Ref halten, damit die EventSource nicht bei jedem
  // Parent-Render neu aufgebaut wird.
  const handlerRef = useRef<Handler>(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!projectId) return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      source = new EventSource(
        `/api/projekte/${encodeURIComponent(projectId)}/terminplan/stream`,
      );

      source.onopen = () => {
        // Erfolgreich verbunden — Backoff zurücksetzen.
        attempt = 0;
      };

      source.onmessage = (ev: MessageEvent<string>) => {
        // Heartbeat-Kommentare (Zeilen, die mit `:` anfangen) liefert der
        // Browser nicht als `message`-Event aus, deswegen brauchen wir hier
        // keinen Filter. Defensiv behandeln wir aber leere Payloads.
        if (!ev.data) return;

        let parsed: ScheduleEvent;
        try {
          parsed = JSON.parse(ev.data) as ScheduleEvent;
        } catch {
          // Kaputtes JSON ignorieren, damit ein einzelner Server-Fehler
          // den Stream nicht vergiftet.
          return;
        }

        handlerRef.current(parsed);
      };

      source.onerror = () => {
        // EventSource rekonnektiert per Default automatisch. Wir schließen
        // aber explizit und nutzen einen eigenen Backoff, damit wir
        // Kontrolle über die maximale Retry-Zeit haben und die Verbindung
        // beim Unmount sauber beenden können.
        if (source) {
          source.close();
          source = null;
        }
        if (cancelled) return;

        attempt += 1;
        const delay = Math.min(30_000, 500 * 2 ** Math.min(attempt, 6));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (source) {
        source.close();
        source = null;
      }
    };
  }, [projectId]);
}
