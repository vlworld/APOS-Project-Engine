"use client";

// Create/Edit-Modal für Schedule-Items (Arbeitspakete / Meilensteine).
// - Escape schließt, Ctrl/Cmd+S speichert.
// - Alle Datumsfelder über <DatePicker> (nie native).
// - Optional: Farb-Override über Farb-Picker.

import { useEffect, useState, useRef, useMemo } from "react";
import { X, Loader2, Palette, Flag, Plus, Trash2 } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import type {
  CreateScheduleItemInput,
  ScheduleItemDTO,
  TradeCategoryDTO,
} from "@/lib/terminplan/types";
import {
  TERMINPLAN_COLORS,
  safeColor,
} from "./TailwindColorSafelist";

// Kuratierte Auswahl für den Color-Picker (Untermenge der TERMINPLAN_COLORS).
// Voller Satz bleibt für Gewerke verfügbar; im Item-Override reicht die Auswahl.
const PALETTE_COLORS = [
  "slate", "blue", "cyan", "teal", "emerald",
  "lime", "amber", "orange", "red", "rose",
  "violet", "fuchsia",
] as const;
// Damit TS-Strict gegen TERMINPLAN_COLORS-Typ matcht
void TERMINPLAN_COLORS;

interface ProjectMember {
  id: string;
  name: string | null;
  email: string;
}

interface ScheduleItemModalProps {
  open: boolean;
  item?: ScheduleItemDTO | null;
  parentId?: string | null;
  projectId: string;
  tradeCategories: TradeCategoryDTO[];
  members?: ProjectMember[];
  onClose: () => void;
  onSaved: () => void;
}

type EventFormState = {
  // "new-<n>" oder echte ID
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  status: "PLANNED" | "SCHEDULED" | "DONE";
};

type FormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  bufferDays: number; // 0 = kein Puffer
  deadline: string; // "" = keine Deadline
  progress: number;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  tradeCategoryId: string;
  isMilestone: boolean;
  isTimeRange: boolean;
  events: EventFormState[];
  color: string; // "" = keine Override
  assignedToId: string;
};

let nextTempEventId = 0;
function makeTempEventId(): string {
  nextTempEventId += 1;
  return `new-${nextTempEventId}-${Date.now()}`;
}

