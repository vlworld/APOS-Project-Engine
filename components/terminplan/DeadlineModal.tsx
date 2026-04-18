"use client";

// DeadlineModal — spezialisiertes Modal für schnelle Deadline-Eingabe.
// Ein-Tages-Event (start == end), standardmäßig isMilestone = true.
//
// Shortcuts: Escape schließt, Ctrl/Cmd+S speichert.
// Klick außerhalb schließt. Nutzt Custom-DatePicker (kein <input type="date">).

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import type {
  CreateScheduleItemInput,
  ScheduleItemDTO,
  TradeCategoryDTO,
} from "@/lib/terminplan/types";

interface DeadlineModalProps {
  open: boolean;
  projectId: string;
  initialDate: Date;
  tradeCategories: TradeCategoryDTO[];
  onClose: () => void;
  onSaved: (item: ScheduleItemDTO) => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function DeadlineModal({
  open,
  projectId,
  initialDate,
  tradeCategories,
  onClose,
  onSaved,
}: DeadlineModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dateIso, setDateIso] = useState<string>(toIsoDate(initialDate));
  const [tradeCategoryId, setTradeCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Beim Öffnen: Felder neu initialisieren.
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setDateIso(toIsoDate(initialDate));
      setTradeCategoryId("");
      setError(null);
      // Fokus aufs Name-Feld
      setTimeout(() => nameInputRef.current?.focus(), 30);
    }
  }, [open, initialDate]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Name ist erforderlich.");
      nameInputRef.current?.focus();
      return;
    }
    if (!dateIso) {
      setError("Datum ist erforderlich.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateScheduleItemInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      startDate: dateIso,
      endDate: dateIso,
      isMilestone: true,
      tradeCategoryId: tradeCategoryId || null,
    };

    try {
      const res = await fetch(`/api/projekte/${projectId}/terminplan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Fehler ${res.status}`);
      }
      const item = (await res.json()) as ScheduleItemDTO;
      toast({
        title: "Deadline angelegt",
        description: name.trim(),
        variant: "success",
      });
      onSaved(item);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(message);
      toast({
        title: "Speichern fehlgeschlagen",
        description: message,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [name, description, dateIso, tradeCategoryId, projectId, toast, onSaved, onClose]);

  // Keyboard-Shortcuts: Escape schließt, Ctrl/Cmd+S speichert.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) {
          void handleSave();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, handleSave, saving]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Neue Deadline
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Abgabe Bauantrag"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Datum */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Datum <span className="text-red-500">*</span>
            </label>
            <DatePicker value={dateIso} onChange={setDateIso} />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Notiz"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Gewerk */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gewerk
            </label>
            <select
              value={tradeCategoryId}
              onChange={(e) => setTradeCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-all"
            >
              <option value="">— Kein Gewerk —</option>
              {tradeCategories.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <span className="text-xs text-gray-400">
            Esc zum Schließen &middot; Ctrl/Cmd+S zum Speichern
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
