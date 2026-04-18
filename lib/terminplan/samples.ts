/**
 * Muster-Daten für den Terminplan (Gewerke, NRW-Feiertage, Muster-PV-Projekt).
 * Wird vom "Musterdaten laden"-Toggle importiert.
 * Keine Runtime-Abhängigkeiten — nur plain Konstanten und eine Helper-Funktion.
 */

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type SampleTradeCategory = {
  name: string;
  color: string;
  orderIndex: number;
};

export type SampleHoliday = {
  date: string;
  name: string;
};

export type SampleScheduleItemStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export type SampleScheduleItem = {
  tempId: string;
  parentTempId?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isMilestone: boolean;
  tradeCategoryName: string;
  orderIndex: number;
  status: SampleScheduleItemStatus;
  progress: number;
};

export type SamplePvProject = {
  project: {
    name: string;
    projectNumber: string;
    description: string;
    clientName: string;
    address: string;
    startDate: string;
    endDate: string;
    status: "PLANNING";
  };
  items: SampleScheduleItem[];
};

// ---------------------------------------------------------------------------
// 1) Gewerke
// ---------------------------------------------------------------------------

export const SAMPLE_TRADE_CATEGORIES: SampleTradeCategory[] = [
  { name: "Projektmanagement", color: "slate", orderIndex: 1 },
  { name: "Vorstand", color: "violet", orderIndex: 2 },
  { name: "Vermessung", color: "amber", orderIndex: 3 },
  { name: "Projektierung", color: "blue", orderIndex: 4 },
  { name: "Zaunbau", color: "emerald", orderIndex: 5 },
  { name: "DC-Montage", color: "rose", orderIndex: 6 },
  { name: "AC-Montage", color: "cyan", orderIndex: 7 },
  { name: "DC-Abnahme", color: "teal", orderIndex: 8 },
  { name: "AC-Vorbereitung", color: "orange", orderIndex: 9 },
  { name: "Elektro", color: "sky", orderIndex: 10 },
  { name: "Tiefbau", color: "lime", orderIndex: 11 },
  { name: "Anlagenzertifizierung", color: "fuchsia", orderIndex: 12 },
];

// ---------------------------------------------------------------------------
// 2) NRW-Feiertage (per Funktion)
// ---------------------------------------------------------------------------

/**
 * Berechnet den Ostersonntag eines Jahres nach der Gauß'schen Osterformel.
 * Rückgabe: { month: 1-basiert, day: 1-basiert } im gregorianischen Kalender.
 */
function calculateEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function formatDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map((s) => Number.parseInt(s, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function getSampleHolidaysNRW(years: number[]): SampleHoliday[] {
  const holidays: SampleHoliday[] = [];
  for (const year of years) {
    const easter = calculateEasterSunday(year);
    const easterIso = formatDate(year, easter.month, easter.day);

    holidays.push({ date: formatDate(year, 1, 1), name: "Neujahr" });
    holidays.push({ date: addDaysIso(easterIso, -2), name: "Karfreitag" });
    holidays.push({ date: addDaysIso(easterIso, 1), name: "Ostermontag" });
    holidays.push({ date: formatDate(year, 5, 1), name: "Tag der Arbeit" });
    holidays.push({
      date: addDaysIso(easterIso, 39),
      name: "Christi Himmelfahrt",
    });
    holidays.push({ date: addDaysIso(easterIso, 50), name: "Pfingstmontag" });
    holidays.push({ date: addDaysIso(easterIso, 60), name: "Fronleichnam" });
    holidays.push({
      date: formatDate(year, 10, 3),
      name: "Tag der deutschen Einheit",
    });
    holidays.push({ date: formatDate(year, 11, 1), name: "Allerheiligen" });
    holidays.push({ date: formatDate(year, 12, 25), name: "1. Weihnachtstag" });
    holidays.push({ date: formatDate(year, 12, 26), name: "2. Weihnachtstag" });
  }
  return holidays;
}

// ---------------------------------------------------------------------------
// 3) Muster-PV-Projekt
// ---------------------------------------------------------------------------

const items: SampleScheduleItem[] = [
  // =========================================================================
  // Phase A — Detailplanung (01.04.2025 - 21.10.2025)
  // =========================================================================
  {
    tempId: "phase-detailplanung",
    name: "Detailplanung",
    description: "Technische Detailplanung der gesamten PV-Anlage",
    startDate: "2025-04-01",
    endDate: "2025-10-21",
    isMilestone: false,
    tradeCategoryName: "Projektmanagement",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "phase-detailplanung-projektierung",
    parentTempId: "phase-detailplanung",
    name: "Projektierung",
    description: "Planung aller technischen Gewerke",
    startDate: "2025-04-01",
    endDate: "2025-08-29",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-unterkonstruktion-festlegen",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Unterkonstruktion festlegen",
    startDate: "2025-04-01",
    endDate: "2025-04-25",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-verstringung-planen",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Verstringung planen",
    startDate: "2025-04-28",
    endDate: "2025-05-16",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "milestone-wr-standorte",
    parentTempId: "task-verstringung-planen",
    name: "Wechselrichterstandorte definieren",
    startDate: "2025-05-16",
    endDate: "2025-05-16",
    isMilestone: true,
    tradeCategoryName: "Projektierung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-modulbelegung",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Modulbelegung planen",
    startDate: "2025-05-19",
    endDate: "2025-06-06",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 3,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "milestone-module-festlegen",
    parentTempId: "task-modulbelegung",
    name: "Module festlegen",
    startDate: "2025-06-06",
    endDate: "2025-06-06",
    isMilestone: true,
    tradeCategoryName: "Projektierung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-erdung-planen",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Erdung planen",
    startDate: "2025-06-09",
    endDate: "2025-06-27",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 4,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-uk-erden",
    parentTempId: "task-erdung-planen",
    name: "Unterkonstruktion erden",
    startDate: "2025-06-09",
    endDate: "2025-06-13",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-wr-erdung",
    parentTempId: "task-erdung-planen",
    name: "Wechselrichter Erdung planen",
    startDate: "2025-06-16",
    endDate: "2025-06-20",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-trafoerdung",
    parentTempId: "task-erdung-planen",
    name: "Trafoerdung planen",
    startDate: "2025-06-23",
    endDate: "2025-06-27",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 3,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-entsorgungskonzept",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Entsorgungskonzept erstellen",
    startDate: "2025-06-30",
    endDate: "2025-07-11",
    isMilestone: false,
    tradeCategoryName: "Projektierung",
    orderIndex: 5,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-smr-konzept",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Schutz-, Mess- & Regelkonzept entwerfen",
    startDate: "2025-07-14",
    endDate: "2025-07-25",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 6,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-ns-schaltanlagen",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Niederspannungsschaltanlagen planen",
    startDate: "2025-07-28",
    endDate: "2025-08-08",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 7,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-kabelberechnung",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Kabelberechnung",
    startDate: "2025-08-11",
    endDate: "2025-08-29",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 8,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-kabellaengen",
    parentTempId: "task-kabelberechnung",
    name: "Kabellängenberechnung",
    startDate: "2025-08-11",
    endDate: "2025-08-13",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-querschnitt",
    parentTempId: "task-kabelberechnung",
    name: "Querschnittsberechnung",
    startDate: "2025-08-14",
    endDate: "2025-08-18",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-kabeltypen",
    parentTempId: "task-kabelberechnung",
    name: "Definition Kabeltypen",
    startDate: "2025-08-19",
    endDate: "2025-08-21",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 3,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-kabelschuhe",
    parentTempId: "task-kabelberechnung",
    name: "Kabelschuhe festlegen",
    startDate: "2025-08-22",
    endDate: "2025-08-29",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 4,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-kabelschuhe-kompat",
    parentTempId: "task-kabelschuhe",
    name: "Kompatibilität Kabel/Kabelschuhe prüfen",
    startDate: "2025-08-22",
    endDate: "2025-08-29",
    isMilestone: false,
    tradeCategoryName: "Elektro",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-kabelgraeben",
    parentTempId: "phase-detailplanung-projektierung",
    name: "Planung Kabelgräben",
    startDate: "2025-09-01",
    endDate: "2025-09-12",
    isMilestone: false,
    tradeCategoryName: "Tiefbau",
    orderIndex: 9,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-schutzrohr",
    parentTempId: "task-kabelgraeben",
    name: "Schutzrohr/Sandbett definieren",
    startDate: "2025-09-01",
    endDate: "2025-09-05",
    isMilestone: false,
    tradeCategoryName: "Tiefbau",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-abmasse",
    parentTempId: "task-kabelgraeben",
    name: "Abmaße (h/b/t)",
    startDate: "2025-09-08",
    endDate: "2025-09-12",
    isMilestone: false,
    tradeCategoryName: "Tiefbau",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },

  // =========================================================================
  // Phase B — Vorarbeiten (22.08.2025 - 19.09.2025)
  // =========================================================================
  {
    tempId: "phase-vorarbeiten",
    name: "Vorarbeiten",
    description: "Vermessung und Zaunbau vor Montagebeginn",
    startDate: "2025-08-22",
    endDate: "2025-09-19",
    isMilestone: false,
    tradeCategoryName: "Projektmanagement",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-vermessen",
    parentTempId: "phase-vorarbeiten",
    name: "Vermessen",
    description: "13 Arbeitstage Vermessung vor Ort",
    startDate: "2025-08-22",
    endDate: "2025-09-09",
    isMilestone: false,
    tradeCategoryName: "Vermessung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-zaunbau",
    parentTempId: "phase-vorarbeiten",
    name: "Zaunbau",
    description: "8 Arbeitstage Errichtung Umzäunung",
    startDate: "2025-09-10",
    endDate: "2025-09-19",
    isMilestone: false,
    tradeCategoryName: "Zaunbau",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "milestone-anlagenzertifizierung-init",
    parentTempId: "phase-vorarbeiten",
    name: "Anlagenzertifizierung initiieren",
    startDate: "2025-09-19",
    endDate: "2025-09-19",
    isMilestone: true,
    tradeCategoryName: "Anlagenzertifizierung",
    orderIndex: 3,
    status: "OPEN",
    progress: 0,
  },

  // =========================================================================
  // Phase C — DC-Montage (22.09.2025 - 29.10.2025)
  // =========================================================================
  {
    tempId: "phase-dc-montage",
    name: "DC-Montage",
    description: "UK, Module, Wechselrichter, DC-Kabel bis DC-Abnahme",
    startDate: "2025-09-22",
    endDate: "2025-10-29",
    isMilestone: false,
    tradeCategoryName: "DC-Montage",
    orderIndex: 3,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-uk-rammen",
    parentTempId: "phase-dc-montage",
    name: "UK rammen",
    description: "10 Arbeitstage Rammarbeiten (inkl. Feiertag 03.10.)",
    startDate: "2025-09-22",
    endDate: "2025-10-06",
    isMilestone: false,
    tradeCategoryName: "DC-Montage",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-module-montieren",
    parentTempId: "phase-dc-montage",
    name: "Module montieren",
    description: "11 Arbeitstage Modulmontage",
    startDate: "2025-10-07",
    endDate: "2025-10-21",
    isMilestone: false,
    tradeCategoryName: "DC-Montage",
    orderIndex: 2,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-ac-graeben",
    parentTempId: "phase-dc-montage",
    name: "AC-Gräben ziehen",
    description: "11 Arbeitstage Tiefbau AC-Gräben",
    startDate: "2025-10-07",
    endDate: "2025-10-21",
    isMilestone: false,
    tradeCategoryName: "Tiefbau",
    orderIndex: 3,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-wr-montage",
    parentTempId: "phase-dc-montage",
    name: "Wechselrichter Montage",
    description: "5 Arbeitstage",
    startDate: "2025-10-15",
    endDate: "2025-10-21",
    isMilestone: false,
    tradeCategoryName: "DC-Montage",
    orderIndex: 4,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-dc-kabel",
    parentTempId: "phase-dc-montage",
    name: "DC-Kabel verlegen & anschließen",
    description: "5 Arbeitstage",
    startDate: "2025-10-22",
    endDate: "2025-10-28",
    isMilestone: false,
    tradeCategoryName: "DC-Montage",
    orderIndex: 5,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-dc-abnahme",
    parentTempId: "phase-dc-montage",
    name: "DC-Abnahme",
    description: "5 Arbeitstage DC-Abnahme",
    startDate: "2025-10-22",
    endDate: "2025-10-28",
    isMilestone: false,
    tradeCategoryName: "DC-Abnahme",
    orderIndex: 6,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "milestone-dc-abnahme",
    parentTempId: "phase-dc-montage",
    name: "DC-Abnahme abgeschlossen",
    startDate: "2025-10-29",
    endDate: "2025-10-29",
    isMilestone: true,
    tradeCategoryName: "DC-Abnahme",
    orderIndex: 7,
    status: "OPEN",
    progress: 0,
  },

  // =========================================================================
  // Phase D — AC-Vorbereitung (02.09.2025 - 08.10.2025)
  // =========================================================================
  {
    tempId: "phase-ac-vorbereitung",
    name: "AC-Vorbereitung",
    description: "Vorlaufzeit Trafo-Bestellung parallel zur DC-Phase",
    startDate: "2025-09-02",
    endDate: "2025-10-08",
    isMilestone: false,
    tradeCategoryName: "AC-Vorbereitung",
    orderIndex: 4,
    status: "OPEN",
    progress: 0,
  },
  {
    tempId: "task-trafo-bestellen",
    parentTempId: "phase-ac-vorbereitung",
    name: "Trafo abstimmen und bestellen",
    description: "26 Arbeitstage Abstimmung und Beschaffung",
    startDate: "2025-09-02",
    endDate: "2025-10-08",
    isMilestone: false,
    tradeCategoryName: "AC-Vorbereitung",
    orderIndex: 1,
    status: "OPEN",
    progress: 0,
  },
];

export const SAMPLE_PV_PROJECT: SamplePvProject = {
  project: {
    name: "Solarpark Wiesau",
    projectNumber: "P-MUSTER-001",
    description:
      "Beispielhafte Freiflächen-PV-Anlage zur Demonstration der Terminplan-Funktionen",
    clientName: "MSP Solarpark Wiesau UG",
    address: "95676 Wiesau, Bayern",
    startDate: "2025-04-01",
    endDate: "2025-10-29",
    status: "PLANNING",
  },
  items,
};
