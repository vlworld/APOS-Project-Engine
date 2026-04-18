"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Scale, Plus, X } from "lucide-react";

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

export default function EntscheidungenPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", reason: "", description: "", impactTime: "", impactCost: "", impactRisk: "",
  });

  async function load() {
    const res = await fetch(`/api/projekte/${projectId}/entscheidungen`);
    if (res.ok) setDecisions(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleCreate() {
    if (!form.title.trim() || !form.reason.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${projectId}/entscheidungen`, {
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Entscheidungslog</h2>
          <p className="text-sm text-gray-500 mt-0.5">{decisions.length} Entscheidungen</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Neue Entscheidung
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-blue-200 rounded-xl px-4 py-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Titel *"
              className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Begründung *"
              rows={2}
              className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <input
              value={form.impactTime}
              onChange={(e) => setForm({ ...form, impactTime: e.target.value })}
              placeholder="Auswirkung Zeit (z.B. +2 Wochen)"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={form.impactCost}
              onChange={(e) => setForm({ ...form, impactCost: e.target.value })}
              placeholder="Auswirkung Kosten (EUR)"
              type="number"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={form.impactRisk}
              onChange={(e) => setForm({ ...form, impactRisk: e.target.value })}
              placeholder="Auswirkung Risiko"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.title.trim() || !form.reason.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? "..." : "Erstellen"}
            </button>
            <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
      ) : decisions.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Scale size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Noch keine Entscheidungen</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-5">Dokumentieren Sie wichtige Projektentscheidungen.</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={15} /> Neue Entscheidung
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
              {decisions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-gray-400 italic">
                    Keine Entscheidungen gefunden.
                  </td>
                </tr>
              )}
              {decisions.map((d) => (
                <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(d.decidedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-medium text-gray-900">{d.title}</div>
                    {d.reason && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{d.reason}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {d.decidedBy?.name || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-amber-600 font-medium">
                    {d.impactTime || "—"}
                  </td>
                  <td className={`px-3 py-2.5 text-xs font-medium ${costColor(d.impactCost)}`}>
                    {d.impactCost != null
                      ? `${d.impactCost > 0 ? "+" : ""}${d.impactCost.toLocaleString("de-DE")} EUR`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-red-600 font-medium">
                    {d.impactRisk || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {d.workPackage
                      ? <span className="text-blue-600">{d.workPackage.wbsCode} {d.workPackage.title}</span>
                      : "—"}
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
