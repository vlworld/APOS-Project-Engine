"use client";

// FIX ME: Komplettes KPI-Dashboard ist aktuell nur Skeleton mit Mock-Daten.
// Zu tun, bevor produktiv:
//   1. Aggregations-API bauen: /api/admin/kpi?from=...&to=...
//      → gruppiert nach Projekt/Gewerk/Status, berechnet Durchlaufzeit,
//        Delta zwischen geplantem und tatsächlichem Ende, Änderungs-Häufigkeit
//   2. Change-Tracking aktivieren: Tabelle ScheduleItemAudit (oder eine generische
//      AuditLog-Tabelle) — jeder updateScheduleItem schreibt einen Eintrag
//   3. Charts mit recharts/victory/chart.js rendern (noch nicht installiert)
//   4. Zeitraum-Filter mit DatePicker-Range
//   5. Projekt-Filter (Multi-Select)
//   6. Export als CSV / PDF

import { useState } from "react";
import {
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
  Activity,
  CheckCircle2,
  FolderKanban,
  Briefcase,
  Calendar,
  RefreshCw,
  Download,
  Filter,
} from "lucide-react";

type Timeframe = "7D" | "30D" | "90D" | "1Y" | "ALL";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "7D", label: "7 Tage" },
  { value: "30D", label: "30 Tage" },
  { value: "90D", label: "90 Tage" },
  { value: "1Y", label: "1 Jahr" },
  { value: "ALL", label: "Alles" },
];

// FIX ME: Mock-Daten — durch echte API ersetzen
const MOCK_KPIS = {
  avgLeadTimeDays: 142,
  avgLeadTimeChange: -8, // vs. Vorperiode
  activeProjects: 12,
  delayedProjects: 3,
  completedProjects: 47,
  completedChange: +5,
  avgItemsPerProject: 38,
  avgDelayDays: 6.3,
  itemChangesLast30d: 284,
  changesChange: +15,
  onTimeDeliveryRate: 78, // %
};

const MOCK_TOP_DELAYED = [
  { project: "Solarpark Wiesau", delayDays: 12, tradeCategory: "DC-Montage" },
  { project: "FFA Essen-Nord", delayDays: 8, tradeCategory: "Tiefbau" },
  { project: "Solarpark Münster II", delayDays: 5, tradeCategory: "Vermessung" },
];

const MOCK_TRADE_BREAKDOWN = [
  { trade: "DC-Montage", color: "rose", avgLeadTime: 22, delayed: 4 },
  { trade: "AC-Montage", color: "cyan", avgLeadTime: 18, delayed: 2 },
  { trade: "Projektierung", color: "blue", avgLeadTime: 34, delayed: 5 },
  { trade: "Tiefbau", color: "lime", avgLeadTime: 14, delayed: 3 },
  { trade: "Vermessung", color: "amber", avgLeadTime: 8, delayed: 1 },
  { trade: "Zaunbau", color: "emerald", avgLeadTime: 6, delayed: 0 },
];

const MOCK_RECENT_CHANGES = [
  { date: "2026-04-18 14:32", user: "Oliver vom Lehn", action: "verschoben", target: "UK rammen (+3 Tage)" },
  { date: "2026-04-18 11:15", user: "Czaja", action: "angelegt", target: "Wechselrichter Montage" },
  { date: "2026-04-17 16:48", user: "Oliver vom Lehn", action: "Status geändert", target: "DC-Abnahme → In Arbeit" },
  { date: "2026-04-17 09:12", user: "Czaja", action: "gelöscht", target: "Alte Kabelplanung" },
  { date: "2026-04-16 13:05", user: "Oliver vom Lehn", action: "Dauer geändert", target: "Trafo bestellen (14→26d)" },
];

