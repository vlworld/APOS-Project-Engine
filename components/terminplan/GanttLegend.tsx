"use client";

// Legende am Fuß des Gantt-Charts.

export default function GanttLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
          Offen
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
          In Arbeit
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
          Erledigt
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-2.5 bg-blue-600 rounded-sm" />
        <span>Task (gefüllt = Fortschritt)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 bg-purple-600 rotate-45" />
        <span>Meilenstein</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-1.5 bg-gray-400 rounded-sm" />
        <span>Phase (Summary)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-4 h-2.5 bg-red-100 ring-1 ring-red-400 rounded-sm" />
        <span>Verspätet</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-px h-3 bg-red-500" />
        <span>Heute</span>
      </div>
    </div>
  );
}
