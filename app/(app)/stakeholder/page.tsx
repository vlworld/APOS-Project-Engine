"use client";

import { useState, useEffect } from "react";
import { Users, Plus, X, Mail, Phone, Building2, MessageSquare, FolderKanban } from "lucide-react";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";

type Stakeholder = {
  id: string;
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  _count: { communicationLogs: number };
};

export default function StakeholderTopPage() {
  const { selectedId: selectedProjectId, setSelectedId: setSelectedProjectId, projects } = useSelectedProject();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", company: "", email: "", phone: "" });

  async function load() {
    if (!selectedProjectId) { setStakeholders([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/stakeholder`);
    if (res.ok) setStakeholders(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [selectedProjectId]);

  async function handleCreate() {
    if (!form.name.trim() || !form.role.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/stakeholder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      await load();
      setForm({ name: "", role: "", company: "", email: "", phone: "" });
      setCreating(false);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Stakeholder</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Neuer Stakeholder
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
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name *" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Rolle *" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Firma" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-Mail" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefon" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCreate} disabled={saving || !form.name.trim() || !form.role.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {saving ? "..." : "Erstellen"}
                </button>
                <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
          ) : stakeholders.length === 0 && !creating ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Stakeholder</h2>
              <p className="text-sm text-gray-500 mb-4">Erfassen Sie die wichtigsten Projektbeteiligten.</p>
              <button onClick={() => setCreating(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Neuer Stakeholder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stakeholders.map((s) => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
                      <p className="text-xs text-gray-500">{s.role}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <MessageSquare size={12} />
                      <span>{s._count.communicationLogs}</span>
                    </div>
                  </div>
                  <div className="space-y-1 mt-3">
                    {s.company && (
                      <div className="flex items-center gap-2 text-xs text-gray-600"><Building2 size={12} className="text-gray-400" /><span>{s.company}</span></div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600"><Mail size={12} className="text-gray-400" /><span>{s.email}</span></div>
                    )}
                    {s.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600"><Phone size={12} className="text-gray-400" /><span>{s.phone}</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
