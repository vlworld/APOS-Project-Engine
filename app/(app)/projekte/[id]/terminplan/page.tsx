"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarRange,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  Diamond,
} from "lucide-react";

interface ScheduleItem {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  progressPercent: number;
  isCriticalPath: boolean;
  color: string | null;
  dependsOn: { id: string; title: string } | null;
  workPackage: { id: string; title: string; wbsCode: string } | null;
}

const TYPE_COLORS: Record<string, { bar: string; bg: string }> = {
  TASK: { bar: "bg-blue-500", bg: "bg-blue-100" },
  MILESTONE: { bar: "bg-purple-500", bg: "bg-purple-100" },
  PHASE: { bar: "bg-gray-400", bg: "bg-gray-100" },
};

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function getWeekNumbers(monthStart: Date): { week: number; offsetDays: number; widthDays: number }[] {
  const weeks: { week: number; offsetDays: number; widthDays: number }[] = [];
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();

  let current = new Date(monthStart);
  while (current <= monthEnd) {
    // ISO week number
    const temp = new Date(current.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

    const offsetDays = current.getDate() - 1;
    // Find end of this week within the month
    const endOfWeek = new Date(current);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - ((endOfWeek.getDay() + 6) % 7)) % 7 || 7);
    if (endOfWeek.getDate() < current.getDate() || endOfWeek > monthEnd) {
      // End of week goes past month end
      weeks.push({ week: weekNum, offsetDays, widthDays: daysInMonth - offsetDays });
      break;
    } else {
      const widthDays = endOfWeek.getDate() - current.getDate() + 1;
      weeks.push({ week: weekNum, offsetDays, widthDays });
      current = new Date(endOfWeek);
      current.setDate(current.getDate() + 1);
    }
  }

  return weeks;
}

