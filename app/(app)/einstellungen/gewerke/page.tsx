"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, X, Loader2, GripVertical } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type TradeCategory = {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  isSample: boolean;
};

const TAILWIND_COLORS = [
  "slate", "gray", "zinc", "stone",
  "red", "orange", "amber", "yellow",
  "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose",
] as const;

function colorClasses(color: string): { bg: string; text: string; border: string; dot: string } {
  return {
    bg: `bg-${color}-100`,
    text: `text-${color}-700`,
    border: `border-${color}-200`,
    dot: `bg-${color}-500`,
  };
}

// Tailwind sieht dynamische Strings nicht — deshalb hier eine Whitelist,
// damit JIT die Klassen trotzdem generiert.
const COLOR_CLASS_PRESETS = TAILWIND_COLORS.map((c) => (
  <span
    key={c}
    className={`hidden bg-${c}-100 text-${c}-700 border-${c}-200 bg-${c}-500`}
  />
));

export default function GewerkePage() {
  const [items, setItems] = useState<TradeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; color: string }>({
    name: "",
    color: "blue",
  });
  const [confirmDelete, setConfirmDelete] = useState<TradeCategory | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/gewerke");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditingId(null);
    setFormData({ name: "", color: "blue" });
    setShowForm(true);
  }

  function openEdit(item: TradeCategory) {
    setEditingId(item.id);
    setFormData({ name: item.name, color: item.color });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `/api/gewerke/${editingId}` : "/api/gewerke";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: "", color: "blue" });
        await fetchData();
        toast({
          title: isEdit ? "Gewerk aktualisiert" : "Gewerk angelegt",
          variant: "success",
        });
      } else {
        const body = await res.json().catch(() => ({ error: "Fehler" }));
        toast({ title: body.error ?? "Fehler", variant: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: TradeCategory) {
    const res = await fetch(`/api/gewerke/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: `Gewerk „${item.name}" gelöscht`, variant: "success" });
      await fetchData();
    } else {
      toast({ title: "Löschen fehlgeschlagen", variant: "error" });
    }
    setConfirmDelete(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && showForm) setShowForm(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && showForm) {
        e.preventDefault();
        const form = document.getElementById("gewerk-form") as HTMLFormElement | null;
        form?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Hidden color presets (JIT warm-up) */}
      <div className="sr-only">{COLOR_CLASS_PRESETS}</div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gewerke</h1>
            <p className="text-sm text-gray-500">
              {items.length} {items.length === 1 ? "Gewerk" : "Gewerke"}
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Gewerk anlegen
        </button>
      </div>

      {/* List or empty */}
      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Noch keine Gewerke angelegt
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Lege das erste Gewerk an, um Tasks im Bauzeitenplan zu kategorisieren.
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Erstes Gewerk anlegen
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {items.map((item, idx) => {
            const c = colorClasses(item.color);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  idx > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <div className={`w-4 h-4 rounded-full ${c.dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                  {item.isSample && (
                    <div className="text-xs text-gray-400">Muster</div>
                  )}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full ${c.bg} ${c.text}`}
                >
                  {item.color}
                </span>
                <button
                  onClick={() => openEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDelete(item)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Gewerk bearbeiten" : "Neues Gewerk"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="gewerk-form" onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="z.B. DC-Montage"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Farbe
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {TAILWIND_COLORS.map((c) => {
                    const selected = formData.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, color: c }))}
                        className={`w-8 h-8 rounded-full bg-${c}-500 transition-all ${
                          selected
                            ? "ring-2 ring-offset-2 ring-gray-900 scale-110"
                            : "hover:scale-105"
                        }`}
                        title={c}
                      />
                    );
                  })}
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
                  disabled={saving || !formData.name.trim()}
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

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Gewerk löschen?"
        description={
          confirmDelete
            ? `Gewerk „${confirmDelete.name}" wird gelöscht. Zugeordnete Tasks verlieren ihre Kategorie.`
            : undefined
        }
        confirmLabel="Löschen"
        destructive
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
