"use client";

// TodoFromItemModal — erzeugt aus einem MeetingItem ein ToDo.
// Der Server kopiert die Felder; hier kann der User einzelne Felder
// ueberschreiben (Titel, Beschreibung, Assignee, Due-Date).
// POST /api/projekte/[projectId]/todos/from-meeting-item
// { meetingItemId, additionalFields: {...} }

import { useEffect, useRef, useState } from "react";
import { X, Loader2, ClipboardList } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import type { MeetingItemDTO, MeetingDetailDTO } from "@/lib/meetings/types";

interface UserOption {
  id: string;
  name: string;
}

interface TodoFromItemModalProps {
  open: boolean;
  projectId: string;
  meeting: MeetingDetailDTO;
  item: MeetingItemDTO | null;
  users: UserOption[];
  onClose: () => void;
  onCreated?: () => void;
}

function toYMD(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function deriveTitle(item: MeetingItemDTO): string {
  if (item.title && item.title.trim().length > 0) return item.title;
  const desc = item.description ?? "";
  return desc.slice(0, 100);
}

export default function TodoFromItemModal({
  open,
  projectId,
  meeting,
  item,
  users,
  onClose,
  onCreated,
}: TodoFromItemModalProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setTitle(deriveTitle(item));
    setDescription(item.description ?? "");
    setAssignedToId(item.responsibleUserId ?? "");
    setDueDate(toYMD(item.dueDate));
  }, [open, item]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!saving) onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    if (!title.trim()) {
      toast({ title: "Titel fehlt", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/projekte/${projectId}/todos/from-meeting-item`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingItemId: item.id,
            additionalFields: {
              title: title.trim(),
              description: description.trim() || null,
              assignedToId: assignedToId || null,
              dueDate: dueDate || null,
            },
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast({
          title: body.error ?? "Anlegen fehlgeschlagen",
          variant: "error",
        });
        return;
      }
      toast({ title: "ToDo angelegt", variant: "success" });
      onCreated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // meeting wird im Modal-Untertitel verwendet
  void meeting;

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                Als ToDo uebernehmen
              </h2>
              <p className="text-xs text-gray-500 truncate">
                Aus Protokollpunkt #{item.orderIndex + 1}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Optionaler Kontext oder Hintergrund"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zugewiesen
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">— niemand —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faelligkeit
              </label>
              <DatePicker value={dueDate} onChange={(v) => setDueDate(v)} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              ToDo anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
