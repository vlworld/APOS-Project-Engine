import { prisma } from "@/lib/prisma";

export type HealthLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export type ProjectHealth = {
  level: HealthLevel;
  score: number; // 0–100
  label: string;
  description: string;
  metrics: {
    totalItems: number;
    delayedItems: number;
    completedItems: number;
    expectedProgressPercent: number; // laut Zeitplan
    actualProgressPercent: number;   // Durchschnitt der Items
    progressGapPercent: number;      // actual - expected (negativ = Rückstand)
  };
  signals: Array<{ severity: "info" | "warn" | "crit"; text: string }>;
};

type ProjectForHealth = {
  id: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
};

/**
 * Berechnet den Health-Status eines Projekts aus seinem Bauzeitenplan.
 * Pure (keine Prisma-Query): nimmt alle Daten als Parameter, macht selbst
 * die Analyse. Gut für Tests, klare Grenzen.
 */
export function computeHealthPure(
  project: ProjectForHealth,
  items: ReadonlyArray<{ startDate: Date; endDate: Date; progress: number; status: string }>,
  now: Date = new Date(),
): ProjectHealth {
  const total = items.length;
  const completed = items.filter((i) => i.status === "DONE").length;
  const delayed = items.filter(
    (i) => i.status !== "DONE" && i.endDate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
  ).length;

  const actualProgress =
    total === 0
      ? 0
      : Math.round(items.reduce((s, i) => s + (i.progress ?? 0), 0) / total);

  // Erwarteter Fortschritt aus dem Zeitplan-Fenster
  let expectedProgress = 0;
  if (project.startDate && project.endDate) {
    const start = project.startDate.getTime();
    const end = project.endDate.getTime();
    const today = now.getTime();
    if (today <= start) expectedProgress = 0;
    else if (today >= end) expectedProgress = 100;
    else expectedProgress = Math.round(((today - start) / (end - start)) * 100);
  }

  const progressGap = actualProgress - expectedProgress; // negativ = Rückstand

  // Score-Berechnung
  let score = 100;
  const signals: ProjectHealth["signals"] = [];

  if (total === 0) {
    return {
      level: "UNKNOWN",
      score: 0,
      label: "Noch keine Daten",
      description: "Keine Arbeitspakete angelegt — Health nicht bewertbar.",
      metrics: {
        totalItems: 0,
        delayedItems: 0,
        completedItems: 0,
        expectedProgressPercent: 0,
        actualProgressPercent: 0,
        progressGapPercent: 0,
      },
      signals: [{ severity: "info", text: "Lege Arbeitspakete an, um den Status zu bewerten." }],
    };
  }

  // 1. Verspätete Items
  const delayedRatio = delayed / total;
  if (delayedRatio >= 0.3) {
    score -= 35;
    signals.push({ severity: "crit", text: `${delayed} von ${total} Arbeitspaketen überfällig (${Math.round(delayedRatio * 100)} %)` });
  } else if (delayedRatio >= 0.1) {
    score -= 15;
    signals.push({ severity: "warn", text: `${delayed} Arbeitspakete überfällig` });
  } else if (delayed > 0) {
    score -= 5;
    signals.push({ severity: "warn", text: `${delayed} überfällige Arbeitspakete` });
  }

  // 2. Projekt-Status
  if (project.status === "ON_HOLD") {
    score -= 25;
    signals.push({ severity: "warn", text: "Projekt ist pausiert" });
  } else if (project.status === "ARCHIVED") {
    score -= 5;
    signals.push({ severity: "info", text: "Projekt ist archiviert" });
  }

  // 3. Progress-Gap
  if (progressGap <= -25) {
    score -= 25;
    signals.push({ severity: "crit", text: `Fortschritt ${Math.abs(progressGap)} %-Punkte hinter Plan` });
  } else if (progressGap <= -15) {
    score -= 15;
    signals.push({ severity: "warn", text: `Fortschritt ${Math.abs(progressGap)} %-Punkte hinter Plan` });
  } else if (progressGap <= -5) {
    score -= 5;
    signals.push({ severity: "info", text: `Fortschritt leicht hinter Plan` });
  } else if (progressGap >= 10) {
    signals.push({ severity: "info", text: `Fortschritt ${progressGap} %-Punkte vor Plan` });
  }

  // 4. Positive Signale
  if (signals.length === 0) {
    signals.push({ severity: "info", text: "Alle Arbeitspakete im Zeitrahmen" });
  }
  if (completed > 0) {
    signals.push({
      severity: "info",
      text: `${completed} Arbeitspakete abgeschlossen`,
    });
  }

  score = Math.max(0, Math.min(100, score));

  // Level-Zuordnung
  let level: HealthLevel = "GREEN";
  let label = "Im Plan";
  let description = "Das Projekt verläuft nach Zeitplan.";

  if (score < 50) {
    level = "RED";
    label = "Kritisch";
    description = "Deutliche Abweichungen vom Plan — Handlungsbedarf.";
  } else if (score < 80) {
    level = "YELLOW";
    label = "Beobachtung";
    description = "Einzelne Abweichungen — genauer im Blick behalten.";
  }

  return {
    level,
    score,
    label,
    description,
    metrics: {
      totalItems: total,
      delayedItems: delayed,
      completedItems: completed,
      expectedProgressPercent: expectedProgress,
      actualProgressPercent: actualProgress,
      progressGapPercent: progressGap,
    },
    signals,
  };
}

/**
 * Convenience: lädt Items aus der DB und berechnet den Health-Status.
 */
export async function computeProjectHealth(projectId: string): Promise<ProjectHealth> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, startDate: true, endDate: true },
  });
  if (!project) {
    return {
      level: "UNKNOWN",
      score: 0,
      label: "Unbekannt",
      description: "Projekt nicht gefunden.",
      metrics: {
        totalItems: 0,
        delayedItems: 0,
        completedItems: 0,
        expectedProgressPercent: 0,
        actualProgressPercent: 0,
        progressGapPercent: 0,
      },
      signals: [],
    };
  }

  const items = await prisma.scheduleItem.findMany({
    where: { projectId },
    select: { startDate: true, endDate: true, progress: true, status: true },
  });

  return computeHealthPure(project, items);
}
