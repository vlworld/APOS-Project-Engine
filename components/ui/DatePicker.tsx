"use client";

// Portiert 1:1 von OOS (apps/oos/components/ui/DatePicker.tsx).
// Custom Kalender — NIEMALS nativen <input type="date"> verwenden (UX-Richtlinie).

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface DatePickerProps {
  value: string;                    // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
  className?: string;
  /** Beim Mount direkt öffnen */
  autoOpen?: boolean;
  /** Callback wenn der Kalender geschlossen wird */
  onClose?: () => void;
  /** Trigger ausblenden — nur der Kalender-Popover wird angezeigt */
  hideTrigger?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  error,
  placeholder = "Datum wählen...",
  className = "",
  autoOpen = false,
  onClose,
  hideTrigger = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
    onClose?.();
  }

  function closePanel() {
    setOpen(false);
    onClose?.();
  }

  function isSelected(day: number) {
    return selected?.getFullYear() === viewYear && selected?.getMonth() === viewMonth && selected?.getDate() === day;
  }
  function isToday(day: number) {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  }

  const displayValue = selected
    ? `${selected.getDate()}. ${MONTH_NAMES[selected.getMonth()]} ${selected.getFullYear()}`
    : placeholder;

  return (
    <div className={`relative ${className}`}>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all w-full text-left
            ${error ? "border-red-300 ring-2 ring-red-100" : "border-gray-200 hover:border-blue-300"}
            ${selected ? "text-gray-800" : "text-gray-400"}
            bg-white
          `}
        >
          <Calendar size={14} className="text-gray-400 shrink-0" />
          {displayValue}
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={closePanel} />
          <div className="absolute z-50 mt-2 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                <ChevronLeft size={16} className="text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-800">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                <ChevronRight size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => (
                <div key={i} className="aspect-square flex items-center justify-center">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => selectDay(day)}
                      className={`
                        w-9 h-9 rounded-full text-sm font-medium transition-all
                        ${isSelected(day)
                          ? "bg-blue-600 text-white shadow-md"
                          : isToday(day)
                            ? "bg-blue-50 text-blue-600 font-semibold"
                            : "text-gray-700 hover:bg-gray-100"
                        }
                      `}
                    >
                      {day}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); onClose?.(); }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Löschen
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = new Date();
                  const m = String(t.getMonth() + 1).padStart(2, "0");
                  const d = String(t.getDate()).padStart(2, "0");
                  onChange(`${t.getFullYear()}-${m}-${d}`);
                  setOpen(false);
                  onClose?.();
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Heute
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
