"use client";

// CalendarCell — eine einzelne Tageszelle im Monatskalender.
// Stapelt bis zu `maxEvents` Events, zeigt bei Überfluss "+N weitere".
// Clickable wenn canEdit=true: leere Fläche -> onClickEmpty; Event -> onClickEvent.

import type { ScheduleItemDTO } from "@/lib/terminplan/types";
import { Diamond } from "lucide-react";
import { safeColor } from "@/components/terminplan/TailwindColorSafelist";

interface CalendarCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: ReadonlyArray<{ item: ScheduleItemDTO; color: string | null }>;
  canEdit: boolean;
  onClickEvent: (item: ScheduleItemDTO) => void;
  onClickEmpty: (date: Date) => void;
  maxEvents?: number;
}

export default function CalendarCell({
  date,
  isCurrentMonth,
  isToday,
  isWeekend,
  events,
  canEdit,
  onClickEvent,
  onClickEmpty,
  maxEvents = 3,
}: CalendarCellProps) {
  const visible = events.slice(0, maxEvents);
  const overflow = Math.max(0, events.length - maxEvents);

  const bg = isWeekend ? "bg-gray-50" : "bg-white";
  const hover = canEdit ? "hover:bg-blue-50/50 cursor-pointer" : "";

  return (
    <div
      className={`h-24 lg:h-28 border border-gray-100 p-1 overflow-hidden flex flex-col gap-0.5 transition-colors ${bg} ${hover}`}
      onClick={(e) => {
        if (!canEdit) return;
        // Nur reagieren, wenn der Click die Zelle selbst war (nicht auf einem Event).
        if (e.target === e.currentTarget) {
          onClickEmpty(date);
        }
      }}
    >
      {/* Tages-Nummer oben rechts */}
      <div
        className="flex items-start justify-end"
        onClick={(e) => {
          if (!canEdit) return;
          e.stopPropagation();
          onClickEmpty(date);
        }}
      >
        {isToday ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-semibold ring-2 ring-emerald-200">
            {date.getDate()}
          </span>
        ) : (
          <span
            className={`text-xs font-medium ${
              isCurrentMonth ? "text-gray-600" : "text-gray-400"
            }`}
          >
            {date.getDate()}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="flex-1 flex flex-col gap-0.5 min-h-0">
        {visible.map(({ item, color }) => {
          const c = color ? safeColor(color) : null;
          const chipBase =
            "text-[10px] truncate rounded px-1 py-0.5 flex items-center gap-1 border-l-2 cursor-pointer transition-colors";
          const chipColors = c
            ? `bg-${c}-100 text-${c}-700 border-${c}-500 hover:bg-${c}-200`
            : "bg-gray-100 text-gray-700 border-gray-400 hover:bg-gray-200";

          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClickEvent(item);
              }}
              className={`${chipBase} ${chipColors} text-left`}
              title={item.name}
            >
              {item.isMilestone && (
                <Diamond className="w-2.5 h-2.5 shrink-0" />
              )}
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}

        {overflow > 0 && (
          <span
            className="text-[10px] text-gray-500 px-1 mt-auto"
            onClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              onClickEmpty(date);
            }}
          >
            +{overflow} weitere
          </span>
        )}
      </div>
    </div>
  );
}
