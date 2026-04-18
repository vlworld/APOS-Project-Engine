"use client";

// TerminplanTabs — Tab-Wrapper für das Terminplan-Modul.
// Schaltet zwischen Gantt-Ansicht und Kalender-Ansicht um.
// Persistiert die Wahl in localStorage ("apos.terminplan.view", Default "gantt").
//
// Haupt-Export für app/(app)/projekte/[id]/terminplan/page.tsx.

import { useEffect, useState } from "react";
import { Calendar, GanttChart as GanttIcon } from "lucide-react";
import CalendarView from "@/components/terminplan/CalendarView";
// GanttChart wird vom parallelen Agent bereitgestellt. Solange die Datei
// fehlt, meldet TypeScript "module not found" — das ist erwartet.
import GanttChart from "@/components/terminplan/GanttChart";

type TerminplanView = "gantt" | "calendar";

interface TerminplanTabsProps {
  projectId: string;
  canEdit: boolean;
}

const STORAGE_KEY = "apos.terminplan.view";

function isView(v: unknown): v is TerminplanView {
  return v === "gantt" || v === "calendar";
}

export default function TerminplanTabs({
  projectId,
  canEdit,
}: TerminplanTabsProps) {
  const [view, setView] = useState<TerminplanView>("gantt");
  const [hydrated, setHydrated] = useState(false);

  // Beim Mount: gespeicherte Wahl laden.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isView(stored)) setView(stored);
    } catch {
      // localStorage nicht verfügbar — ignorieren
    }
    setHydrated(true);
  }, []);

  // Wahl persistieren (aber erst nach Hydration, um Flash zu vermeiden).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // ignorieren
    }
  }, [view, hydrated]);

  const tabs: { id: TerminplanView; label: string; Icon: typeof Calendar }[] = [
    { id: "gantt", label: "Gantt", Icon: GanttIcon },
    { id: "calendar", label: "Kalender", Icon: Calendar },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Tab-Bar */}
      <div
        role="tablist"
        aria-label="Terminplan-Ansichten"
        className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start"
      >
        {tabs.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Aktive View */}
      <div>
        {view === "gantt" ? (
          <GanttChart projectId={projectId} canEdit={canEdit} />
        ) : (
          <CalendarView projectId={projectId} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}
