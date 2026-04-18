"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, X, ExternalLink, FolderKanban } from "lucide-react";

interface Project {
  id: string;
  name: string;
  projectNumber: string;
}

type Document = {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  version: number;
  mimeType: string | null;
  category: string | null;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
};

const CATEGORY_OPTIONS = [
  { value: "", label: "Alle Kategorien" },
  { value: "Plan", label: "Plan" },
  { value: "Vertrag", label: "Vertrag" },
  { value: "Protokoll", label: "Protokoll" },
  { value: "Foto", label: "Foto" },
  { value: "Sonstiges", label: "Sonstiges" },
];

const CATEGORY_STYLES: Record<string, string> = {
  Plan: "bg-blue-100 text-blue-700",
  Vertrag: "bg-purple-100 text-purple-700",
  Protokoll: "bg-green-100 text-green-700",
  Foto: "bg-amber-100 text-amber-700",
  Sonstiges: "bg-gray-100 text-gray-600",
};

export default function DokumenteTopPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [form, setForm] = useState({ title: "", fileName: "", fileUrl: "", category: "", mimeType: "" });

  useEffect(() => {
    fetch("/api/projekte").then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  async function load() {
    if (!selectedProjectId) { setDocuments([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/dokumente`);
    if (res.ok) setDocuments(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [selectedProjectId]);

  async function handleCreate() {
    if (!form.title.trim() || !form.fileName.trim() || !form.fileUrl.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${selectedProjectId}/dokumente`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        fileName: form.fileName,
        fileUrl: form.fileUrl,
        category: form.category || null,
        mimeType: form.mimeType || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setDocuments((prev) => [created, ...prev]);
      setForm({ title: "", fileName: "", fileUrl: "", category: "", mimeType: "" });
      setCreating(false);
    }
    setSaving(false);
  }

  const filtered = filterCategory ? documents.filter((d) => d.category === filterCategory) : documents;
  const thClass = "text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Dokumente</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>))}
          </select>
          {selectedProjectId && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Neues Dokument
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
                <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel *" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="Dateiname *" className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="Datei-URL *" className="col-span-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Kategorie wählen</option>
                  {CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.fileName.trim() || !form.fileUrl.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                  {saving ? "..." : "Erstellen"}
                </button>
                <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {CATEGORY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
            {filterCategory && (
              <button onClick={() => setFilterCategory("")} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X size={12} /> Filter zurücksetzen</button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filtered.length} Dokumente</span>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
          ) : documents.length === 0 && !creating ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Dokumente</h2>
              <p className="text-sm text-gray-500 mb-4">Verknüpfen Sie Projektdokumente per URL.</p>
              <button onClick={() => setCreating(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Neues Dokument</button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className={thClass}>Titel</th>
                    <th className={thClass}>Dateiname</th>
                    <th className={thClass}>Kategorie</th>
                    <th className={thClass}>Version</th>
                    <th className={thClass}>Hochgeladen von</th>
                    <th className={thClass}>Datum</th>
                    <th className={thClass}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-sm text-gray-400 italic">Keine Dokumente gefunden.</td></tr>
                  )}
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{d.title}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{d.fileName}</td>
                      <td className="px-3 py-2.5">
                        {d.category ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[d.category] || "bg-gray-100 text-gray-600"}`}>{d.category}</span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">v{d.version}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{d.uploadedBy?.name || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString("de-DE")}</td>
                      <td className="px-3 py-2.5">
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                          <ExternalLink size={12} /> Öffnen
                        </a>
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
