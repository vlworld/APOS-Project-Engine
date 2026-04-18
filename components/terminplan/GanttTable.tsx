"use client";

// Linke Hälfte des Gantt-Charts: scrollende Tabelle mit WBS/Name/Status/Gewerk.

import GanttRow from "./GanttRow";
import type { ScheduleItemDTO, TradeCategoryDTO } from "@/lib/terminplan/types";

interface GanttTableProps {
  visibleItems: ScheduleItemDTO[];
  tradeCategoriesById: Map<string, TradeCategoryDTO>;
  expandedIds: Set<string>;
  canEdit: boolean;
  onToggleExpand: (id: string) => void;
  onEditItem: (item: ScheduleItemDTO) => void;
  onAddChild: (parent: ScheduleItemDTO) => void;
  headerHeight: number;
  rowHeight: number;
  width?: number;
  fullWidth?: boolean;
}

export default function GanttTable({
  visibleItems,
  tradeCategoriesById,
  expandedIds,
  canEdit,
  onToggleExpand,
  onEditItem,
  onAddChild,
  headerHeight,
  rowHeight,
  width,
  fullWidth,
}: GanttTableProps) {
  const wrapperStyle =
    fullWidth || width === undefined
      ? undefined
      : { width, minWidth: width };
  const wrapperClass = fullWidth
    ? "w-full min-w-[600px] border-r border-gray-200 bg-white"
    : "shrink-0 border-r border-gray-200 bg-white";
  return (
    <div
      className={wrapperClass}
      style={wrapperStyle}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 flex items-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider"
        style={{ height: headerHeight }}
      >
        <div className="shrink-0 w-[60px] px-2 text-right">Nr.</div>
        <div className="flex-1 min-w-0 px-2">Name</div>
        <div className="shrink-0 w-[90px] px-2">Status</div>
        <div className="shrink-0 w-[130px] px-2">Gewerk</div>
        <div className="shrink-0 w-[90px] px-2">Start</div>
        <div className="shrink-0 w-[90px] px-2">Ende</div>
        <div className="shrink-0 w-[60px] px-2 text-right">Dauer</div>
        <div className="shrink-0 w-[56px]" />
      </div>

      {/* Body */}
      <div>
        {visibleItems.map((item) => {
          const tc = item.tradeCategoryId
            ? tradeCategoriesById.get(item.tradeCategoryId)
            : undefined;
          return (
            <GanttRow
              key={item.id}
              item={item}
              tradeCategory={tc}
              depth={item.depth}
              isExpanded={expandedIds.has(item.id)}
              canEdit={canEdit}
              onToggleExpand={() => onToggleExpand(item.id)}
              onEdit={() => onEditItem(item)}
              onAddChild={() => onAddChild(item)}
              rowHeight={rowHeight}
            />
          );
        })}
      </div>
    </div>
  );
}
