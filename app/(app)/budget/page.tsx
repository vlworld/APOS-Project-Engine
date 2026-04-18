"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, X, TrendingUp, TrendingDown, Wallet, BarChart3, Receipt, FolderKanban,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  projectNumber: string;
}

interface BudgetItem {
  id: string;
  category: string;
  description: string | null;
  plannedAmount: number;
  actualAmount: number;
  forecastAmount: number;
  invoiceRef: string | null;
  workPackageId: string | null;
  decisionId: string | null;
  createdAt: string;
}

interface BudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalForecast: number;
  variance: number;
}

function fmtCurrency(val: number) {
  return val.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtPercent(val: number) {
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)} %`;
}

function varianceColor(pct: number) {
  if (pct <= 0) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  if (pct <= 10) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
  return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
}

function rowVariance(planned: number, actual: number) {
  if (planned === 0) return 0;
  return ((actual - planned) / planned) * 100;
}

export default function BudgetTopPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({ totalPlanned: 0, totalActual: 0, totalForecast: 0, variance: 0 });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formCategory, setFormCategory] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPlanned, setFormPlanned] = useState("");
  const [formActual, setFormActual] = useState("");
  const [formForecast, setFormForecast] = useState("");
  const [formInvoice, setFormInvoice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projekte").then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) { setItems([]); setSummary({ totalPlanned: 0, totalActual: 0, totalForecast: 0, variance: 0 }); return; }
    setLoading(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/budget`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setSummary(data.summary);
    }
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormCategory(""); setFormDesc(""); setFormPlanned(""); setFormActual(""); setFormForecast(""); setFormInvoice("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!formCategory.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: formCategory,
        description: formDesc || undefined,
        plannedAmount: formPlanned ? parseFloat(formPlanned) : 0,
        actualAmount: formActual ? parseFloat(formActual) : 0,
        forecastAmount: formForecast ? parseFloat(formForecast) : 0,
        invoiceRef: formInvoice || undefined,
      }),
    });
    if (res.ok) { await fetchData(); resetForm(); }
    setSaving(false);
  };

  const handleDelete = async (budgetId: string) => {
    await fetch(`/api/projekte/${selectedProjectId}/budget/${budgetId}`, { method: "DELETE" });
    await fetchData();
  };

  const vc = varianceColor(summary.variance);
  const totalPlanned = items.reduce((s, i) => s + i.plannedAmount, 0);
  const totalActual = items.reduce((s, i) => s + i.actualAmount, 0);
  const totalForecast = items.reduce((s, i) => s + i.forecastAmount, 0);
  const totalVar = totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Budget & Controlling</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Neue Position
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
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Soll (Geplant)</p>
              <p className="text-xl font-bold text-gray-900">{fmtCurrency(summary.totalPlanned)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Ist (Tatsächlich)</p>
              <p className="text-xl font-bold text-gray-900">{fmtCurrency(summary.totalActual)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Forecast</p>
              <p className="text-xl font-bold text-gray-900">{fmtCurrency(summary.totalForecast)}</p>
            </div>
            <div className={`border rounded-2xl p-5 ${vc.bg} ${vc.border}`}>
              <p className={`text-xs font-medium mb-1 ${vc.text}`}>Abweichung</p>
              <div className="flex items-center gap-2">
                {summary.variance <= 0 ? <TrendingDown className={`w-5 h-5 ${vc.text}`} /> : <TrendingUp className={`w-5 h-5 ${vc.text}`} />}
                <p className={`text-xl font-bold ${vc.text}`}>{fmtPercent(summary.variance)}</p>
              </div>
            </div>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Neue Budgetposition</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie *</label>
                  <input value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="z.B. Rohbau, Elektro" />
                </div>
                <div className="md:col-span-2 lg:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
                  <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optionale Beschreibung" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Soll (EUR)</label>
                  <input type="number" step="0.01" value={formPlanned} onChange={(e) => setFormPlanned(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ist (EUR)</label>
                  <input type="number" step="0.01" value={formActual} onChange={(e) => setFormActual(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Forecast (EUR)</label>
                  <input type="number" step="0.01" value={formForecast} onChange={(e) => setFormForecast(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rechnungsreferenz</label>
                  <input value={formInvoice} onChange={(e) => setFormInvoice(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="RE-2024-001" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Abbrechen</button>
                <button onClick={handleCreate} disabled={saving || !formCategory.trim()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Erstellen
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Keine Budgetpositionen</h2>
              <p className="text-sm text-gray-500">Erstellen Sie die erste Budgetposition für dieses Projekt.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Kategorie</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Beschreibung</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Soll</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Ist</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Forecast</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Abweichung</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Rechnung</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const rv = rowVariance(item.plannedAmount, item.actualAmount);
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.category}</td>
                        <td className="px-4 py-3 text-gray-600">{item.description || "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtCurrency(item.plannedAmount)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtCurrency(item.actualAmount)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtCurrency(item.forecastAmount)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${rv <= 0 ? "text-emerald-600" : rv <= 10 ? "text-amber-600" : "text-red-600"}`}>{fmtPercent(rv)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.invoiceRef ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"><Receipt className="w-3 h-3" />{item.invoiceRef}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Löschen"><X className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                    <td className="px-4 py-3 text-gray-900">Gesamt</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right text-gray-900">{fmtCurrency(totalPlanned)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtCurrency(totalActual)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtCurrency(totalForecast)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`${totalVar <= 0 ? "text-emerald-600" : totalVar <= 10 ? "text-amber-600" : "text-red-600"}`}>{fmtPercent(totalVar)}</span>
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
