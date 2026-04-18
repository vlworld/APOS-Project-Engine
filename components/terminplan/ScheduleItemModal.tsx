"use client";

// Create/Edit-Modal für Schedule-Items (Arbeitspakete / Meilensteine).
// - Escape schließt, Ctrl/Cmd+S speichert.
// - Alle Datumsfelder über <DatePicker> (nie native).
// - Optional: Farb-Override über Farb-Picker.

import { useEffect, useState, useRef, useMemo } from "react";
import { X, Loader2, Palette } from "lucide-react";
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

type FormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  tradeCategoryId: string;
  isMilestone: boolean;
  color: string; // "" = keine Override
  assignedToId: string;
};

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
    progress: 0,
    status: "OPEN",
    tradeCategoryId: "",
    isMilestone: false,
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
        progress: item.progress,
        status: item.status,
        tradeCategoryId: item.tradeCategoryId ?? "",
        isMilestone: item.isMilestone,
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

          {/* Milestone-Checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isMilestone}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isMilestone: e.target.checked,
                    // Bei Milestone: end = start
                    endDate: e.target.checked ? f.startDate : f.endDate,
                  }))
                }
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">
                Ist Meilenstein (fester Stichtag ohne Dauer)
              </span>
            </label>
          </div>

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

          {/* Farb-Override */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-gray-400" />
              Farb-Override
              <span className="text-xs font-normal text-gray-400">
                (optional; überschreibt die Gewerk-Farbe)
              </span>
            </label>
            <div className="grid grid-cols-11 gap-1.5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: "" }))}
                className={`w-7 h-7 rounded-full border-2 bg-white flex items-center justify-center text-[10px] text-gray-500 transition-all ${
                  form.color === ""
                    ? "ring-2 ring-offset-1 ring-gray-900 border-gray-400"
                    : "border-gray-200 hover:border-gray-400"
                }`}
                title="Keine Override"
              >
                ×
              </button>
              {TERMINPLAN_COLORS.map((c) => {
                const selected = form.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full bg-${c}-500 transition-all ${
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
