"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarRange,
  Plus,
  X,
  Loader2,
  FolderKanban,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  projectNumber: string;
}

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

const TYPE_LABELS: Record<string, string> = {
  TASK: "Vorgang",
  MILESTONE: "Meilenstein",
  PHASE: "Phase",
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysBetween(a: string, b: string): number {
  return Math.max(Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)), 0);
}

export default function TerminplanTopPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    startDate: "",
    endDate: "",
    type: "TASK",
  });

  useEffect(() => {
    fetch("/api/projekte").then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/projekte/${selectedProjectId}/terminplan`);
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim() || !formData.startDate || !formData.endDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projekte/${selectedProjectId}/terminplan`, {
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <CalendarRange className="w-5 h-5 text-purple-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Terminplan</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>
            ))}
          </select>
          {selectedProjectId && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neuer Eintrag
            </button>
          )}
        </div>
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
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Abbrechen
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      {!selectedProjectId ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Bitte wählen Sie ein Projekt</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <CalendarRange className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Einträge</h2>
          <p className="text-sm text-gray-500 mb-4">Erstellen Sie den ersten Terminplan-Eintrag.</p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
            Neuer Eintrag
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Titel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Typ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Start</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ende</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Dauer</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Fortschritt</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Krit. Pfad</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      item.type === "MILESTONE" ? "bg-purple-100 text-purple-700" :
                      item.type === "PHASE" ? "bg-gray-100 text-gray-600" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(item.startDate)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(item.endDate)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {daysBetween(item.startDate, item.endDate)} Tage
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${item.progressPercent}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{item.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.isCriticalPath && (
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">KP</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
