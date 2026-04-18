"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  X,
  Calendar,
  User,
  Hash,
  Building2,
  Loader2,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  manager: { id: string; name: string | null; email: string };
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PLANNING: { label: "Planung", bg: "bg-blue-100", text: "text-blue-700" },
  ACTIVE: { label: "Aktiv", bg: "bg-emerald-100", text: "text-emerald-700" },
  ON_HOLD: { label: "Pausiert", bg: "bg-amber-100", text: "text-amber-700" },
  COMPLETED: { label: "Abgeschlossen", bg: "bg-gray-100", text: "text-gray-600" },
  ARCHIVED: { label: "Archiviert", bg: "bg-gray-100", text: "text-gray-500" },
};

function formatDate(d: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ProjektePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    projectNumber: "",
    managerId: "",
    clientName: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projekte");
      if (res.ok) {
        setProjects(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.projectNumber.trim() || !formData.managerId) return;

    setSaving(true);
    try {
      const res = await fetch("/api/projekte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ name: "", projectNumber: "", managerId: "", clientName: "", startDate: "", endDate: "", description: "" });
        fetchProjects();
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

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Projekte</h1>
            <p className="text-sm text-gray-500">
              {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neues Projekt
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Neues Projekt anlegen</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projektname *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="z.B. Neubau Bürogebäude Musterstadt"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektnummer *</label>
                  <input
                    type="text"
                    value={formData.projectNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, projectNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="P-2024-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auftraggeber</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData((f) => ({ ...f, clientName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Firma / Person"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projektleiter-ID *</label>
                <input
                  type="text"
                  value={formData.managerId}
                  onChange={(e) => setFormData((f) => ({ ...f, managerId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="User-ID des Projektleiters"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Startdatum</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enddatum</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  rows={3}
                  placeholder="Kurzbeschreibung des Projekts..."
                />
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
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Projekt anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Grid */}
      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Projekte</h2>
          <p className="text-sm text-gray-500 mb-4">
            Erstellen Sie Ihr erstes Bauprojekt, um loszulegen.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Neues Projekt anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.PLANNING;
            return (
              <Link
                key={p.id}
                href={`/projekte/${p.id}`}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                      <Hash className="w-3 h-3" />
                      {p.projectNumber}
                    </div>
                  </div>
                  <span className={`shrink-0 ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>

                {p.clientName && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                    <Building2 className="w-3 h-3" />
                    {p.clientName}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                  <User className="w-3 h-3" />
                  {p.manager?.name || p.manager?.email}
                </div>

                {(p.startDate || p.endDate) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(p.startDate)} — {formatDate(p.endDate)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
