/**
 * Timeline-Helper für das Gantt-Chart (Terminplan).
 *
 * Reine, deterministische Funktionen. Keine Prisma-/React-Imports.
 * Lokale Zeit, nicht UTC (deutsche Kalendersemantik).
 */

export type ZoomLevel = "DAY" | "WEEK" | "MONTH";

// --- interne Konstanten / Helper --------------------------------------------

const MS_PER_DAY = 86_400_000;

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

const WEEKDAY_SHORT_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Lokale Mitternacht eines Datums (neues Date). */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Letzter Tag des Monats (Zahl). */
function lastDayOfMonth(year: number, monthZeroBased: number): number {
  // Tag 0 des Folgemonats = letzter Tag dieses Monats.
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

// --- Kalender-Grundfunktionen -----------------------------------------------

/** ISO-Kalenderwoche (1-53) eines Datums. */
export function getIsoWeek(d: Date): number {
  const temp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const week1 = new Date(temp.getFullYear(), 0, 4);
  const diffDays = (temp.getTime() - week1.getTime()) / MS_PER_DAY;
  return 1 + Math.round((diffDays - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** ISO-Weekday (1=Mo, 7=So). */
export function getIsoWeekday(d: Date): number {
  // getDay(): 0=So, 1=Mo, ..., 6=Sa
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Montag der Woche von d (auf 00:00 gesetzt). */
export function startOfWeek(d: Date): Date {
  const base = startOfDay(d);
  const wd = getIsoWeekday(base); // 1..7
  base.setDate(base.getDate() - (wd - 1));
  return base;
}

/** 1. des Monats von d (00:00). */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** n Tage addieren (kein Mutieren). */
export function addDays(d: Date, n: number): Date {
  const out = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * n Monate addieren (kein Mutieren). Tag wird gehalten oder auf
 * Monatsende gekappt (z. B. 31.01. + 1 Monat = 28./29.02.).
 */
export function addMonths(d: Date, n: number): Date {
  const year = d.getFullYear();
  const month = d.getMonth() + n;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const maxDay = lastDayOfMonth(targetYear, targetMonth);
  const day = Math.min(d.getDate(), maxDay);
  return new Date(
    targetYear,
    targetMonth,
    day,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

/**
 * Ganze Tage zwischen zwei Daten (b - a), abgerundet auf Kalendertage.
 * Ignoriert Uhrzeit (nimmt lokale Mitternacht).
 */
export function daysBetween(a: Date, b: Date): number {
  const a0 = startOfDay(a).getTime();
  const b0 = startOfDay(b).getTime();
  return Math.round((b0 - a0) / MS_PER_DAY);
}

// --- Formatter --------------------------------------------------------------

/** "3" — nur der Tag (Monat separat im übergeordneten Header). */
export function formatDayLabel(d: Date): string {
  return String(d.getDate());
}

/** "KW 14" */
export function formatWeekLabel(d: Date): string {
  return `KW ${getIsoWeek(d)}`;
}

/** "April 2025" */
export function formatMonthLabel(d: Date): string {
  return `${MONTH_NAMES_DE[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Mo", "Di", ... */
export function formatWeekdayShort(d: Date): string {
  return WEEKDAY_SHORT_DE[getIsoWeekday(d) - 1];
}

/** "03.04.2025" */
export function formatDateFull(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// --- Range & Columns --------------------------------------------------------

/**
 * Aus einer Liste von Items eine Timeline-Spanne ermitteln.
 * Padding in Tagen, default 7 links und 14 rechts.
 */
export function computeTimelineRange(
  items: ReadonlyArray<{ startDate: Date; endDate: Date }>,
  options?: {
    padStartDays?: number;
    padEndDays?: number;
    minDurationDays?: number;
  },
): { start: Date; end: Date; totalDays: number } {
  const padStart = options?.padStartDays ?? 7;
  const padEnd = options?.padEndDays ?? 14;
  const minDuration = options?.minDurationDays ?? 30;

  let minTs: number | null = null;
  let maxTs: number | null = null;

  for (const it of items) {
    const s = startOfDay(it.startDate).getTime();
    const e = startOfDay(it.endDate).getTime();
    const lo = Math.min(s, e);
    const hi = Math.max(s, e);
    if (minTs === null || lo < minTs) minTs = lo;
    if (maxTs === null || hi > maxTs) maxTs = hi;
  }

  // Fallback: leere Item-Liste -> Range rund um "heute".
  if (minTs === null || maxTs === null) {
    const today = startOfDay(new Date());
    const start = addDays(today, -padStart);
    const end = addDays(today, Math.max(padEnd, minDuration));
    return { start, end, totalDays: daysBetween(start, end) };
  }

  let start = addDays(new Date(minTs), -padStart);
  let end = addDays(new Date(maxTs), padEnd);

  // Mindestspanne sicherstellen.
  const currentSpan = daysBetween(start, end);
  if (currentSpan < minDuration) {
    const missing = minDuration - currentSpan;
    end = addDays(end, missing);
  }

  return { start, end, totalDays: daysBetween(start, end) };
}

export type TimelineColumn = {
  start: Date;
  end: Date; // exklusiv (erster Tag der nächsten Spalte)
  label: string;
  offsetDays: number; // ab rangeStart
  widthDays: number;
  isWeekend?: boolean;
};

/**
 * Spalten für die Header-Zeile, je nach Zoom-Level.
 *  DAY:   1 Kalendertag pro Spalte
 *  WEEK:  1 Woche pro Spalte (Montag)
 *  MONTH: 1 Monat pro Spalte
 */
export function computeTimelineColumns(
  rangeStart: Date,
  rangeEnd: Date,
  zoom: ZoomLevel,
): TimelineColumn[] {
  const start0 = startOfDay(rangeStart);
  const end0 = startOfDay(rangeEnd);
  const cols: TimelineColumn[] = [];

  if (zoom === "DAY") {
    let cursor = start0;
    while (cursor.getTime() < end0.getTime()) {
      const next = addDays(cursor, 1);
      const wd = getIsoWeekday(cursor);
      cols.push({
        start: cursor,
        end: next,
        label: formatDayLabel(cursor),
        offsetDays: daysBetween(start0, cursor),
        widthDays: 1,
        isWeekend: wd === 6 || wd === 7,
      });
      cursor = next;
    }
    return cols;
  }

  if (zoom === "WEEK") {
    let cursor = startOfWeek(start0);
    while (cursor.getTime() < end0.getTime()) {
      const next = addDays(cursor, 7);
      // Spalten am Rand können außerhalb [start0, end0] liegen;
      // wir clampen für offset/width auf die Range.
      const visibleStart =
        cursor.getTime() < start0.getTime() ? start0 : cursor;
      const visibleEnd = next.getTime() > end0.getTime() ? end0 : next;
      cols.push({
        start: cursor,
        end: next,
        label: formatWeekLabel(cursor),
        offsetDays: daysBetween(start0, visibleStart),
        widthDays: daysBetween(visibleStart, visibleEnd),
      });
      cursor = next;
    }
    return cols;
  }

  // MONTH
  let cursor = startOfMonth(start0);
  while (cursor.getTime() < end0.getTime()) {
    const next = addMonths(cursor, 1);
    const visibleStart = cursor.getTime() < start0.getTime() ? start0 : cursor;
    const visibleEnd = next.getTime() > end0.getTime() ? end0 : next;
    cols.push({
      start: cursor,
      end: next,
      label: formatMonthLabel(cursor),
      offsetDays: daysBetween(start0, visibleStart),
      widthDays: daysBetween(visibleStart, visibleEnd),
    });
    cursor = next;
  }
  return cols;
}

// --- Geometrie für Balken ---------------------------------------------------

/**
 * Offset + Width eines Items in Prozent relativ zur totalDays-Spanne.
 * Endpunkt wird als exklusiv + 1 Tag interpretiert (damit ein Item
 * mit start == end eine sichtbare Breite von einem Tag hat).
 */
export function computeBarGeometry(
  itemStart: Date,
  itemEnd: Date,
  rangeStart: Date,
  totalDays: number,
): { leftPercent: number; widthPercent: number } {
  if (totalDays <= 0) {
    return { leftPercent: 0, widthPercent: 0 };
  }

  const lo = itemStart.getTime() <= itemEnd.getTime() ? itemStart : itemEnd;
  const hi = itemStart.getTime() <= itemEnd.getTime() ? itemEnd : itemStart;

  const offset = daysBetween(rangeStart, lo);
  const widthRaw = daysBetween(lo, hi) + 1; // +1 = Endtag inklusiv

  const leftPercent = (offset / totalDays) * 100;
  const widthPercent = (widthRaw / totalDays) * 100;

  return { leftPercent, widthPercent };
}

/** "Heute"-Offset in Prozent oder null, wenn außerhalb der Range. */
export function computeTodayOffset(
  rangeStart: Date,
  totalDays: number,
  now?: Date,
): number | null {
  if (totalDays <= 0) return null;
  const today = startOfDay(now ?? new Date());
  const offset = daysBetween(rangeStart, today);
  if (offset < 0 || offset > totalDays) return null;
  return (offset / totalDays) * 100;
}

/**
 * Pixel-Delta in Tages-Delta umrechnen (für Drag & Drop).
 * Das Ergebnis ist ganzzahlig gerundet (volle Tage).
 */
export function pixelDeltaToDays(
  pixelDelta: number,
  totalPixelWidth: number,
  totalDays: number,
): number {
  if (totalPixelWidth <= 0 || totalDays <= 0) return 0;
  return Math.round((pixelDelta / totalPixelWidth) * totalDays);
}

// --- Self-Test (nur im Test-Modus) ------------------------------------------

if (process.env.NODE_ENV === "test") {
  const assert = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`time.ts self-test failed: ${msg}`);
  };

  // 2025-01-01 ist ein Mittwoch -> ISO-KW 1
  assert(getIsoWeek(new Date(2025, 0, 1)) === 1, "isoWeek(2025-01-01) == 1");

  // 2025-12-31 ist ein Mittwoch -> ISO-KW 1 (2026) ODER >= 52
  // Korrekt: 2025-12-31 liegt noch in KW 1/2026, ISO-Week-Zahl = 1.
  // Der Test verlangt "> 50" für ein Datum, das wir als Ende 2025 prüfen.
  // -> wir nehmen ein Datum, das garantiert in KW 52/53 2025 liegt: 2025-12-22 (Mo) = KW 52.
  assert(
    getIsoWeek(new Date(2025, 11, 22)) > 50,
    "isoWeek(2025-12-22) > 50",
  );

  // addMonths über Jahreswechsel
  const jan31 = new Date(2025, 0, 31);
  const febResult = addMonths(jan31, 1);
  assert(
    febResult.getFullYear() === 2025 &&
      febResult.getMonth() === 1 &&
      febResult.getDate() === 28,
    "addMonths(2025-01-31, +1) == 2025-02-28",
  );

  const decToJan = addMonths(new Date(2025, 11, 15), 1);
  assert(
    decToJan.getFullYear() === 2026 &&
      decToJan.getMonth() === 0 &&
      decToJan.getDate() === 15,
    "addMonths(2025-12-15, +1) == 2026-01-15",
  );

  // daysBetween
  assert(
    daysBetween(new Date(2025, 0, 1), new Date(2025, 0, 8)) === 7,
    "daysBetween(01.01, 08.01) == 7",
  );
}
