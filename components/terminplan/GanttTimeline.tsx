"use client";

// Rechte Seite des Gantt-Charts:
//  - Kopfzeile (zweizeilig: Monat oben, KW/Tag unten, abhängig von Zoom)
//  - Item-Zeilen mit absolut positionierten Balken
//  - Heute-Linie
//  - Dependency-Layer (SVG)

import { useMemo } from "react";
import type {
  ScheduleDependencyDTO,
  ScheduleItemDTO,
  TradeCategoryDTO,
} from "@/lib/terminplan/types";
import {
  computeBarGeometry,
  computeTimelineColumns,
  computeTodayOffset,
  formatMonthLabel,
  formatWeekLabel,
  startOfMonth,
  addMonths,
  addDays,
  daysBetween,
  getIsoWeekday,
} from "@/lib/terminplan/time";
import GanttBar from "./GanttBar";
import GanttDependencyLayer from "./GanttDependencyLayer";
import type { TimelineContext } from "./types";

interface GanttTimelineProps {
  items: ScheduleItemDTO[];
  visibleItems: ScheduleItemDTO[];
  dependencies: ScheduleDependencyDTO[];
  tradeCategoriesById: Map<string, TradeCategoryDTO>;
  timelineCtx: TimelineContext;
  headerHeight: number;
  onEditItem: (item: ScheduleItemDTO) => void;
}

