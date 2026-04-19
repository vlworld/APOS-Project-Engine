"use client";

import { Sun, Moon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";
import type { ThemeMode } from "@/lib/theme";

type BinaryMode = Exclude<ThemeMode, "system">;

const OPTIONS: { key: BinaryMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "light", label: "Hell", icon: Sun },
  { key: "dark", label: "Dunkel", icon: Moon },
];

function getPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [saving, setSaving] = useState<BinaryMode | null>(null);
  const [systemDark, setSystemDark] = useState<boolean>(() => getPrefersDark());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handler() {
      setSystemDark(mq.matches);
    }
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Toggle-Verhalten: jeder Klick — egal welcher Button — wechselt zwischen
  // Hell und Dunkel. Das ist nutzerfreundlicher als "Klick auf aktiven
  // Button macht nichts".
  async function handle() {
    const effectiveNow: BinaryMode = isSystem
      ? systemDark
        ? "dark"
        : "light"
      : mode;
    const next: BinaryMode = effectiveNow === "dark" ? "light" : "dark";
    setSaving(next);
    try {
      await setMode(next);
    } finally {
      setSaving(null);
    }
  }

  const isSystem = mode === "system";
  const effective: BinaryMode = isSystem ? (systemDark ? "dark" : "light") : mode;

  return (
    <div
      className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-1 gap-0.5"
      title={isSystem ? "System-Modus aktiv (folgt OS-Einstellung)" : undefined}
    >
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = effective === key;
        const isSaving = saving === key;
        const showSystemDot = isSystem && active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handle()}
            disabled={!!saving}
            title={showSystemDot ? `${label} (System)` : label}
            aria-label={label}
            aria-pressed={active}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              active
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            } disabled:opacity-60`}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {showSystemDot && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-gray-50 dark:ring-gray-900"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
