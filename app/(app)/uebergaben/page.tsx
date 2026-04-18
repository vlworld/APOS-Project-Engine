"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck, Plus, X, ChevronDown, ChevronRight, FileDown, FolderKanban } from "lucide-react";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";

type Protocol = {
  id: string;
  title: string;
  version: number;
  status: string;
  content: string;
  signedBy: { id: string; name: string } | null;
  signedAt: string | null;
  signOffComment: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  PENDING_SIGNOFF: "bg-amber-100 text-amber-700",
  SIGNED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PENDING_SIGNOFF: "Warten auf Unterschrift",
  SIGNED: "Unterschrieben",
  ARCHIVED: "Archiviert",
};

export default function UebergabenTopPage() {
  const { selectedId: selectedProjectId, setSelectedId: setSelectedProjectId, projects } = useSelectedProject();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmSignOff, setConfirmSignOff] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });

  async function load() {
    if (!selectedProjectId) { setProtocols([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/uebergaben`);
    if (res.ok) setProtocols(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [selectedProjectId]);

  async function handleCreate() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/uebergaben`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      await load();
      setForm({ title: "", content: "" });
      setCreating(false);
    }
    setSaving(false);
  }

  async function handleSignOff(protocolId: string) {
    const res = await fetch(`/api/projekte/${selectedProjectId}/uebergaben/${protocolId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signOff: true }),
    });
    if (res.ok) { await load(); setConfirmSignOff(null); }
  }

  function canSignOff(status: string) {
    return status === "DRAFT" || status === "PENDING_SIGNOFF";
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Übergabeprotokolle</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" /> Neues Protokoll
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
              <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel *" className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Inhalt (JSON) *" rows={6} className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
              <div className="flex items-center gap-2">
                <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.content.trim()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {saving ? "..." : "Erstellen"}
                </button>
                <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
          ) : protocols.length === 0 && !creating ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Übergabeprotokolle</h2>
              <p className="text-sm text-gray-500 mb-4">Erstellen Sie Protokolle für die Projektübergabe.</p>
              <button onClick={() => setCreating(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Neues Protokoll</button>
            </div>
          ) : (
            <div className="space-y-3">
              {protocols.map((p) => {
                const isExpanded = expandedId === p.id;
                return (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                      {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-gray-900 truncate">{p.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[p.status] || p.status}</span>
                          <span className="text-[10px] text-gray-400">v{p.version}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{new Date(p.updatedAt).toLocaleDateString("de-DE")}</span>
                          {p.signedBy && <span>Unterschrieben von: {p.signedBy.name}</span>}
                          {p.signedAt && <span>am {new Date(p.signedAt).toLocaleDateString("de-DE")}</span>}
                        </div>
                      </div>
                      {canSignOff(p.status) && (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmSignOff(p.id); }} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors">Sign-Off</button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 max-h-64 overflow-auto">{p.content}</pre>
                      </div>
                    )}

                    {confirmSignOff === p.id && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-amber-50">
                        <p className="text-sm text-gray-700 mb-3">Möchten Sie dieses Protokoll wirklich unterschreiben? Diese Aktion kann nicht rückgängig gemacht werden.</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleSignOff(p.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg">Ja, unterschreiben</button>
                          <button onClick={() => setConfirmSignOff(null)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Abbrechen</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
