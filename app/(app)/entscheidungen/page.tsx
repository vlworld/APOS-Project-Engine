"use client";

import { useState, useEffect } from "react";
import { Scale, Plus, X, FolderKanban } from "lucide-react";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";

type Decision = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  decidedAt: string;
  impactTime: string | null;
  impactCost: number | null;
  impactRisk: string | null;
  decidedBy: { id: string; name: string } | null;
  workPackage: { id: string; title: string; wbsCode: string } | null;
};

export default function EntscheidungenTopPage() {
  const { selectedId: selectedProjectId, setSelectedId: setSelectedProjectId, projects } = useSelectedProject();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", reason: "", description: "", impactTime: "", impactCost: "", impactRisk: "",
  });

  async function load() {
    if (!selectedProjectId) { setDecisions([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/entscheidungen`);
    if (res.ok) setDecisions(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [selectedProjectId]);

  async function handleCreate() {
    if (!form.title.trim() || !form.reason.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/entscheidungen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        reason: form.reason,
        description: form.description || null,
        impactTime: form.impactTime || null,
        impactCost: form.impactCost ? parseFloat(form.impactCost) : null,
        impactRisk: form.impactRisk || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setDecisions((prev) => [created, ...prev]);
      setForm({ title: "", reason: "", description: "", impactTime: "", impactCost: "", impactRisk: "" });
      setCreating(false);
    }
    setSaving(false);
  }

  function costColor(val: number | null) {
    if (val == null) return "text-gray-400";
    if (val > 0) return "text-red-600";
    if (val < 0) return "text-green-600";
    return "text-gray-600";
  }

  const thClass = "text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Scale className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Entscheidungslog</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Neue Entscheidung
            </button>
          )}
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Bitte wählen Sie ein Projekt</p>
        </div>
      ) : (
        <>
          {/* Create form */}
          {creating && (
            <div className="bg-white border border-blue-200 rounded-2xl px-4 py-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel *" className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Begründung *" rows={2} className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                <input value={form.impactTime} onChange={(e) => setForm({ ...form, impactTime: e.target.value })} placeholder="Auswirkung Zeit (z.B. +2 Wochen)" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.impactCost} onChange={(e) => setForm({ ...form, impactCost: e.target.value })} placeholder="Auswirkung Kosten (EUR)" type="number" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.impactRisk} onChange={(e) => setForm({ ...form, impactRisk: e.target.value })} placeholder="Auswirkung Risiko" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.reason.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {saving ? "..." : "Erstellen"}
                </button>
                <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
          ) : decisions.length === 0 && !creating ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <Scale className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Entscheidungen</h2>
              <p className="text-sm text-gray-500 mb-4">Dokumentieren Sie wichtige Projektentscheidungen.</p>
              <button onClick={() => setCreating(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Neue Entscheidung
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className={thClass}>Datum</th>
                    <th className={thClass}>Titel</th>
                    <th className={thClass}>Entscheider</th>
                    <th className={thClass}>Auswirkung Zeit</th>
                    <th className={thClass}>Auswirkung Kosten</th>
                    <th className={thClass}>Auswirkung Risiko</th>
                    <th className={thClass}>AP-Verknüpfung</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{new Date(d.decidedAt).toLocaleDateString("de-DE")}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-900">{d.title}</div>
                        {d.reason && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{d.reason}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{d.decidedBy?.name || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-amber-600 font-medium">{d.impactTime || "—"}</td>
                      <td className={`px-3 py-2.5 text-xs font-medium ${costColor(d.impactCost)}`}>
                        {d.impactCost != null ? `${d.impactCost > 0 ? "+" : ""}${d.impactCost.toLocaleString("de-DE")} EUR` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-red-600 font-medium">{d.impactRisk || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        {d.workPackage ? <span className="text-blue-600">{d.workPackage.wbsCode} {d.workPackage.title}</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
