"use client";

// #fixme #earlystage
// Diese Seite wird später eine echte Portfolio-Sicht (mehrere Projekte gestapelt,
// gemeinsame Zeitachse, Gewerk-Filter über alle Projekte). Aktuell:
//   - Wenn noch kein Projekt vorhanden → Toggle „Musterdaten laden"
//   - Sonst: Dropdown-Auswahl eines Projekts, lädt dann den Gantt für dieses
//   - Globale Projekt-Auswahl (localStorage-persistiert) via useSelectedProject

import { useState } from "react";
import Link from "next/link";
import {
  GanttChart as GanttIcon,
  FolderKanban,
  FlaskConical,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import TerminplanTabs from "@/components/terminplan/TerminplanTabs";
import { useToast } from "@/components/ui/Toast";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";

export default function TerminplanTopPage() {
  const {
    selectedId: selectedProjectId,
    setSelectedId: setSelectedProjectId,
    projects,
    loading: loadingProjects,
    reload: reloadProjects,
  } = useSelectedProject();
  const [loadingSample, setLoadingSample] = useState(false);
  const { toast } = useToast();

  // #fixme #earlystage
  // Quick-Toggle: „Musterdaten laden". Ruft die bestehende /api/muster-Route auf
  // und lädt nach Erfolg die Projekt-Liste neu. Soll langfristig über ein
  // vollständiges Onboarding-Modal ersetzt werden (Muster wählen, eigenes Projekt
  // anlegen, leer starten).
  async function handleLoadSample() {
    setLoadingSample(true);
    try {
      const res = await fetch("/api/muster", { method: "POST" });
      if (res.ok) {
        toast({ title: "Musterdaten geladen", variant: "success" });
        await reloadProjects();
      } else {
        toast({ title: "Musterdaten konnten nicht geladen werden", variant: "error" });
      }
    } finally {
      setLoadingSample(false);
    }
  }

  const hasProjects = projects.length > 0;

  return (
    <div className="max-w-full min-w-0">
      {/* Header — responsive: auf Mobile/Tablet stacken */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <GanttIcon className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Terminplan</h1>
            <p className="text-sm text-gray-500 truncate">
              Globale Ansicht — wähle ein Projekt, um den Bauzeitenplan zu öffnen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasProjects && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex-1 lg:flex-none px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white min-w-[200px] lg:min-w-[280px] max-w-full"
            >
              <option value="">Projekt wählen…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectNumber} — {p.name}
                </option>
              ))}
            </select>
          )}
          <Link
            href="/projekte"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
            title="Zur Projektliste / Neues Projekt anlegen"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Projekt</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      {loadingProjects ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : !hasProjects ? (
        <EmptyStateWithSampleToggle
          onLoadSample={handleLoadSample}
          loading={loadingSample}
        />
      ) : !selectedProjectId ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            Bitte wählen Sie oben ein Projekt aus.
          </p>
        </div>
      ) : (
        <TerminplanTabs projectId={selectedProjectId} canEdit={true} />
      )}
    </div>
  );
}

// #fixme #earlystage
// Empty-State mit Muster-Toggle: wenn noch kein Projekt existiert,
// bieten wir einen Ein-Klick-Start an. Der Toggle ruft /api/muster auf.
function EmptyStateWithSampleToggle({
  onLoadSample,
  loading,
}: {
  onLoadSample: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-12">
      <div className="max-w-xl mx-auto text-center">
        <div className="w-14 h-14 bg-fuchsia-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-fuchsia-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Noch keine Projekte
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Starte mit einem Klick: Lade das Muster-PV-Projekt „Solarpark Wiesau"
          mit 37 Arbeitspaketen, 12 Gewerken und NRW-Feiertagen 2025–2027.
        </p>

        {/* Toggle */}
        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-4 flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-fuchsia-600 shrink-0" />
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-900">
                Musterdaten laden
              </div>
              <div className="text-xs text-gray-600">
                Wird als <code className="bg-fuchsia-100 px-1 rounded text-[10px]">isSample=true</code>{" "}
                markiert und kann unter Einstellungen › Musterdaten wieder entfernt werden.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLoadSample}
            disabled={loading}
            className="relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors bg-gray-300 disabled:opacity-50"
            aria-label="Musterdaten aktivieren"
          >
            {loading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              </span>
            ) : (
              <span className="inline-block h-6 w-6 rounded-full bg-white shadow translate-x-0" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 justify-center text-xs text-gray-500">
          <span>oder</span>
          <Link
            href="/projekte"
            className="text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
          >
            eigenes Projekt anlegen
          </Link>
        </div>
      </div>
    </div>
  );
}
