"use client";

// SVG-Layer, das Abhängigkeitspfeile zwischen Balken zeichnet.
// Absolut positioniert über der Timeline, pointer-events: none
// (damit Hover/Klick auf die Balken durchgeht).

import { useMemo } from "react";
import type {
  ScheduleDependencyDTO,
  ScheduleItemDTO,
} from "@/lib/terminplan/types";
import { computeBarGeometry } from "@/lib/terminplan/time";
import type { TimelineContext } from "./types";

interface GanttDependencyLayerProps {
  dependencies: ScheduleDependencyDTO[];
  items: ScheduleItemDTO[];
  /** Sichtbare Items in Reihenfolge (für y-Position) */
  visibleItems: ScheduleItemDTO[];
  timelineCtx: TimelineContext;
  headerHeight: number;
}

interface BarBox {
  left: number; // px
  right: number; // px
  centerY: number; // px
}

export default function GanttDependencyLayer({
  dependencies,
  items,
  visibleItems,
  timelineCtx,
  headerHeight,
}: GanttDependencyLayerProps) {
  const itemById = useMemo(() => {
    const map = new Map<string, ScheduleItemDTO>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const visibleIdx = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < visibleItems.length; i++) {
      map.set(visibleItems[i].id, i);
    }
    return map;
  }, [visibleItems]);

  const totalHeight =
    headerHeight + visibleItems.length * timelineCtx.rowHeight;
  const totalWidth = timelineCtx.timelineWidthPx;

  function getBarBox(item: ScheduleItemDTO, rowIndex: number): BarBox {
    const geo = computeBarGeometry(
      new Date(item.startDate),
      new Date(item.endDate),
      timelineCtx.rangeStart,
      timelineCtx.totalDays,
    );
    const left = (geo.leftPercent / 100) * totalWidth;
    const width = (geo.widthPercent / 100) * totalWidth;
    const right = left + width;
    const centerY =
      headerHeight + rowIndex * timelineCtx.rowHeight + timelineCtx.rowHeight / 2;
    return { left, right, centerY };
  }

  const paths = useMemo(() => {
    const out: {
      id: string;
      d: string;
      isDelayed: boolean;
    }[] = [];

    for (const dep of dependencies) {
      const from = itemById.get(dep.fromId);
      const to = itemById.get(dep.toId);
      if (!from || !to) continue;

      const fromIdx = visibleIdx.get(dep.fromId);
      const toIdx = visibleIdx.get(dep.toId);
      if (fromIdx === undefined || toIdx === undefined) continue;

      const fromBox = getBarBox(from, fromIdx);
      const toBox = getBarBox(to, toIdx);

      // Start-Punkt
      let startX: number;
      let endX: number;
      if (dep.type === "SS") {
        startX = fromBox.left;
        endX = toBox.left;
      } else if (dep.type === "FF") {
        startX = fromBox.right;
        endX = toBox.right;
      } else {
        // FS (Standard)
        startX = fromBox.right;
        endX = toBox.left;
      }

      const startY = fromBox.centerY;
      const endY = toBox.centerY;

      // Orthogonaler Pfad: rechts raus, runter/rauf, links rein mit Pfeilspitze
      const padding = 8;
      // Pfad mit kleinen abgerundeten Ecken (quadratische Bézier)
      const midX =
        dep.type === "SS"
          ? Math.min(startX, endX) - padding
          : Math.max(startX, endX) + padding;

      // Entscheidung: wenn Target links vom Source, gehen wir nach links
      const d = buildOrthoPath(startX, startY, endX, endY, midX);

      out.push({ id: dep.id, d, isDelayed: to.isDelayed });
    }

    return out;
  }, [dependencies, itemById, visibleIdx, timelineCtx, totalWidth, headerHeight]);
  // eslint-disable-line react-hooks/exhaustive-deps -- getBarBox stable via ctx

  if (totalWidth <= 0 || visibleItems.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={totalWidth}
      height={totalHeight}
      style={{ zIndex: 5 }}
    >
      <defs>
        <marker
          id="dep-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(156 163 175)" />
        </marker>
        <marker
          id="dep-arrow-red"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(248 113 113)" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={p.isDelayed ? "rgb(248 113 113)" : "rgb(156 163 175)"}
          strokeWidth={1.5}
          markerEnd={p.isDelayed ? "url(#dep-arrow-red)" : "url(#dep-arrow)"}
        />
      ))}
    </svg>
  );
}

/**
 * Orthogonalen Pfad mit kleinen 90°-Kurven bauen.
 * Geht: (startX, startY) → horizontal zu midX → vertikal zu endY → horizontal zu endX.
 */
function buildOrthoPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  midX: number,
): string {
  const r = 4; // corner radius

  const goingDown = endY > startY;
  const vStep = goingDown ? 1 : -1;

  // Wir bauen den Pfad mit Arcs statt Quadratic Bézier (sieht cleaner aus).
  // 1. Start → horizontal bis midX
  // 2. 90° Bogen
  // 3. Vertikal bis endY
  // 4. 90° Bogen
  // 5. Horizontal bis endX

  const seg1EndX = midX - (midX > startX ? r : -r);
  const arc1X = midX;
  const arc1Y = startY + vStep * r;
  const seg2EndY = endY - vStep * r;
  const arc2X = midX + (endX > midX ? r : -r);
  const arc2Y = endY;
  const sweep1 =
    midX > startX
      ? goingDown
        ? 1
        : 0
      : goingDown
        ? 0
        : 1;
  const sweep2 =
    endX > midX
      ? goingDown
        ? 0
        : 1
      : goingDown
        ? 1
        : 0;

  return [
    `M ${startX} ${startY}`,
    `L ${seg1EndX} ${startY}`,
    `A ${r} ${r} 0 0 ${sweep1} ${arc1X} ${arc1Y}`,
    `L ${midX} ${seg2EndY}`,
    `A ${r} ${r} 0 0 ${sweep2} ${arc2X} ${arc2Y}`,
    `L ${endX} ${endY}`,
  ].join(" ");
}
