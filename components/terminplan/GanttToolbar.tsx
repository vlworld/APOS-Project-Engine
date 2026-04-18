"use client";

// Toolbar über dem Gantt-Chart: Zoom, Filter, View-Switch, Add-Button.

import { useEffect, useRef, useState } from "react";
import {
  Filter,
  Plus,
  ChevronDown,
  ListTree,
  GanttChart as GanttIcon,
  Check,
} from "lucide-react";
import type { TradeCategoryDTO } from "@/lib/terminplan/types";
import type { GanttView, ZoomLevel } from "./types";
import { safeColor } from "./TailwindColorSafelist";

interface GanttToolbarProps {
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  view: GanttView;
  onViewChange: (view: GanttView) => void;
  tradeCategories: TradeCategoryDTO[];
  selectedTradeIds: Set<string>;
  onToggleTrade: (id: string) => void;
  onResetTrades: () => void;
  canEdit: boolean;
  onAddClick: () => void;
}

const ZOOM_LEVELS: { value: ZoomLevel; label: string }[] = [
  { value: "DAY", label: "Tag" },
  { value: "WEEK", label: "Woche" },
  { value: "MONTH", label: "Monat" },
];

export default function GanttToolbar({
  zoomLevel,
  onZoomChange,
  view,
  onViewChange,
  tradeCategories,
  selectedTradeIds,
  onToggleTrade,
  onResetTrades,
  canEdit,
  onAddClick,
}: GanttToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filterOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFilterOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const filterActive =
    selectedTradeIds.size > 0 && selectedTradeIds.size !== tradeCategories.length;
  const filterLabel = filterActive
    ? `${selectedTradeIds.size}/${tradeCategories.length} Gewerke`
    : "Alle Gewerke";

  return (
    <div className="flex items-center gap-2 h-10 px-3 border-b border-gray-200 bg-white">
      {/* Add-Button (links) */}
      {canEdit && (
        <button
          type="button"
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Arbeitspaket
        </button>
      )}

      <div className="flex-1" />

      {/* Zoom-Switch (rechts) */}
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
        {ZOOM_LEVELS.map((z) => {
          const active = z.value === zoomLevel;
          return (
            <button
              key={z.value}
              type="button"
              onClick={() => onZoomChange(z.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {z.label}
            </button>
          );
        })}
      </div>

      {/* Gewerk-Filter (rechts) */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            filterActive
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          {filterLabel}
          <ChevronDown className="w-3 h-3" />
        </button>

        {filterOpen && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">
                Gewerke filtern
              </span>
              <button
                type="button"
                onClick={onResetTrades}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Alle
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {tradeCategories.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400">
                  Keine Gewerke angelegt.
                </div>
              ) : (
                tradeCategories.map((tc) => {
                  const color = safeColor(tc.color);
                  const checked = selectedTradeIds.has(tc.id);
                  return (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => onToggleTrade(tc.id)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 bg-${color}-500`}
                      />
                      <span className="flex-1 truncate text-gray-700">
                        {tc.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* View-Switch */}
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("GANTT")}
          title="Gantt-Ansicht"
          className={`p-1 rounded-md transition-colors ${
            view === "GANTT"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <GanttIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("LIST")}
          title="Listen-Ansicht"
          className={`p-1 rounded-md transition-colors ${
            view === "LIST"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <ListTree className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
