"use client";

import { useState } from "react";
import { Pencil, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface DataRoomEditorProps {
  projectId: string;
  field: "dataRoomUrl" | "customerDataRoomUrl";
  placeholder: string;
}

export default function DataRoomEditor({ projectId, field, placeholder }: DataRoomEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function save() {
    if (!value.trim()) {
      setEditing(false);
      return;
    }
    let url = value.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    setSaving(true);
    try {
      const res = await fetch(`/api/projekte/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: url }),
      });
      if (res.ok) {
        toast({ title: "Datenraum-Link gespeichert", variant: "success" });
        window.location.reload();
      } else {
        toast({ title: "Speichern fehlgeschlagen", variant: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="url"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue("");
              setEditing(false);
            }
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !value.trim()}
          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md disabled:opacity-50"
          title="Speichern"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => { setValue(""); setEditing(false); }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          title="Abbrechen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 italic transition-colors"
    >
      <Pencil className="w-3 h-3" />
      Link hinterlegen
    </button>
  );
}
