"use client";

/**
 * Feiertage-Verwaltung (Einstellungen).
 *
 * UX-Konformität (siehe UX_DESIGN_REGELN.md / CONVENTIONS.md):
 *  - Custom DatePicker statt <input type="date">
 *  - ConfirmDialog statt window.confirm / alert
 *  - Toast statt alert für Feedback
 *  - Escape schließt Modals, Ctrl/Cmd+S speichert
 *  - Light-first Tailwind, keine manuellen dark: Klassen
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface Holiday {
  id: string;
  organizationId: string;
  date: string; // ISO
  name: string;
  isSample: boolean;
  createdAt: string;
}

interface FormData {
  date: string; // "YYYY-MM-DD"
  name: string;
}

const EMPTY_FORM: FormData = { date: "", name: "" };

const WEEKDAY_LONG_DE = [
  "So",
  "Mo",
  "Di",
  "Mi",
  "Do",
  "Fr",
  "Sa",
];

/** Lokales Parsen einer ISO-Zeitangabe auf "YYYY-MM-DD" lokaler Zeit. */
function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Mo, 01.01.2025" — deutsches Anzeigeformat. */
function formatDateDe(iso: string): string {
  const d = new Date(iso);
  const weekday = WEEKDAY_LONG_DE[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${weekday}, ${day}.${month}.${year}`;
}

/** Gruppiert Feiertage nach Jahr (als Strings, absteigend neueste zuerst). */
function groupByYear(holidays: Holiday[]): Array<{ year: number; items: Holiday[] }> {
  const map = new Map<number, Holiday[]>();
  for (const h of holidays) {
    const y = new Date(h.date).getFullYear();
    const bucket = map.get(y);
    if (bucket) bucket.push(h);
    else map.set(y, [h]);
  }
  const years = Array.from(map.keys()).sort((a, b) => a - b);
  return years.map((year) => ({
    year,
    items: (map.get(year) ?? []).slice().sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  }));
}

export default function FeiertagePage() {
  const { toast } = useToast();

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch("/api/feiertage");
      if (res.ok) {
        setHolidays(await res.json());
      } else {
        toast({
          variant: "error",
          title: "Laden fehlgeschlagen",
          description: "Feiertage konnten nicht geladen werden.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const grouped = useMemo(() => groupByYear(holidays), [holidays]);

  // ---------- Modal steuern ------------------------------------------------

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }, []);

  function openCreateModal() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  }

  function openEditModal(h: Holiday) {
    setEditingId(h.id);
    setFormData({ date: toDateKey(h.date), name: h.name });
    setShowModal(true);
  }

  // ---------- Submit -------------------------------------------------------

  const submit = useCallback(async () => {
    if (saving) return;
    const trimmedName = formData.name.trim();
    if (!formData.date || !trimmedName) {
      toast({
        variant: "error",
        title: "Pflichtfelder fehlen",
        description: "Bitte Datum und Name angeben.",
      });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/feiertage/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: formData.date, name: trimmedName }),
        });
        if (res.ok) {
          toast({ variant: "success", title: "Feiertag aktualisiert" });
          closeModal();
          fetchHolidays();
        } else {
          const err = await res.json().catch(() => ({}));
          toast({
            variant: "error",
            title: "Speichern fehlgeschlagen",
            description: err?.error ?? "Bitte erneut versuchen.",
          });
        }
      } else {
        const res = await fetch("/api/feiertage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: formData.date, name: trimmedName }),
        });
        if (res.ok) {
          toast({ variant: "success", title: "Feiertag angelegt" });
          closeModal();
          fetchHolidays();
        } else {
          const err = await res.json().catch(() => ({}));
          toast({
            variant: "error",
            title: "Anlegen fehlgeschlagen",
            description: err?.error ?? "Bitte erneut versuchen.",
          });
        }
      }
    } finally {
      setSaving(false);
    }
  }, [closeModal, editingId, fetchHolidays, formData.date, formData.name, saving, toast]);

  // ---------- Tastatur-Shortcuts (Escape, Ctrl/Cmd+S) ---------------------

  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!saving) closeModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void submit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal, saving, closeModal, submit]);

  // ---------- Delete -------------------------------------------------------

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/feiertage/${confirmDelete}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ variant: "success", title: "Feiertag gelöscht" });
        setConfirmDelete(null);
        fetchHolidays();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Löschen fehlgeschlagen",
          description: err?.error ?? "Bitte erneut versuchen.",
        });
      }
    } finally {
      setDeleting(false);
    }
  }

  // ---------- Render -------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Feiertage</h1>
            <p className="text-sm text-gray-500">
              {holidays.length} {holidays.length === 1 ? "Feiertag" : "Feiertage"}
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Feiertag anlegen
        </button>
      </div>

      {/* Empty-State */}
      {holidays.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-4 opacity-30" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Noch keine Feiertage angelegt
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Lege Feiertage an, damit der Bauzeitenplan sie automatisch berücksichtigt.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Ersten Feiertag anlegen
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ year, items }) => (
            <div key={year}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2 px-1">
                {year}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_auto] px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                  <div>Datum</div>
                  <div>Name</div>
                  <div className="pl-4">Aktionen</div>
                </div>
                {items.map((h) => (
                  <div
                    key={h.id}
                    className="grid grid-cols-[1fr_2fr_auto] items-center px-4 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-sm text-gray-700">
                      {formatDateDe(h.date)}
                    </div>
                    <div className="text-sm text-gray-900 font-medium">
                      {h.name}
                    </div>
                    <div className="flex items-center gap-1 pl-4">
                      <button
                        onClick={() => openEditModal(h)}
                        title="Bearbeiten"
                        className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(h.id)}
                        title="Löschen"
                        className="w-8 h-8 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit-Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!saving) closeModal();
          }}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Feiertag bearbeiten" : "Feiertag anlegen"}
              </h2>
              <button
                onClick={closeModal}
                disabled={saving}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum *
                </label>
                <DatePicker
                  value={formData.date}
                  onChange={(v) =>
                    setFormData((f) => ({ ...f, date: v }))
                  }
                  placeholder="Datum wählen..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="z.B. Neujahr, Tag der Arbeit ..."
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Speichern" : "Anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm-Delete */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Feiertag löschen?"
        description="Der Feiertag wird aus der Organisation entfernt. Der Bauzeitenplan berücksichtigt ihn ab sofort nicht mehr."
        confirmLabel="Löschen"
        destructive
        loading={deleting}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
