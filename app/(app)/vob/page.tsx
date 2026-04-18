"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Clock, AlertTriangle, FileText, Scale, ShieldCheck, Hammer,
  Loader2, X, Calendar, FolderKanban,
} from "lucide-react";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";

interface VobItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  resolvedAt: string | null;
  amount: number | null;
  reference: string | null;
  workPackageId: string | null;
  _count: { documents: number };
  createdAt: string;
}

const VOB_TABS = [
  { key: "DEADLINE", label: "Fristen", icon: Clock },
  { key: "OBSTRUCTION", label: "Behinderungen", icon: AlertTriangle },
  { key: "SUPPLEMENT", label: "Nachträge", icon: FileText },
  { key: "ACCEPTANCE", label: "Abnahmen", icon: ShieldCheck },
  { key: "DEFECT", label: "Mängel", icon: Hammer },
] as const;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  OPEN: { label: "Offen", bg: "bg-amber-100", text: "text-amber-700" },
  IN_PROGRESS: { label: "In Bearbeitung", bg: "bg-blue-100", text: "text-blue-700" },
  RESOLVED: { label: "Erledigt", bg: "bg-emerald-100", text: "text-emerald-700" },
  REJECTED: { label: "Abgelehnt", bg: "bg-red-100", text: "text-red-700" },
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtCurrency(val: number | null) {
  if (val == null) return "—";
  return val.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

function isDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const diff = new Date(dueDate).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

export default function VobTopPage() {
  const { selectedId: selectedProjectId, setSelectedId: setSelectedProjectId, projects } = useSelectedProject();
  const [items, setItems] = useState<VobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("DEADLINE");
  const [showForm, setShowForm] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formReference, setFormReference] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!selectedProjectId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/projekte/${selectedProjectId}/vob`);
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter((i) => i.type === activeTab);

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormDueDate(""); setFormAmount(""); setFormReference("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/vob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activeTab,
        title: formTitle,
        description: formDesc || undefined,
        dueDate: formDueDate || undefined,
        amount: formAmount ? parseFloat(formAmount) : undefined,
        reference: formReference || undefined,
      }),
    });
    if (res.ok) { await fetchItems(); resetForm(); }
    setSaving(false);
  };

  const handleStatusChange = async (vobId: string, status: string) => {
    await fetch(`/api/projekte/${selectedProjectId}/vob/${vobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(status === "RESOLVED" ? { resolvedAt: new Date().toISOString() } : {}),
      }),
    });
    await fetchItems();
  };

  const handleDelete = async (vobId: string) => {
    await fetch(`/api/projekte/${selectedProjectId}/vob/${vobId}`, { method: "DELETE" });
    await fetchItems();
  };

  const tabMeta = VOB_TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Scale className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">VOB-Management</h1>
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
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" /> Neu
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
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
            {VOB_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = items.filter((i) => i.type === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {count > 0 && (
                    <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Create form */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">{tabMeta.label} — Neuer Eintrag</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
                  <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Titel eingeben" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
                  <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Optionale Beschreibung" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fällig am</label>
                  <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                {activeTab === "SUPPLEMENT" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Betrag (EUR)</label>
                    <input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0,00" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Referenz</label>
                  <input value={formReference} onChange={(e) => setFormReference(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="z.B. VOB/B §6" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Abbrechen</button>
                <button onClick={handleCreate} disabled={saving || !formTitle.trim()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Erstellen
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <tabMeta.icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Keine {tabMeta.label}</h2>
              <p className="text-sm text-gray-500">Es wurden noch keine Einträge für {tabMeta.label} angelegt.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Titel</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Fällig am</th>
                    {activeTab === "SUPPLEMENT" && <th className="text-right px-4 py-3 font-medium text-gray-500">Betrag</th>}
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Referenz</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.OPEN;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{item.title}</span>
                            {item._count.documents > 0 && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                <FileText className="w-3 h-3" />{item._count.documents}
                              </span>
                            )}
                          </div>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${st.bg} ${st.text}`}
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {(isDueSoon(item.dueDate) || isOverdue(item.dueDate)) && item.status !== "RESOLVED" && (
                              <Calendar className={`w-3.5 h-3.5 ${isOverdue(item.dueDate) ? "text-red-500" : "text-amber-500"}`} />
                            )}
                            <span className={
                              item.status !== "RESOLVED" && isOverdue(item.dueDate) ? "text-red-600 font-medium" :
                              item.status !== "RESOLVED" && isDueSoon(item.dueDate) ? "text-amber-600 font-medium" : "text-gray-700"
                            }>{fmt(item.dueDate)}</span>
                          </div>
                        </td>
                        {activeTab === "SUPPLEMENT" && (
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtCurrency(item.amount)}</td>
                        )}
                        <td className="px-4 py-3 text-gray-600">{item.reference || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Löschen">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
