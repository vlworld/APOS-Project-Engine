"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Plus, X, FolderKanban } from "lucide-react";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";

type Risk = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  probability: string | null;
  impact: string | null;
  status: string;
  mitigationPlan: string | null;
  escalatedTo: { id: string; name: string } | null;
  escalatedAt: string | null;
  workPackage: { id: string; title: string; wbsCode: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  MITIGATED: "bg-blue-100 text-blue-700",
  ESCALATED: "bg-red-100 text-red-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen",
  MITIGATED: "Mitigiert",
  ESCALATED: "Eskaliert",
  CLOSED: "Geschlossen",
};

const LEVEL_OPTIONS = ["LOW", "MEDIUM", "HIGH"];
const LEVEL_LABELS: Record<string, string> = { LOW: "Niedrig", MEDIUM: "Mittel", HIGH: "Hoch" };

export default function RisikenTopPage() {
  const { selectedId: selectedProjectId, setSelectedId: setSelectedProjectId, projects } = useSelectedProject();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingType, setCreatingType] = useState<"RISK" | "ISSUE" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", type: "RISK", description: "", probability: "MEDIUM", impact: "MEDIUM", mitigationPlan: "",
  });

  async function load() {
    if (!selectedProjectId) { setRisks([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/risiken`);
    if (res.ok) setRisks(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [selectedProjectId]);

  function startCreate(type: "RISK" | "ISSUE") {
    setCreatingType(type);
    setForm({ title: "", type, description: "", probability: "MEDIUM", impact: "MEDIUM", mitigationPlan: "" });
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/risiken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { await load(); setCreatingType(null); }
    setSaving(false);
  }

  const riskItems = risks.filter((r) => r.type === "RISK");
  const issueItems = risks.filter((r) => r.type === "ISSUE");

  const matrixData: Record<string, Record<string, number>> = {};
  for (const p of LEVEL_OPTIONS) {
    matrixData[p] = {};
    for (const i of LEVEL_OPTIONS) {
      matrixData[p][i] = riskItems.filter((r) => r.probability === p && r.impact === i && r.status !== "CLOSED").length;
    }
  }

  const matrixColors: Record<string, Record<string, string>> = {
    HIGH: { HIGH: "bg-red-200", MEDIUM: "bg-red-100", LOW: "bg-amber-100" },
    MEDIUM: { HIGH: "bg-red-100", MEDIUM: "bg-amber-100", LOW: "bg-yellow-50" },
    LOW: { HIGH: "bg-amber-100", MEDIUM: "bg-yellow-50", LOW: "bg-green-50" },
  };

  const thClass = "text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide";

  function RiskTable({ items, label }: { items: Risk[]; label: string }) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className={thClass}>Titel</th>
              <th className={thClass}>Wahrscheinlichkeit</th>
              <th className={thClass}>Auswirkung</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Maßnahme</th>
              <th className={thClass}>Eskaliert an</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400 italic">Keine {label} vorhanden.</td></tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="text-sm font-medium text-gray-900">{r.title}</div>
                  {r.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</div>}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{LEVEL_LABELS[r.probability || ""] || r.probability || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{LEVEL_LABELS[r.impact || ""] || r.impact || "—"}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[r.status] || r.status}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate">{r.mitigationPlan || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{r.escalatedTo?.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Risiken & Issues</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <div className="flex items-center gap-2">
              <button onClick={() => startCreate("RISK")} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" /> Neues Risiko
              </button>
              <button onClick={() => startCreate("ISSUE")} className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
                <Plus className="w-4 h-4" /> Neues Issue
              </button>
            </div>
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
          {creatingType && (
            <div className="bg-white border border-blue-200 rounded-2xl px-4 py-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase">{creatingType === "RISK" ? "Neues Risiko" : "Neues Issue"}</p>
              <div className="grid grid-cols-2 gap-3">
                <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel *" className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Beschreibung" rows={2} className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                <select value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {LEVEL_OPTIONS.map((l) => (<option key={l} value={l}>{LEVEL_LABELS[l]}</option>))}
                </select>
                <select value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {LEVEL_OPTIONS.map((l) => (<option key={l} value={l}>{LEVEL_LABELS[l]}</option>))}
                </select>
                <textarea value={form.mitigationPlan} onChange={(e) => setForm({ ...form, mitigationPlan: e.target.value })} placeholder="Maßnahmenplan" rows={2} className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCreate} disabled={saving || !form.title.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {saving ? "..." : "Erstellen"}
                </button>
                <button onClick={() => setCreatingType(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
          ) : risks.length === 0 && !creatingType ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Risiken oder Issues</h2>
              <p className="text-sm text-gray-500 mb-4">Erfassen und verfolgen Sie Projektrisiken.</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => startCreate("RISK")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Neues Risiko</button>
                <button onClick={() => startCreate("ISSUE")} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">Neues Issue</button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Risk Matrix */}
              {riskItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Risikomatrix</h3>
                  <div className="inline-block bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-end gap-1">
                      <div className="flex flex-col items-center mr-2">
                        <span className="text-[10px] text-gray-400 -rotate-90 whitespace-nowrap mb-8">Wahrscheinlichkeit</span>
                      </div>
                      <div>
                        {[...LEVEL_OPTIONS].reverse().map((prob) => (
                          <div key={prob} className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-gray-500 w-12 text-right mr-1">{LEVEL_LABELS[prob]}</span>
                            {LEVEL_OPTIONS.map((imp) => (
                              <div key={imp} className={`w-14 h-14 rounded-lg flex items-center justify-center text-sm font-bold ${matrixColors[prob][imp]} ${matrixData[prob][imp] > 0 ? "text-gray-800" : "text-gray-300"}`}>
                                {matrixData[prob][imp] > 0 ? matrixData[prob][imp] : ""}
                              </div>
                            ))}
                          </div>
                        ))}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="w-12 mr-1" />
                          {LEVEL_OPTIONS.map((imp) => (<span key={imp} className="w-14 text-center text-[10px] text-gray-500">{LEVEL_LABELS[imp]}</span>))}
                        </div>
                        <div className="text-center mt-1"><span className="text-[10px] text-gray-400">Auswirkung</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Risiken ({riskItems.length})</h3>
                <RiskTable items={riskItems} label="Risiken" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Issues ({issueItems.length})</h3>
                <RiskTable items={issueItems} label="Issues" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