function toYMD(iso: string | undefined | null): string {
  if (!iso) return "";
  // akzeptiert "YYYY-MM-DD" oder ISO-String
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyForm(): FormState {
  const today = new Date();
  const ymd = toYMD(today.toISOString());
  return {
    name: "",
    description: "",
    startDate: ymd,
    endDate: ymd,
    bufferDays: 0,
    deadline: "",
    progress: 0,
    status: "OPEN",
    tradeCategoryId: "",
    isMilestone: false,
    isTimeRange: false,
    events: [],
    color: "",
    assignedToId: "",
  };
}

export default function ScheduleItemModal({
  open,
  item,
  parentId,
  projectId,
  tradeCategories,
  members = [],
  onClose,
  onSaved,
}: ScheduleItemModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { toast } = useToast();

  const isEdit = Boolean(item);

  // Initialisieren, wenn Modal geöffnet wird
  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name,
        description: item.description ?? "",
        startDate: toYMD(item.startDate),
        endDate: toYMD(item.endDate),
        bufferDays: item.bufferDays ?? 0,
        deadline: toYMD(item.deadline),
        progress: item.progress,
        status: item.status,
        tradeCategoryId: item.tradeCategoryId ?? "",
        isMilestone: item.isMilestone,
        isTimeRange: item.isTimeRange ?? false,
        events: (item.events ?? []).map((ev) => ({
          id: ev.id,
          date: toYMD(ev.date),
          label: ev.label ?? "",
          status: ev.status,
        })),
        color: item.color ?? "",
        assignedToId: item.assignedToId ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, item]);

  // Escape + Ctrl/Cmd+S Handling
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!saving) onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  // Body-Scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const tradeById = useMemo(() => {
    const map = new Map<string, TradeCategoryDTO>();
    for (const tc of tradeCategories) map.set(tc.id, tc);
    return map;
  }, [tradeCategories]);

  const previewColor = useMemo(() => {
    if (form.color) return safeColor(form.color);
    if (form.tradeCategoryId) {
      const tc = tradeById.get(form.tradeCategoryId);
      if (tc) return safeColor(tc.color);
    }
    return safeColor("blue");
  }, [form.color, form.tradeCategoryId, tradeById]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Name fehlt", variant: "error" });
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast({ title: "Start- und Enddatum wählen", variant: "error" });
      return;
    }
    if (form.endDate < form.startDate) {
      toast({ title: "Ende darf nicht vor Start liegen", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload: CreateScheduleItemInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        // Milestone hat per Definition keine Dauer → kein Puffer.
        bufferDays: form.isMilestone ? 0 : Math.max(0, Math.floor(form.bufferDays)),
        deadline: form.deadline || null,
        isTimeRange: form.isTimeRange,
        // Events nur senden, wenn isTimeRange (sonst leer = delete all).
        events: form.isTimeRange
          ? form.events
              .filter((ev) => ev.date) // unvollständige Events filtern
              .map((ev, idx) => ({
                date: ev.date,
                label: ev.label.trim() || null,
                status: ev.status,
                orderIndex: idx,
              }))
          : [],
        progress: form.isMilestone ? 0 : form.progress,
        status: form.status,
        tradeCategoryId: form.tradeCategoryId || null,
        isMilestone: form.isMilestone,
        color: form.color || null,
        assignedToId: form.assignedToId || null,
        parentId: isEdit ? undefined : parentId ?? null,
      };

      const url = isEdit
        ? `/api/projekte/${projectId}/terminplan/${item?.id}`
        : `/api/projekte/${projectId}/terminplan`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast({
          title: body.error ?? "Speichern fehlgeschlagen",
          variant: "error",
        });
        return;
      }
      toast({
        title: isEdit ? "Arbeitspaket aktualisiert" : "Arbeitspaket angelegt",
        variant: "success",
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-3 h-3 rounded-full shrink-0 bg-${previewColor}-500`}
            />
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {isEdit ? "Arbeitspaket bearbeiten" : "Neues Arbeitspaket"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="z.B. Erdarbeiten Phase 1"
              autoFocus
              required
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder="Details zum Arbeitspaket ..."
            />
          </div>

          {/* Start / Ende */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={form.startDate}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    startDate: v,
                    // Wenn Milestone: end = start
                    endDate: f.isMilestone ? v : f.endDate || v,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ende <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={form.endDate}
                onChange={(v) =>
                  setForm((f) => ({ ...f, endDate: v }))
                }
              />
            </div>
          </div>

          {/* Milestone + Zeitraum: gegenseitig ausschließend */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isMilestone}
                disabled={form.isTimeRange}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isMilestone: e.target.checked,
                    // Bei Milestone: end = start, kein Puffer
                    endDate: e.target.checked ? f.startDate : f.endDate,
                    bufferDays: e.target.checked ? 0 : f.bufferDays,
                  }))
                }
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
              />
              <span className={`text-sm ${form.isTimeRange ? "text-gray-400" : "text-gray-700"}`}>
                Ist Meilenstein (fester Stichtag ohne Dauer)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isTimeRange}
                disabled={form.isMilestone}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isTimeRange: e.target.checked,
                    // Zeitraum schließt Puffer + Progress aus (Zeitraum hat eigenes Event-Tracking)
                    bufferDays: e.target.checked ? 0 : f.bufferDays,
                  }))
                }
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
              />
              <span className={`text-sm ${form.isMilestone ? "text-gray-400" : "text-gray-700"}`}>
                Ist Zeitraum (z.B. „Modullieferung KW 14–15") mit Einzel-Events
              </span>
            </label>
          </div>

          {/* Zeitraum-Events — nur wenn isTimeRange */}
          {form.isTimeRange && (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Einzel-Events innerhalb des Zeitraums
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      events: [
                        ...f.events,
                        {
                          id: makeTempEventId(),
                          date: f.startDate,
                          label: "",
                          status: "PLANNED",
                        },
                      ],
                    }))
                  }
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Event
                </button>
              </div>
              {form.events.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Noch keine Events. Beispiel: „Teillieferung 1" am konkreten Tag.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.events.map((ev, idx) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200"
                    >
                      <div className="w-32 shrink-0">
                        <DatePicker
                          value={ev.date}
                          onChange={(v) =>
                            setForm((f) => {
                              const events = [...f.events];
                              events[idx] = { ...events[idx], date: v };
                              return { ...f, events };
                            })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={ev.label}
                        onChange={(e) =>
                          setForm((f) => {
                            const events = [...f.events];
                            events[idx] = { ...events[idx], label: e.target.value };
                            return { ...f, events };
                          })
                        }
                        placeholder={`Label (optional, z.B. „Teillieferung 1")`}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <select
                        value={ev.status}
                        onChange={(e) =>
                          setForm((f) => {
                            const events = [...f.events];
                            events[idx] = {
                              ...events[idx],
                              status: e.target.value as EventFormState["status"],
                            };
                            return { ...f, events };
                          })
                        }
                        className="w-40 px-2 py-1 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="PLANNED">Geplant (noch offen)</option>
                        <option value="SCHEDULED">Abgestimmt</option>
                        <option value="DONE">Erledigt</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            events: f.events.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Event entfernen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400">
                Events werden im Gantt als farbige Kästchen im Zeitraum dargestellt.
                <span className="inline-block w-2 h-2 rounded-sm bg-gray-200 border border-dashed border-gray-500 mx-1 align-middle" />
                geplant,
                <span className="inline-block w-2 h-2 rounded-sm bg-blue-600 mx-1 align-middle" />
                abgestimmt,
                <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mx-1 align-middle" />
                erledigt.
              </p>
            </div>
          )}

          {/* Deadline — harter Termin, mit rotem Flag im Gantt markiert.
              Kann unabhängig von endDate + bufferDays gesetzt werden
              (z.B. für Förderzusage, Netzzusage). */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-red-500" style={{ fill: "currentColor" }} />
              Deadline
              <span className="text-xs font-normal text-gray-400">
                (optional, als rotes Flag im Gantt)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DatePicker
                  value={form.deadline}
                  onChange={(v) => setForm((f) => ({ ...f, deadline: v }))}
                />
              </div>
              {form.deadline && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, deadline: "" }))}
                  className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Deadline entfernen"
                >
                  Entfernen
                </button>
              )}
            </div>
          </div>

          {/* Puffer — nur für normale Arbeitspakete, nicht für Milestones. */}
          {!form.isMilestone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                Puffer nach Ende
                <span className="text-xs font-normal text-gray-400">
                  (optional, wird schraffiert dargestellt)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={form.bufferDays}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(365, Number(e.target.value)));
                    setForm((f) => ({
                      ...f,
                      bufferDays: isNaN(v) ? 0 : v,
                    }));
                  }}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-500">
                  Arbeitstage
                </span>
                {/* Mini-Preview: zeigt Kern-Balken + Puffer, damit der User
                    den visuellen Effekt direkt sieht, bevor er speichert. */}
                <div className="flex-1 flex items-center gap-0 h-5">
                  <div
                    className={`h-full rounded-l-sm bg-${previewColor}-500`}
                    style={{ width: form.bufferDays > 0 ? "55%" : "100%" }}
                  />
                  {form.bufferDays > 0 && (
                    <div
                      className={`h-3 self-center rounded-r-sm bg-${previewColor}-100 border border-dashed border-${previewColor}-400 relative overflow-hidden`}
                      style={{ width: "45%" }}
                    >
                      <span
                        className={`absolute inset-0 text-${previewColor}-400`}
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(135deg, currentColor 0, currentColor 2px, transparent 2px, transparent 6px)",
                          opacity: 0.45,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                z.B. „Kern 10 Arbeitstage + Puffer 5" → 5 Tage Luft für
                Unvorhergesehenes. Cascade-Move nutzt weiterhin das Ende der
                Kern-Arbeit.
              </p>
            </div>
          )}

          {/* Fortschritt */}
          {!form.isMilestone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fortschritt: <span className="font-semibold">{form.progress}%</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progress}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, progress: Number(e.target.value) }))
                  }
                  className="flex-1 accent-emerald-600"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value)));
                    setForm((f) => ({ ...f, progress: isNaN(v) ? 0 : v }));
                  }}
                  className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Status + Gewerk */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as FormState["status"],
                  }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                <option value="OPEN">Offen</option>
                <option value="IN_PROGRESS">In Arbeit</option>
                <option value="DONE">Erledigt</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gewerk
              </label>
              <select
                value={form.tradeCategoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tradeCategoryId: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                <option value="">— Kein Gewerk —</option>
                {tradeCategories.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Farb-Override — kuratierte Palette (12 Farben + „Kein Override"). */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-gray-400" />
              Farb-Override
              <span className="text-xs font-normal text-gray-400">
                (optional; überschreibt die Gewerk-Farbe)
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: "" }))}
                className={`w-7 h-7 rounded-full border-2 bg-white flex items-center justify-center text-[11px] text-gray-500 transition-all shrink-0 ${
                  form.color === ""
                    ? "ring-2 ring-offset-1 ring-gray-900 border-gray-400"
                    : "border-gray-200 hover:border-gray-400"
                }`}
                title="Keine Override (Gewerk-Farbe verwenden)"
              >
                ×
              </button>
              {PALETTE_COLORS.map((c) => {
                const selected = form.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full bg-${c}-500 transition-all shrink-0 ${
                      selected
                        ? "ring-2 ring-offset-1 ring-gray-900 scale-110"
                        : "hover:scale-105"
                    }`}
                    title={c}
                  />
                );
              })}
            </div>
          </div>

          {/* Zuweisung */}
          {members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zugewiesen an
              </label>
              <select
                value={form.assignedToId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assignedToId: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                <option value="">— Niemand —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">
              Ctrl/⌘+S speichert · Esc schließt
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEdit ? "Speichern" : "Anlegen"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
