"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  ChevronRight,
  User,
} from "lucide-react";

interface WorkPackage {
  id: string;
  title: string;
  wbsCode: string;
  status: string;
  progressPercent: number;
  trade: string | null;
  parentId: string | null;
  responsible: { id: string; name: string | null; email: string };
  children: { id: string }[];
}

const WP_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  OPEN: { label: "Offen", bg: "bg-gray-100", text: "text-gray-600" },
  IN_PROGRESS: { label: "In Arbeit", bg: "bg-blue-100", text: "text-blue-700" },
  COMPLETED: { label: "Abgeschlossen", bg: "bg-emerald-100", text: "text-emerald-700" },
  BLOCKED: { label: "Blockiert", bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { label: "Abgebrochen", bg: "bg-gray-100", text: "text-gray-500" },
};

function getDepth(wbsCode: string): number {
  return wbsCode.split(".").length - 1;
}

export default function ArbeitspacketePage() {
  const { id } = useParams<{ id: string }>();
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    title: "",
    wbsCode: "",
    responsibleId: "",
    trade: "",
    parentId: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projekte/${id}/arbeitspakete`);
      if (res.ok) {
        setWorkPackages(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim() || !formData.wbsCode.trim() || !formData.responsibleId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/projekte/${id}/arbeitspakete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          wbsCode: formData.wbsCode,
          responsibleId: formData.responsibleId,
          trade: formData.trade || null,
          parentId: formData.parentId || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ title: "", wbsCode: "", responsibleId: "", trade: "", parentId: "" });
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleCollapse(wpId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(wpId)) next.delete(wpId);
      else next.add(wpId);
      return next;
    });
  }

  // Build visibility: hide children of collapsed parents
  function isVisible(wp: WorkPackage): boolean {
    if (!wp.parentId) return true;
    if (collapsed.has(wp.parentId)) return false;
    const parent = workPackages.find((p) => p.id === wp.parentId);
    if (parent) return isVisible(parent);
    return true;
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
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Arbeitspakete</h1>
            <p className="text-sm text-gray-500">
              {workPackages.length} {workPackages.length === 1 ? "Arbeitspaket" : "Arbeitspakete"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neues Arbeitspaket
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Neues Arbeitspaket</h2>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="z.B. Rohbauarbeiten"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WBS-Code *</label>
                  <input
                    type="text"
                    value={formData.wbsCode}
                    onChange={(e) => setFormData((f) => ({ ...f, wbsCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="1.2.3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gewerk</label>
                  <input
                    type="text"
                    value={formData.trade}
                    onChange={(e) => setFormData((f) => ({ ...f, trade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="z.B. Elektro"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verantwortlicher (User-ID) *</label>
                <input
                  type="text"
                  value={formData.responsibleId}
                  onChange={(e) => setFormData((f) => ({ ...f, responsibleId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="User-ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Übergeordnetes Paket</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData((f) => ({ ...f, parentId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">Kein übergeordnetes Paket</option>
                  {workPackages.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.wbsCode} — {wp.title}
                    </option>
                  ))}
                </select>
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Work Packages List */}
      {workPackages.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Arbeitspakete</h2>
          <p className="text-sm text-gray-500 mb-4">
            Erstellen Sie das erste Arbeitspaket für dieses Projekt.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Neues Arbeitspaket
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px_120px_80px] gap-4 px-5 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div>WBS / Titel</div>
            <div>Verantwortlich</div>
            <div>Status</div>
            <div>Fortschritt</div>
            <div>Gewerk</div>
          </div>

          {/* Rows */}
          {workPackages.filter(isVisible).map((wp) => {
            const depth = getDepth(wp.wbsCode);
            const status = WP_STATUS[wp.status] || WP_STATUS.OPEN;
            const hasChildren = wp.children.length > 0;
            const isCollapsed = collapsed.has(wp.id);

            return (
              <div
                key={wp.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px_120px_80px] gap-4 px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center"
              >
                {/* WBS + Title */}
                <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: `${depth * 20}px` }}>
                  {hasChildren ? (
                    <button
                      onClick={() => toggleCollapse(wp.id)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                    >
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      />
                    </button>
                  ) : (
                    <span className="shrink-0 w-5" />
                  )}
                  <span className="text-xs font-mono text-gray-400 shrink-0">{wp.wbsCode}</span>
                  <span className="text-sm text-gray-900 truncate">{wp.title}</span>
                </div>

                {/* Responsible */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600 truncate">
                  <User className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{wp.responsible?.name || wp.responsible?.email}</span>
                </div>

                {/* Status */}
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full w-fit ${status.bg} ${status.text}`}>
                  {status.label}
                </span>

                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${wp.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{wp.progressPercent}%</span>
                </div>

                {/* Trade */}
                <span className="text-xs text-gray-500 truncate">{wp.trade || "–"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
