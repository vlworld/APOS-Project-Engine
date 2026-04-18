"use client";

// TerminplanTabs — Tab-Wrapper für das Terminplan-Modul.
// Schaltet zwischen Gantt-Ansicht und Kalender-Ansicht um.
// Persistiert die Wahl in localStorage ("apos.terminplan.view", Default "gantt").
// Ergänzt um Fullscreen-Modus: verdeckt Sidebar + Header beim Klick.

import { useEffect, useState } from "react";
import { Calendar, GanttChart as GanttIcon, Maximize2, Minimize2 } from "lucide-react";
import CalendarView from "@/components/terminplan/CalendarView";
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
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isView(stored)) setView(stored);
    } catch {
      // ignorieren
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // ignorieren
    }
  }, [view, hydrated]);

  // Escape schließt Fullscreen; body-scroll sperren während aktiv
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  const tabs: { id: TerminplanView; label: string; Icon: typeof Calendar }[] = [
    { id: "gantt", label: "Gantt", Icon: GanttIcon },
    { id: "calendar", label: "Kalender", Icon: Calendar },
  ];

  const content = (
    <>
      {/* Tab-Bar + Fullscreen-Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Terminplan-Ansichten"
          className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1"
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

        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? "Vollbild verlassen (Esc)" : "Vollbild"}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {fullscreen ? (
            <>
              <Minimize2 className="w-4 h-4" />
              Verlassen
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              Vollbild
            </>
          )}
        </button>
      </div>

      {/* Aktive View */}
      <div>
        {view === "gantt" ? (
          <GanttChart projectId={projectId} canEdit={canEdit} />
        ) : (
          <CalendarView projectId={projectId} canEdit={canEdit} />
        )}
      </div>
    </>
  );

  if (fullscreen) {
    // Fullscreen-Modus: Sidebar + Header weiterhin sichtbar (fixed),
    // aber wir legen uns darüber. Wenn du auch Sidebar/Header verstecken
    // willst, setze inset-0 statt top-14 left-14.
    return (
      <div className="fixed inset-0 z-[60] bg-gray-50 flex flex-col gap-3 p-4 overflow-auto">
        {content}
      </div>
    );
  }

  return <div className="flex flex-col gap-4">{content}</div>;
}
