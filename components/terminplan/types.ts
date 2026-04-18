// Frontend-interne Types für das Gantt-Chart.
// DTOs kommen aus lib/terminplan/types.ts — hier nur UI-spezifisches.

import type { ZoomLevel } from "@/lib/terminplan/time";

export type { ZoomLevel };

/**
 * Kontext, der die komplette Timeline-Geometrie beschreibt.
 * Wird von <GanttTimeline> an <GanttBar>/<GanttDependencyLayer> übergeben.
 */
export interface TimelineContext {
  rangeStart: Date;
  rangeEnd: Date;
  totalDays: number;
  zoomLevel: ZoomLevel;
  /** Breite einer ganzen Tagesspalte in px — für Pixel-Berechnungen */
  pixelPerDay: number;
  /** Gesamtbreite der Timeline in px */
  timelineWidthPx: number;
  /** Zeilenhöhe einer Item-Zeile in px */
  rowHeight: number;
}

/** Gantt-Gesamt-View (Gantt | Liste) */
export type GanttView = "GANTT" | "LIST";
