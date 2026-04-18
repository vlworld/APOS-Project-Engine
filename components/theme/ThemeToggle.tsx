"use client";

import { Sun, Moon, Monitor, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";
import type { ThemeMode } from "@/lib/theme";

const OPTIONS: { key: ThemeMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "light", label: "Hell", icon: Sun },
  { key: "dark", label: "Dunkel", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
];

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [saving, setSaving] = useState<ThemeMode | null>(null);

  async function handle(next: ThemeMode) {
    if (next === mode) return;
    setSaving(next);
    try { await setMode(next); } finally { setSaving(null); }
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-1 gap-0.5">
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = mode === key;
        const isSaving = saving === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handle(key)}
            disabled={!!saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            } disabled:opacity-60`}
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