export default function GanttTimeline({
  items,
  visibleItems,
  dependencies,
  tradeCategoriesById,
  timelineCtx,
  headerHeight,
  onEditItem,
}: GanttTimelineProps) {
  const { rangeStart, rangeEnd, totalDays, zoomLevel, timelineWidthPx, rowHeight } =
    timelineCtx;

  const columns = useMemo(
    () => computeTimelineColumns(rangeStart, rangeEnd, zoomLevel),
    [rangeStart, rangeEnd, zoomLevel],
  );

  const todayOffsetPct = useMemo(
    () => computeTodayOffset(rangeStart, totalDays),
    [rangeStart, totalDays],
  );

  // Secondary-Header-Zeile: für WEEK=Monate oben, für MONTH=Jahre oben,
  // für DAY = Monate oben (ganze Zeile pro Monat).
  const secondaryHeader = useMemo(
    () => buildSecondaryHeader(rangeStart, rangeEnd, zoomLevel, totalDays),
    [rangeStart, rangeEnd, zoomLevel, totalDays],
  );

  // Wochenend-Shading-Spalten (nur DAY-Zoom sinnvoll; bei WEEK nicht nötig).
  const weekendBands = useMemo(() => {
    if (zoomLevel !== "DAY") return [];
    const bands: { leftPercent: number; widthPercent: number }[] = [];
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
    const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
    while (cursor.getTime() < end.getTime()) {
      const wd = getIsoWeekday(cursor);
      if (wd === 6 || wd === 7) {
        const offset = daysBetween(rangeStart, cursor);
        bands.push({
          leftPercent: (offset / totalDays) * 100,
          widthPercent: (1 / totalDays) * 100,
        });
      }
      cursor = addDays(cursor, 1);
    }
    return bands;
  }, [rangeStart, rangeEnd, zoomLevel, totalDays]);

  const bodyHeight = visibleItems.length * rowHeight;

  return (
    <div
      className="relative"
      style={{ width: timelineWidthPx, minWidth: timelineWidthPx }}
    >
      {/* --- Header --- */}
      <div
        className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200"
        style={{ height: headerHeight }}
      >
        {/* Obere Zeile (Monat/Jahr) */}
        <div className="flex h-7 border-b border-gray-200">
          {secondaryHeader.map((sh) => (
            <div
              key={sh.key}
              className="border-r border-gray-200 flex items-center px-2 text-xs font-semibold text-gray-700 truncate"
              style={{ width: `${sh.widthPercent}%` }}
            >
              {sh.label}
            </div>
          ))}
        </div>
        {/* Untere Zeile (KW / Tag / Monat) */}
        <div className="flex" style={{ height: headerHeight - 28 }}>
          {columns.map((col, idx) => (
            <div
              key={`col-${idx}`}
              className={`border-r border-gray-200 flex items-center justify-center text-[10px] text-gray-500 truncate ${
                col.isWeekend ? "bg-gray-100" : ""
              }`}
              style={{ width: `${(col.widthDays / totalDays) * 100}%` }}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* --- Body --- */}
      <div
        className="relative"
        style={{ height: bodyHeight, minHeight: bodyHeight }}
      >
        {/* Spalten-Hintergrund (vertikale Linien) */}
        <div className="absolute inset-0 flex pointer-events-none">
          {columns.map((col, idx) => (
            <div
              key={`bg-${idx}`}
              className={`border-r border-gray-100 ${
                col.isWeekend ? "bg-gray-50" : ""
              }`}
              style={{ width: `${(col.widthDays / totalDays) * 100}%` }}
            />
          ))}
        </div>

        {/* Wochenend-Bänder (nur DAY) */}
        {weekendBands.map((b, idx) => (
          <div
            key={`we-${idx}`}
            className="absolute top-0 bottom-0 bg-gray-50 pointer-events-none"
            style={{
              left: `${b.leftPercent}%`,
              width: `${b.widthPercent}%`,
            }}
          />
        ))}

        {/* Heute-Linie */}
        {todayOffsetPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none"
            style={{ left: `${todayOffsetPct}%`, zIndex: 6 }}
          >
            <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-500" />
          </div>
        )}

        {/* Zeilen mit Balken */}
        {visibleItems.map((item, rowIdx) => {
          const tc = item.tradeCategoryId
            ? tradeCategoriesById.get(item.tradeCategoryId)
            : undefined;
          const geo = computeBarGeometry(
            new Date(item.startDate),
            new Date(item.endDate),
            rangeStart,
            totalDays,
          );
          return (
            <div
              key={item.id}
              className="absolute left-0 right-0 border-b border-gray-100"
              style={{
                top: rowIdx * rowHeight,
                height: rowHeight,
              }}
            >
              <GanttBar
                item={item}
                tradeCategory={tc}
                leftPercent={geo.leftPercent}
                widthPercent={geo.widthPercent}
                isParent={item.hasChildren}
                onClick={() => onEditItem(item)}
              />
            </div>
          );
        })}

        {/* Dependency-Pfeile (SVG-Overlay) */}
        <GanttDependencyLayer
          dependencies={dependencies}
          items={items}
          visibleItems={visibleItems}
          timelineCtx={timelineCtx}
          headerHeight={0 /* body-relative, header hat eigenen sticky-Container */}
        />
      </div>
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------

type SecondaryHeaderCell = {
  key: string;
  label: string;
  widthPercent: number;
};

function buildSecondaryHeader(
  rangeStart: Date,
  rangeEnd: Date,
  zoomLevel: "DAY" | "WEEK" | "MONTH",
  totalDays: number,
): SecondaryHeaderCell[] {
  if (totalDays <= 0) return [];

  if (zoomLevel === "MONTH") {
    // Obere Zeile: Jahre
    const cells: SecondaryHeaderCell[] = [];
    let cursor = new Date(rangeStart.getFullYear(), 0, 1);
    while (cursor.getTime() < rangeEnd.getTime()) {
      const year = cursor.getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      const visibleStart =
        yearStart.getTime() < rangeStart.getTime() ? rangeStart : yearStart;
      const visibleEnd =
        yearEnd.getTime() > rangeEnd.getTime() ? rangeEnd : yearEnd;
      const widthDays = daysBetween(visibleStart, visibleEnd);
      if (widthDays > 0) {
        cells.push({
          key: `y-${year}`,
          label: String(year),
          widthPercent: (widthDays / totalDays) * 100,
        });
      }
      cursor = new Date(year + 1, 0, 1);
    }
    return cells;
  }

  // WEEK oder DAY → obere Zeile = Monate
  const cells: SecondaryHeaderCell[] = [];
  let cursor = startOfMonth(rangeStart);
  while (cursor.getTime() < rangeEnd.getTime()) {
    const next = addMonths(cursor, 1);
    const visibleStart = cursor.getTime() < rangeStart.getTime() ? rangeStart : cursor;
    const visibleEnd = next.getTime() > rangeEnd.getTime() ? rangeEnd : next;
    const widthDays = daysBetween(visibleStart, visibleEnd);
    if (widthDays > 0) {
      cells.push({
        key: `m-${cursor.getFullYear()}-${cursor.getMonth()}`,
        label:
          zoomLevel === "WEEK"
            ? formatMonthLabel(cursor)
            : formatMonthLabel(cursor),
        widthPercent: (widthDays / totalDays) * 100,
      });
    }
    cursor = next;
  }
  // Falls WEEK: formatWeekLabel wird in der unteren Zeile benutzt (columns),
  // hier nur Monat.
  void formatWeekLabel;
  return cells;
}