export default function TerminplanPage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    startDate: "",
    endDate: "",
    type: "TASK",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projekte/${id}/terminplan`);
      if (res.ok) {
        setItems(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate timeline range
  const { timelineStart, months, totalDays } = useMemo(() => {
    if (items.length === 0) {
      const now = new Date();
      const start = startOfMonth(now);
      const monthList: Date[] = [];
      for (let i = 0; i < 4; i++) monthList.push(addMonths(start, i));
      const end = addMonths(start, 4);
      return { timelineStart: start, months: monthList, totalDays: daysBetween(start, end) };
    }

    const allDates = items.flatMap((i) => [new Date(i.startDate), new Date(i.endDate)]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Add padding: start 1 month before, end 1 month after, minimum 3 months
    const start = addMonths(startOfMonth(minDate), -1);
    const endCandidate = addMonths(startOfMonth(maxDate), 2);
    const minEnd = addMonths(start, 3);
    const end = endCandidate > minEnd ? endCandidate : minEnd;

    const monthList: Date[] = [];
    let cursor = new Date(start);
    while (cursor < end) {
      monthList.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }

    return { timelineStart: start, months: monthList, totalDays: daysBetween(start, end) };
  }, [items]);

  function getBarStyle(item: ScheduleItem) {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    const offsetDays = daysBetween(timelineStart, start);
    const durationDays = Math.max(daysBetween(start, end), 1);

    const leftPercent = (offsetDays / totalDays) * 100;
    const widthPercent = (durationDays / totalDays) * 100;

    return {
      left: `${Math.max(leftPercent, 0)}%`,
      width: `${Math.max(widthPercent, 0.5)}%`,
    };
  }

  // Today marker position
  const todayOffset = useMemo(() => {
    const today = new Date();
    const offset = daysBetween(timelineStart, today);
    if (offset < 0 || offset > totalDays) return null;
    return (offset / totalDays) * 100;
  }, [timelineStart, totalDays]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim() || !formData.startDate || !formData.endDate) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/projekte/${id}/terminplan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: "", startDate: "", endDate: "", type: "TASK" });
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const ROW_HEIGHT = 40;
  const HEADER_HEIGHT = 56;
  const LABEL_WIDTH = 260;

  return (
    <div className="max-w-full">
      {/* Back link */}
      <Link
        href={`/projekte/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zum Projekt
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <CalendarRange className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Terminplan</h1>
            <p className="text-sm text-gray-500">
              {items.length} {items.length === 1 ? "Eintrag" : "Einträge"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neuer Eintrag
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Neuer Terminplan-Eintrag</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="z.B. Erdarbeiten Phase 1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  <option value="TASK">Vorgang</option>
                  <option value="MILESTONE">Meilenstein</option>
                  <option value="PHASE">Phase</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gantt Chart */}
      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <CalendarRange className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Einträge</h2>
          <p className="text-sm text-gray-500 mb-4">
            Erstellen Sie den ersten Terminplan-Eintrag für dieses Projekt.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Neuer Eintrag
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${LABEL_WIDTH + months.length * 150}px` }}>
              {/* Timeline Header */}
              <div className="flex border-b border-gray-200" style={{ height: HEADER_HEIGHT }}>
                {/* Label column header */}
                <div
                  className="shrink-0 border-r border-gray-200 bg-gray-50 flex items-end px-4 pb-2"
                  style={{ width: LABEL_WIDTH }}
                >
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vorgang
                  </span>
                </div>

                {/* Month headers */}
                <div className="flex-1 relative bg-gray-50">
                  <div className="flex h-full">
                    {months.map((month, idx) => {
                      const monthDays =
                        idx < months.length - 1
                          ? daysBetween(month, months[idx + 1])
                          : daysBetween(month, addMonths(month, 1));
                      const widthPercent = (monthDays / totalDays) * 100;

                      return (
                        <div
                          key={month.toISOString()}
                          className="border-r border-gray-200 flex flex-col justify-between"
                          style={{ width: `${widthPercent}%` }}
                        >
                          <div className="px-2 pt-2 text-xs font-semibold text-gray-700">
                            {formatMonthYear(month)}
                          </div>
                          <div className="flex">
                            {getWeekNumbers(month).map((w) => {
                              const wPct = (w.widthDays / monthDays) * 100;
                              return (
                                <div
                                  key={`${month.toISOString()}-w${w.week}`}
                                  className="text-center text-[10px] text-gray-400 border-r border-gray-100 last:border-r-0 pb-1"
                                  style={{ width: `${wPct}%` }}
                                >
                                  KW{w.week}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rows */}
              {items.map((item) => {
                const typeColor = TYPE_COLORS[item.type] || TYPE_COLORS.TASK;
                const barStyle = getBarStyle(item);

                return (
                  <div
                    key={item.id}
                    className="flex border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Label */}
                    <div
                      className="shrink-0 border-r border-gray-200 flex items-center px-4 gap-2 min-w-0"
                      style={{ width: LABEL_WIDTH }}
                    >
                      {item.type === "MILESTONE" && (
                        <Diamond className="w-3 h-3 text-purple-500 shrink-0" />
                      )}
                      <span className="text-sm text-gray-900 truncate">{item.title}</span>
                      {item.isCriticalPath && (
                        <span className="shrink-0 text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">
                          KP
                        </span>
                      )}
                    </div>

                    {/* Bar area */}
                    <div className="flex-1 relative">
                      {/* Today marker */}
                      {todayOffset !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                          style={{ left: `${todayOffset}%` }}
                        />
                      )}

                      {/* Bar */}
                      {item.type === "MILESTONE" ? (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                          style={{ left: barStyle.left }}
                        >
                          <div className="w-3 h-3 bg-purple-500 rotate-45 border border-purple-600" />
                        </div>
                      ) : (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 rounded-sm overflow-hidden ${
                            item.isCriticalPath ? "ring-1 ring-red-400" : ""
                          } ${item.type === "PHASE" ? "h-3" : "h-5"}`}
                          style={{
                            left: barStyle.left,
                            width: barStyle.width,
                          }}
                        >
                          {/* Background */}
                          <div className={`absolute inset-0 ${typeColor.bg} ${item.isCriticalPath ? "bg-red-100" : ""}`} />
                          {/* Progress fill */}
                          <div
                            className={`absolute inset-y-0 left-0 ${
                              item.isCriticalPath ? "bg-red-500" : typeColor.bar
                            } opacity-80`}
                            style={{ width: `${item.progressPercent}%` }}
                          />
                          {/* Label on bar */}
                          {item.type === "TASK" && (
                            <div className="absolute inset-0 flex items-center px-1.5">
                              <span className="text-[10px] text-white font-medium truncate drop-shadow-sm">
                                {item.progressPercent > 0 ? `${item.progressPercent}%` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Legend */}
              <div className="flex items-center gap-6 px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-2.5 bg-blue-500 rounded-sm" />
                  Vorgang
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-purple-500 rotate-45" />
                  Meilenstein
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-1.5 bg-gray-400 rounded-sm" />
                  Phase
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-2.5 bg-red-500 rounded-sm ring-1 ring-red-400" />
                  Kritischer Pfad
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-px h-3 bg-red-400" />
                  Heute
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
