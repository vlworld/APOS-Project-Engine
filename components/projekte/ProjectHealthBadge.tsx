import { Activity, AlertTriangle, CheckCircle2, HelpCircle, TrendingDown, TrendingUp } from "lucide-react";
import type { ProjectHealth } from "@/lib/projekte/health";

type Variant = "compact" | "detailed";

const LEVEL_STYLES: Record<ProjectHealth["level"], { bg: string; text: string; ring: string; dot: string; bar: string }> = {
  GREEN: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  YELLOW: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  RED: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
  UNKNOWN: {
    bg: "bg-gray-50",
    text: "text-gray-500",
    ring: "ring-gray-200",
    dot: "bg-gray-300",
    bar: "bg-gray-300",
  },
};

function iconForLevel(level: ProjectHealth["level"]) {
  switch (level) {
    case "GREEN":
      return CheckCircle2;
    case "YELLOW":
      return Activity;
    case "RED":
      return AlertTriangle;
    default:
      return HelpCircle;
  }
}

export default function ProjectHealthBadge({
  health,
  variant = "detailed",
}: {
  health: ProjectHealth;
  variant?: Variant;
}) {
  const style = LEVEL_STYLES[health.level];
  const Icon = iconForLevel(health.level);

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${style.bg} ${style.text} ${style.ring}`}
        title={health.description}
      >
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        {health.label}
      </span>
    );
  }

  const { metrics, signals } = health;
  const gapPositive = metrics.progressGapPercent >= 0;

  return (
    <div className={`rounded-2xl ring-1 ${style.ring} ${style.bg} p-5`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.dot} bg-opacity-20`}>
            <Icon className={`w-5 h-5 ${style.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-lg font-bold ${style.text}`}>{health.label}</h3>
              {health.level !== "UNKNOWN" && (
                <span className={`text-xs font-semibold ${style.text} opacity-75`}>
                  {health.score}/100
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{health.description}</p>
          </div>
        </div>
      </div>

      {/* Score-Balken */}
      {health.level !== "UNKNOWN" && (
        <div className="mb-4">
          <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${style.bar} transition-all`}
              style={{ width: `${health.score}%` }}
            />
          </div>
        </div>
      )}

      {/* Metriken-Grid */}
      {metrics.totalItems > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Metric label="Arbeitspakete" value={metrics.totalItems} />
          <Metric
            label="Überfällig"
            value={metrics.delayedItems}
            highlight={metrics.delayedItems > 0 ? "crit" : undefined}
          />
          <Metric label="Abgeschlossen" value={metrics.completedItems} />
          <Metric
            label="Plan-Delta"
            value={`${gapPositive ? "+" : ""}${metrics.progressGapPercent} %`}
            highlight={
              metrics.progressGapPercent <= -15
                ? "crit"
                : metrics.progressGapPercent <= -5
                  ? "warn"
                  : undefined
            }
            icon={gapPositive ? TrendingUp : TrendingDown}
          />
        </div>
      )}

      {/* Fortschritts-Bar (Soll vs Ist) */}
      {metrics.totalItems > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600">
              Ist: {metrics.actualProgressPercent} %
            </span>
            <span className="text-gray-500">
              Soll: {metrics.expectedProgressPercent} %
            </span>
          </div>
          <div className="relative h-2 bg-white/60 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gray-300"
              style={{ width: `${metrics.expectedProgressPercent}%` }}
            />
            <div
              className={`absolute inset-y-0 left-0 ${style.bar}`}
              style={{ width: `${metrics.actualProgressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Signale */}
      {signals.length > 0 && (
        <div className="space-y-1.5">
          {signals.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  s.severity === "crit"
                    ? "bg-red-500"
                    : s.severity === "warn"
                      ? "bg-amber-500"
                      : "bg-gray-400"
                }`}
              />
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  highlight?: "warn" | "crit";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const color =
    highlight === "crit"
      ? "text-red-700"
      : highlight === "warn"
        ? "text-amber-700"
        : "text-gray-900";

  return (
    <div className="bg-white/70 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`flex items-center gap-1 text-base font-semibold ${color}`}>
        {Icon && <Icon className="w-4 h-4" />}
        {value}
      </div>
    </div>
  );
}
