"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FileText, Mail, Phone, Users, Calendar, Plus, X, MessageSquare } from "lucide-react";

type CommLog = {
  id: string;
  type: string;
  subject: string;
  content: string | null;
  date: string;
  stakeholder: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

const TYPE_OPTIONS = [
  { value: "NOTE", label: "Notiz" },
  { value: "EMAIL", label: "E-Mail" },
  { value: "CALL", label: "Anruf" },
  { value: "MEETING", label: "Meeting" },
  { value: "JOUR_FIXE", label: "Jour Fixe" },
];

const TYPE_ICONS: Record<string, typeof FileText> = {
  NOTE: FileText,
  EMAIL: Mail,
  CALL: Phone,
  MEETING: Users,
  JOUR_FIXE: Calendar,
};

const TYPE_COLORS: Record<string, string> = {
  NOTE: "bg-gray-100 text-gray-600",
  EMAIL: "bg-blue-100 text-blue-600",
  CALL: "bg-green-100 text-green-600",
  MEETING: "bg-purple-100 text-purple-600",
  JOUR_FIXE: "bg-amber-100 text-amber-600",
};

export default function KommunikationPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [form, setForm] = useState({ subject: "", type: "NOTE", content: "", stakeholderId: "" });

  async function load() {
    const res = await fetch(`/api/projekte/${projectId}/kommunikation`);
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function handleCreate() {
    if (!form.subject.trim() || !form.type) return;
    setSaving(true);
    const res = await fetch(`/api/projekte/${projectId}/kommunikation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: form.subject,
        type: form.type,
        content: form.content || null,
        stakeholderId: form.stakeholderId || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setLogs((prev) => [created, ...prev]);
      setForm({ subject: "", type: "NOTE", content: "", stakeholderId: "" });
      setCreating(false);
    }
    setSaving(false);
  }

  const filtered = filterType ? logs.filter((l) => l.type === filterType) : logs;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Kommunikation</h2>
          <p className="text-sm text-gray-500 mt-0.5">{logs.length} Einträge</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Neuer Eintrag
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-blue-200 rounded-xl px-4 py-4 mb-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              autoFocus
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Betreff *"
              className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Inhalt (optional)"
            rows={3}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.subject.trim()}
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

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Alle Typen</option>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {filterType && (
          <button
            onClick={() => setFilterType("")}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X size={12} /> Filter zurücksetzen
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} Einträge</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Lade...</div>
      ) : logs.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Noch keine Kommunikation</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-5">Dokumentieren Sie Gespräche, E-Mails und Meetings.</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={15} /> Neuer Eintrag
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const Icon = TYPE_ICONS[log.type] || FileText;
            const colorClass = TYPE_COLORS[log.type] || "bg-gray-100 text-gray-600";
            return (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{log.subject}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}>
                      {TYPE_OPTIONS.find((o) => o.value === log.type)?.label || log.type}
                    </span>
                  </div>
                  {log.content && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{log.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{new Date(log.date).toLocaleDateString("de-DE")}</span>
                    {log.createdBy && <span>{log.createdBy.name}</span>}
                    {log.stakeholder && (
                      <span className="text-blue-500">{log.stakeholder.name}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
