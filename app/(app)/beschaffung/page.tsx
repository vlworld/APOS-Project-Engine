"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, X, Package, Truck, Calendar, FolderKanban,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  projectNumber: string;
}

interface ProcurementItem {
  id: string;
  material: string;
  quantity: number | null;
  unit: string | null;
  supplier: string | null;
  status: string;
  orderDate: string | null;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  delayDays: number | null;
  workPackageId: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PLANNED: { label: "Geplant", bg: "bg-gray-100", text: "text-gray-700" },
  ORDERED: { label: "Bestellt", bg: "bg-blue-100", text: "text-blue-700" },
  DELIVERED: { label: "Geliefert", bg: "bg-emerald-100", text: "text-emerald-700" },
  DELAYED: { label: "Verzögert", bg: "bg-red-100", text: "text-red-700" },
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtQty(qty: number | null, unit: string | null) {
  if (qty == null) return "—";
  return `${qty.toLocaleString("de-DE")}${unit ? ` ${unit}` : ""}`;
}

export default function BeschaffungTopPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formMaterial, setFormMaterial] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formSupplier, setFormSupplier] = useState("");
  const [formOrderDate, setFormOrderDate] = useState("");
  const [formExpected, setFormExpected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/projekte").then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  const fetchItems = useCallback(async () => {
    if (!selectedProjectId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/projekte/${selectedProjectId}/beschaffung`);
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setFormMaterial(""); setFormQty(""); setFormUnit(""); setFormSupplier(""); setFormOrderDate(""); setFormExpected("");
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!formMaterial.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/beschaffung`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material: formMaterial,
        quantity: formQty ? parseFloat(formQty) : undefined,
        unit: formUnit || undefined,
        supplier: formSupplier || undefined,
        orderDate: formOrderDate || undefined,
        expectedDelivery: formExpected || undefined,
      }),
    });
    if (res.ok) { await fetchItems(); resetForm(); }
    setSaving(false);
  };

  const handleDelete = async (procId: string) => {
    await fetch(`/api/projekte/${selectedProjectId}/beschaffung/${procId}`, { method: "DELETE" });
    await fetchItems();
  };

  const handleStatusChange = async (procId: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "DELIVERED") patch.actualDelivery = new Date().toISOString();
    await fetch(`/api/projekte/${selectedProjectId}/beschaffung/${procId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await fetchItems();
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Beschaffung</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
              <Plus className="w-4 h-4" /> Neue Bestellung
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
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Neue Bestellung</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Material *</label>
                  <input value={formMaterial} onChange={(e) => setFormMaterial(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="z.B. Bewehrungsstahl" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Menge</label>
                  <input type="number" step="0.01" value={formQty} onChange={(e) => setFormQty(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Einheit</label>
                  <input value={formUnit} onChange={(e) => setFormUnit(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="z.B. t, m3, Stk" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lieferant</label>
                  <input value={formSupplier} onChange={(e) => setFormSupplier(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Firmenname" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bestellt am</label>
                  <input type="date" value={formOrderDate} onChange={(e) => setFormOrderDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Erwartete Lieferung</label>
                  <input type="date" value={formExpected} onChange={(e) => setFormExpected(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Abbrechen</button>
                <button onClick={handleCreate} disabled={saving || !formMaterial.trim()} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
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
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Keine Bestellungen</h2>
              <p className="text-sm text-gray-500">Erstellen Sie die erste Bestellung für dieses Projekt.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Material</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Menge + Einheit</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Lieferant</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Bestellt am</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Erwartet</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Verzug</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PLANNED;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.material}</td>
                        <td className="px-4 py-3 text-gray-700">{fmtQty(item.quantity, item.unit)}</td>
                        <td className="px-4 py-3 text-gray-700">{item.supplier || "—"}</td>
                        <td className="px-4 py-3">
                          <select value={item.status} onChange={(e) => handleStatusChange(item.id, e.target.value)} className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${st.bg} ${st.text}`}>
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (<option key={key} value={key}>{cfg.label}</option>))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{fmt(item.orderDate)}</td>
                        <td className="px-4 py-3 text-gray-700">{fmt(item.expectedDelivery)}</td>
                        <td className="px-4 py-3">
                          {item.delayDays != null && item.delayDays > 0 ? (
                            <span className="text-red-600 font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />+{item.delayDays} Tage</span>
                          ) : item.status === "DELAYED" ? (
                            <span className="text-red-600 font-medium">Verzögert</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Löschen"><X className="w-4 h-4" /></button>
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
