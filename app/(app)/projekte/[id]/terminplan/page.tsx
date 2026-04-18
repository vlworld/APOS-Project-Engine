"use client";

// Bauzeitenplan-Seite eines Projekts.
// Delegiert das komplette Rendering an <GanttChart>.

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import GanttChart from "@/components/terminplan/GanttChart";

export default function TerminplanPage() {
  const { id } = useParams<{ id: string }>();

  // v1: canEdit = true — das Backend wirft 403 wenn nicht berechtigt,
  // der Toast aus <GanttChart>/<ScheduleItemModal> fängt das ab.
  const canEdit = true;

  return (
    <div className="max-w-full">
      {/* Back link */}
      <Link
        href={`/projekte/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zum Projekt
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <CalendarRange className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Bauzeitenplan</h1>
            <p className="text-sm text-gray-500">
              Arbeitspakete, Meilensteine und Abhängigkeiten für dieses Projekt.
            </p>
          </div>
        </div>
      </div>

      <GanttChart projectId={id} canEdit={canEdit} />
    </div>
  );
}
