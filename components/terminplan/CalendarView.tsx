"use client";

// CalendarView — Monats-/Wochenkalender für den Terminplan.
// Zeigt ScheduleItems als Events am Start-Tag. Click auf leeren Tag öffnet
// DeadlineModal, Click auf Event öffnet (künftig) ScheduleItemModal.
//
// Light-first Tailwind. Keine <input type="date"> — nur Custom-DatePicker
// (via DeadlineModal). Deutsche Wochentage Mo–So, Monatsnamen deutsch.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import type {
  ScheduleItemDTO,
  TerminplanResponseDTO,
  TradeCategoryDTO,
} from "@/lib/terminplan/types";
import {
  addDays,
  addMonths,
  formatDateFull,
  formatMonthLabel,
  formatWeekdayShort,
  getIsoWeekday,
  startOfMonth,
  startOfWeek,
} from "@/lib/terminplan/time";
import { useToast } from "@/components/ui/Toast";
import CalendarCell from "@/components/terminplan/CalendarCell";
import DeadlineModal from "@/components/terminplan/DeadlineModal";
import TailwindColorSafelist from "@/components/terminplan/TailwindColorSafelist";

type ViewMode = "MONTH" | "WEEK";

interface CalendarViewProps {
  projectId: string;
  canEdit: boolean;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Parst "YYYY-MM-DD" oder ISO-String in ein lokales Date (Mitternacht).
 */
function parseDate(iso: string): Date {
  // Wenn nur YYYY-MM-DD: als lokales Datum interpretieren.
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  if (isoDateOnly) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(iso);
  return startOfDay(parsed);
}

export default function CalendarView({ projectId, canEdit }: CalendarViewProps) {
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return startOfMonth(now);
  });
  const [hasAutoJumped, setHasAutoJumped] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");
  const [items, setItems] = useState<ScheduleItemDTO[]>([]);
  const [tradeCategories, setTradeCategories] = useState<TradeCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDayDate, setOpenDayDate] = useState<Date | null>(null);

  // Nach dem ersten Laden zum frühesten Event (bevorzugt Milestone) springen,
  // damit der User nicht in einem leeren Monat landet.
  useEffect(() => {
    if (hasAutoJumped || items.length === 0) return;
    const sorted = [...items].sort(
      (a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
    );
    const target = sorted.find((i) => i.isMilestone) ?? sorted[0];
    if (target) {
      setCurrentMonth(startOfMonth(parseDate(target.startDate)));
      setHasAutoJumped(true);
    }
  }, [items, hasAutoJumped]);

  // editingItem: Click auf Event öffnet künftig den ScheduleItemModal.
  // Bis das Modal existiert, geben wir einen Info-Toast aus.
  const [editingItem, setEditingItem] = useState<ScheduleItemDTO | null>(null);
  useEffect(() => {
    if (editingItem) {
      toast({
        title: editingItem.name,
        description: `Start: ${formatDateFull(parseDate(editingItem.startDate))} · Ende: ${formatDateFull(parseDate(editingItem.endDate))}`,
        variant: "info",
      });
      setEditingItem(null);
    }
  }, [editingItem, toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projekte/${projectId}/terminplan`);
      if (!res.ok) {
        // 501-Stub oder anderer Fehler — leere Liste anzeigen, aber nicht crashen.
        setItems([]);
        setTradeCategories([]);
        return;
      }
      const json = (await res.json()) as Partial<TerminplanResponseDTO>;
      setItems(Array.isArray(json.items) ? json.items : []);
      setTradeCategories(
        Array.isArray(json.tradeCategories) ? json.tradeCategories : [],
      );
    } catch {
      setItems([]);
      setTradeCategories([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Index: tradeCategoryId -> color
  const colorByTradeCategory = useMemo(() => {
    const m = new Map<string, string>();
    for (const tc of tradeCategories) m.set(tc.id, tc.color);
    return m;
  }, [tradeCategories]);

  // Events pro Tag (key = YYYY-MM-DD).
  // Für v1: Event erscheint nur am Start-Tag.
  const eventsByDay = useMemo(() => {
    const map = new Map<
      string,
      { item: ScheduleItemDTO; color: string | null }[]
    >();
    for (const it of items) {
      const d = parseDate(it.startDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const color = it.tradeCategoryId
        ? colorByTradeCategory.get(it.tradeCategoryId) ?? null
        : it.color;
      const arr = map.get(key) ?? [];
      arr.push({ item: it, color });
      map.set(key, arr);
    }
    // Pro Tag: Meilensteine zuerst, dann nach Name.
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.item.isMilestone !== b.item.isMilestone) {
          return a.item.isMilestone ? -1 : 1;
        }
        return a.item.name.localeCompare(b.item.name, "de");
      });
    }
    return map;
  }, [items, colorByTradeCategory]);

  // Zellen für den aktuell sichtbaren Bereich.
  const cells = useMemo<Date[]>(() => {
    if (viewMode === "WEEK") {
      const start = startOfWeek(currentMonth);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    // MONTH: 6 Reihen × 7 = 42 Tage, Start = Montag der Woche des 1.
    const firstOfMonth = startOfMonth(currentMonth);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [currentMonth, viewMode]);

  // Navigation
  const goPrev = useCallback(() => {
    setCurrentMonth((d) =>
      viewMode === "WEEK" ? addDays(d, -7) : addMonths(d, -1),
    );
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentMonth((d) =>
      viewMode === "WEEK" ? addDays(d, 7) : addMonths(d, 1),
    );
  }, [viewMode]);

  const goToday = useCallback(() => {
    setCurrentMonth(startOfMonth(new Date()));
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Label oben: „April 2025" (Monat) oder Wochen-Range.
  const rangeLabel = useMemo(() => {
    if (viewMode === "MONTH") return formatMonthLabel(currentMonth);
    const weekStart = startOfWeek(currentMonth);
    const weekEnd = addDays(weekStart, 6);
    return `${formatDateFull(weekStart)} – ${formatDateFull(weekEnd)}`;
  }, [currentMonth, viewMode]);

  // Wochentag-Header (Mo … So).
  const weekdayHeaders = useMemo(() => {
    // Referenz-Montag — irgendein bekannter Montag, z. B. 2024-01-01.
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) =>
      formatWeekdayShort(addDays(monday, i)),
    );
  }, []);

  const handleCellEmptyClick = useCallback(
    (date: Date) => {
      if (!canEdit) return;
      setOpenDayDate(date);
    },
    [canEdit],
  );

  const handleEventClick = useCallback((item: ScheduleItemDTO) => {
    setEditingItem(item);
  }, []);

  const handleDeadlineSaved = useCallback(
    (item: ScheduleItemDTO) => {
      setItems((prev) => [...prev, item]);
      void fetchData();
    },
    [fetchData],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Tailwind-Safelist — sorgt dafür, dass dynamische Farbklassen erhalten bleiben. */}
      <TailwindColorSafelist />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Zurück"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Heute
          </button>
          <button
            type="button"
            onClick={goNext}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="Weiter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 ml-2">
            {rangeLabel}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode-Switch */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            {(["MONTH", "WEEK"] as const).map((mode) => {
              const active = viewMode === mode;
              const label = mode === "MONTH" ? "Monat" : "Woche";
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    active
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setOpenDayDate(startOfDay(new Date()))}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Deadline
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Wochentag-Header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekdayHeaders.map((wd, idx) => (
            <div
              key={wd}
              className={`px-2 py-2 text-xs font-semibold uppercase tracking-wide ${
                idx >= 5 ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Cells */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : items.length === 0 && !canEdit ? (
          <div className="p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Noch keine Termine
            </h3>
            <p className="text-sm text-gray-500">
              Für diesen Zeitraum sind keine Einträge vorhanden.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const wd = getIsoWeekday(date);
              const isWeekend = wd === 6 || wd === 7;
              const isCurrentMonth =
                viewMode === "WEEK" ||
                date.getMonth() === currentMonth.getMonth();
              const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
              const events = eventsByDay.get(key) ?? [];

              return (
                <CalendarCell
                  key={key}
                  date={date}
                  isCurrentMonth={isCurrentMonth}
                  isToday={sameDay(date, today)}
                  isWeekend={isWeekend}
                  events={events}
                  canEdit={canEdit}
                  onClickEvent={handleEventClick}
                  onClickEmpty={handleCellEmptyClick}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Deadline-Modal */}
      {openDayDate && (
        <DeadlineModal
          open
          projectId={projectId}
          initialDate={openDayDate}
          tradeCategories={tradeCategories}
          onClose={() => setOpenDayDate(null)}
          onSaved={handleDeadlineSaved}
        />
      )}
    </div>
  );
}