export default function KpiDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");

  // FIX ME: useEffect + fetch /api/admin/kpi?timeframe=...
  // FIX ME: Loading + Error-States

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">KPI Dashboard</h1>
            <p className="text-sm text-gray-500">
              Durchlaufzeiten, Verzögerungen und Änderungen —
              <span className="ml-1 text-amber-600 font-medium">Mock-Daten (FIX ME)</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Neu laden"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Aktualisieren
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Export (noch nicht implementiert)"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Zeitraum-Filter */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Zeitraum</span>
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {TIMEFRAMES.map((t) => {
            const active = t.value === timeframe;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTimeframe(t.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-gray-400 ml-2">
          {/* FIX ME: eigene DatePicker-Range hier einbauen */}
          oder individueller Zeitraum…
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <Filter className="w-3.5 h-3.5" />
          Projekte / Gewerke filtern
        </button>
      </div>

      {/* Top-Row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard
          icon={Clock}
          color="violet"
          label="Ø Durchlaufzeit"
          value={`${MOCK_KPIS.avgLeadTimeDays}d`}
          delta={MOCK_KPIS.avgLeadTimeChange}
          deltaPositiveIsGood={false}
        />
        <KpiCard
          icon={FolderKanban}
          color="blue"
          label="Aktive Projekte"
          value={MOCK_KPIS.activeProjects}
        />
        <KpiCard
          icon={AlertTriangle}
          color="red"
          label="Verspätete Projekte"
          value={MOCK_KPIS.delayedProjects}
          highlight={MOCK_KPIS.delayedProjects > 0 ? "crit" : undefined}
        />
        <KpiCard
          icon={CheckCircle2}
          color="emerald"
          label="Abgeschlossen"
          value={MOCK_KPIS.completedProjects}
          delta={MOCK_KPIS.completedChange}
        />
        <KpiCard
          icon={Activity}
          color="amber"
          label="Ø Verzögerung"
          value={`${MOCK_KPIS.avgDelayDays}d`}
          highlight="warn"
        />
        <KpiCard
          icon={TrendingUp}
          color="cyan"
          label="On-Time-Rate"
          value={`${MOCK_KPIS.onTimeDeliveryRate} %`}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Durchlaufzeit-Chart (FIX ME: echter Chart) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Durchlaufzeit pro Monat
              </h3>
              <p className="text-xs text-gray-500">
                {/* FIX ME: echten Chart rendern (recharts oder chart.js) */}
                Trend der letzten 12 Monate
              </p>
            </div>
            <span className="text-xs text-gray-400">FIX ME: Chart</span>
          </div>
          <div className="h-48 rounded-lg bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 border border-dashed border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-400 text-sm">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>Chart-Platzhalter</p>
              <p className="text-xs mt-1">recharts / chart.js einbauen</p>
            </div>
          </div>
        </div>

        {/* Änderungen-Ticker */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Letzte Änderungen
              </h3>
              <p className="text-xs text-gray-500">
                {MOCK_KPIS.itemChangesLast30d} in {timeframe}
                <span className="ml-2 text-emerald-600 font-medium">
                  +{MOCK_KPIS.changesChange} %
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {/* FIX ME: echter Audit-Log aus ScheduleItemAudit oder AuditLog-Model */}
            {MOCK_RECENT_CHANGES.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                <Calendar className="w-3 h-3 text-gray-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-700">
                    <span className="font-medium">{c.user}</span>
                    <span className="text-gray-500"> {c.action}: </span>
                    <span className="truncate">{c.target}</span>
                  </div>
                  <div className="text-gray-400 text-[10px]">{c.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third Row: Gewerke + Verspätete Projekte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gewerke-Breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Performance pro Gewerk
            </h3>
          </div>
          <div className="space-y-2">
            {/* FIX ME: aus DB aggregieren (GROUP BY tradeCategoryId) */}
            {MOCK_TRADE_BREAKDOWN.map((t) => (
              <div key={t.trade} className="flex items-center gap-3 py-1.5">
                <span className={`w-2 h-2 rounded-full bg-${t.color}-500 shrink-0`} />
                <span className="text-sm text-gray-700 flex-1 truncate">{t.trade}</span>
                <span className="text-xs text-gray-500 tabular-nums">
                  Ø {t.avgLeadTime}d
                </span>
                {t.delayed > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                    {t.delayed} verspätet
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top verspätete Projekte */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Top verspätete Projekte
            </h3>
          </div>
          <div className="space-y-2">
            {/* FIX ME: aus DB — JOIN Project + ScheduleItem, berechne max delay */}
            {MOCK_TOP_DELAYED.map((p) => (
              <div
                key={p.project}
                className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-xs font-bold text-red-600 tabular-nums w-10 shrink-0">
                  +{p.delayDays}d
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{p.project}</div>
                  <div className="text-xs text-gray-500">{p.tradeCategory}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer-Hinweis */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <p className="font-semibold mb-1">
            FIX ME — Dieses Dashboard zeigt Mock-Daten
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            <li>API <code className="bg-amber-100 px-1 rounded">/api/admin/kpi</code> aufbauen mit Aggregationen</li>
            <li>Audit-Log-Tabelle im Prisma-Schema anlegen (Write-Operationen erfassen)</li>
            <li>Chart-Library wählen (recharts empfohlen — React 19 kompatibel)</li>
            <li>Zeitraum-Filter (DatePicker-Range) und Projekt/Gewerk-Multi-Select umsetzen</li>
            <li>Export (CSV/PDF) implementieren</li>
            <li>Permission-Check: <code className="bg-amber-100 px-1 rounded">isAdmin()</code> oder feingranular über Rolle</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Komponente ---------------------------------------------------------

function KpiCard({
  icon: Icon,
  color,
  label,
  value,
  delta,
  deltaPositiveIsGood = true,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  value: number | string;
  delta?: number;
  deltaPositiveIsGood?: boolean;
  highlight?: "warn" | "crit";
}) {
  const valueColor =
    highlight === "crit"
      ? "text-red-700"
      : highlight === "warn"
        ? "text-amber-700"
        : "text-gray-900";

  const deltaIsGood = delta === undefined
    ? null
    : deltaPositiveIsGood
      ? delta >= 0
      : delta <= 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      {delta !== undefined && (
        <div
          className={`text-xs mt-1 tabular-nums ${
            deltaIsGood ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {delta >= 0 ? "+" : ""}
          {delta} {typeof delta === "number" && Math.abs(delta) < 100 ? "%" : ""} vs. Vorperiode
        </div>
      )}
    </div>
  );
}
