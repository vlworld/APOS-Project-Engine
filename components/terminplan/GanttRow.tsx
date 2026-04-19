"use client";

// Eine Tabellen-Zeile der GanttTable (links).
// Die Timeline-Zeile selbst wird in <GanttTimeline> gezeichnet.

import {
  ChevronRight,
  ChevronDown,
  Square,
  CheckSquare,
  Diamond,
  Plus,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import type { ScheduleItemDTO, TradeCategoryDTO } from "@/lib/terminplan/types";
import { safeColor } from "./TailwindColorSafelist";

const STATUS_STYLES: Record<
  ScheduleItemDTO["status"],
  { bg: string; text: string; label: string }
> = {
  OPEN: { bg: "bg-gray-100", text: "text-gray-600", label: "Offen" },
  IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700", label: "In Arbeit" },
  DONE: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Erledigt" },
};

interface GanttRowProps {
  item: ScheduleItemDTO;
  tradeCategory: TradeCategoryDTO | undefined;
  depth: number;
  isExpanded: boolean;
  canEdit: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  rowHeight: number;
  isLast?: boolean;
  compact?: boolean;
}

export default function GanttRow({
  item,
  tradeCategory,
  depth,
  isExpanded,
  canEdit,
  onToggleExpand,
  onEdit,
  onAddChild,
  rowHeight,
  compact = false,
}: GanttRowProps) {
  const status = STATUS_STYLES[item.status];
  const tradeColor = safeColor(tradeCategory?.color);

  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  const dateShort = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}.${String(d.getFullYear()).slice(2)}`;

  // Icon-Wahl
  let iconNode: React.ReactNode;
  if (item.hasChildren) {
    iconNode = isExpanded ? (
      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
    ) : (
      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
    );
  } else if (item.isMilestone) {
    iconNode = <Diamond className="w-3.5 h-3.5 text-purple-500" />;
  } else if (item.status === "DONE") {
    iconNode = <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />;
  } else {
    iconNode = (
      <Square
        className="w-3.5 h-3.5 text-gray-400"
        strokeDasharray="2 2"
      />
    );
  }

  return (
    <div
      className="group flex items-center border-b border-gray-100 hover:bg-gray-50/80 transition-colors text-sm"
      style={{ height: rowHeight }}
    >
      {/* Nummer (WBS) */}
      <div className="shrink-0 w-[60px] px-2 font-mono text-[10px] text-gray-400 text-right">
        {item.wbsCode}
      </div>

      {/* Name (flex-1) */}
      <div
        className="flex-1 min-w-[140px] flex items-center gap-1.5"
        style={{ paddingLeft: depth * 16 + 8, paddingRight: 8 }}
      >
        {/* Expand-Icon (nur wenn hasChildren) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (item.hasChildren) onToggleExpand();
          }}
          className={`w-5 h-5 flex items-center justify-center rounded shrink-0 ${
            item.hasChildren ? "hover:bg-gray-200" : "cursor-default"
          }`}
          tabIndex={-1}
          aria-label={
            item.hasChildren
              ? isExpanded
                ? "Einklappen"
                : "Ausklappen"
              : undefined
          }
        >
          {iconNode}
        </button>

        {/* Name */}
        <span
          className={`truncate ${
            item.hasChildren
              ? "font-semibold text-gray-900"
              : "text-gray-800"
          }`}
          title={item.name}
        >
          {item.name}
        </span>
      </div>

      {/* Status-Badge (mit Verspätet-Indikator als Icon) */}
      {!compact && (
      <>
      <div className="shrink-0 w-[90px] px-2 flex items-center gap-1">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            item.isDelayed ? "bg-red-100 text-red-700" : `${status.bg} ${status.text}`
          }`}
          title={item.isDelayed ? `${status.label} · Verspätet` : status.label}
        >
          {item.isDelayed ? "Verspätet" : status.label}
        </span>
        {item.isDelayed && (
          <AlertTriangle
            className="w-3 h-3 text-red-500 shrink-0"
            aria-label="Verspätet"
          />
        )}
      </div>

      {/* Gewerk-Badge */}
      <div className="shrink-0 w-[130px] px-2">
        {tradeCategory ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-${tradeColor}-100 text-${tradeColor}-700 truncate max-w-full`}
            title={tradeCategory.name}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-${tradeColor}-500 shrink-0`} />
            <span className="truncate">{tradeCategory.name}</span>
          </span>
        ) : (
          <span className="text-[10px] text-gray-300">—</span>
        )}
      </div>

      {/* Start */}
      <div className="shrink-0 w-[90px] px-2 text-xs text-gray-600 font-mono">
        {dateShort(start)}
      </div>

      {/* Ende */}
      <div className="shrink-0 w-[90px] px-2 text-xs text-gray-600 font-mono">
        {dateShort(end)}
      </div>

      {/* Dauer (Arbeitstage) */}
      <div className="shrink-0 w-[60px] px-2 text-xs text-gray-500 text-right tabular-nums">
        {item.isMilestone ? "—" : `${item.durationWorkdays}d`}
      </div>
      </>
      )}

      {/* Aktionen: Bearbeiten + Unter-AP anlegen */}
      <div className="shrink-0 w-[56px] flex items-center justify-center gap-0.5 pr-1">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700 transition-all"
              title="Bearbeiten"
              aria-label="Bearbeiten"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onAddChild}
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700 transition-all"
              title="Unter-Arbeitspaket anlegen"
              aria-label="Unter-Arbeitspaket anlegen"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
