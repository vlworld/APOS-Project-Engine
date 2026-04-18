/**
 * Arbeitstag-Helper fuer den Bauzeitenplan.
 *
 * Reiner Rechenbaustein: keine Prisma-Queries, keine I/O. Feiertage werden
 * immer als Parameter uebergeben (Set<"YYYY-MM-DD">). Aufrufer laedt sie
 * selbst (z. B. aus einer Holiday-Tabelle) und baut mit `buildHolidaySet`
 * das Set.
 *
 * Wichtig: alle Datums-Operationen in LOKALER Zeit (CET/CEST). Wir ignorieren
 * Zeitzonen-Komplikationen bewusst, weil Baustellen-Kalender in Deutschland
 * immer lokal gedacht werden. `toDateKey` nutzt deshalb `getFullYear/Month/Date`
 * und nicht `toISOString()`.
 */

/** Zweistellig mit fuehrender Null (fuer toDateKey). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Formatiert ein Date als "YYYY-MM-DD" in LOKALER Zeit.
 * Nicht `toISOString()` nutzen — das wuerde in UTC konvertieren und am
 * Tageswechsel das falsche Datum liefern.
 */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Parst einen "YYYY-MM-DD"-Key zurueck zu einem Date auf Mitternacht lokale
 * Zeit. Bewusst NICHT `new Date(s)` (das waere UTC-interpretiert).
 */
export function fromDateKey(s: string): Date {
  const parts = s.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid date key: ${s}`);
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Invalid date key: ${s}`);
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Erzeugt eine Kopie eines Date auf Mitternacht lokale Zeit — verhindert
 * Mutation und macht Tag-Vergleiche robust gegen Uhrzeit-Anteile.
 */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Baut aus einem Array von Holiday-Records (z. B. aus Prisma) ein
 * Set<"YYYY-MM-DD"> fuer schnellen Lookup. Akzeptiert `date` als Date
 * oder String — Strings werden als "YYYY-MM-DD"-Prefix interpretiert.
 */
export function buildHolidaySet(
  holidays: ReadonlyArray<{ date: Date | string }>,
): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    if (h.date instanceof Date) {
      set.add(toDateKey(h.date));
    } else {
      // String: nur die ersten 10 Zeichen nehmen, damit auch
      // "2026-12-25T00:00:00.000Z" sauber als "2026-12-25" landet.
      set.add(h.date.slice(0, 10));
    }
  }
  return set;
}

/**
 * True, wenn der Tag Mo–Fr ist UND nicht in der Feiertagsliste steht.
 * Samstag (6) und Sonntag (0) sind per Definition keine Arbeitstage.
 */
export function isWorkday(date: Date, holidays: ReadonlySet<string>): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays.has(toDateKey(date));
}

/**
 * Zaehlt Arbeitstage inklusive beider Endpunkte (start ≤ end).
 * Liefert 0, wenn start > end — kein Fehler, sondern neutral.
 */
export function countWorkdays(
  start: Date,
  end: Date,
  holidays: ReadonlySet<string>,
): number {
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (s.getTime() > e.getTime()) return 0;

  let count = 0;
  const cursor = new Date(s.getTime());
  while (cursor.getTime() <= e.getTime()) {
    if (isWorkday(cursor, holidays)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Addiert `days` Arbeitstage zu `from`. `days` kann negativ sein.
 * Startdatum selbst zaehlt NICHT mit — addWorkdays(Fr, 1) = Mo, nicht Fr.
 * `days === 0` liefert einen Klon von `from` (auf Mitternacht normalisiert).
 */
export function addWorkdays(
  from: Date,
  days: number,
  holidays: ReadonlySet<string>,
): Date {
  const result = startOfDay(from);
  if (days === 0) return result;

  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    result.setDate(result.getDate() + step);
    if (isWorkday(result, holidays)) remaining--;
  }
  return result;
}

/**
 * Naechstes Arbeitstag ≥ date. Wenn date selbst Arbeitstag ist,
 * wird date (normalisiert) zurueckgegeben.
 */
export function nextWorkday(date: Date, holidays: ReadonlySet<string>): Date {
  const result = startOfDay(date);
  while (!isWorkday(result, holidays)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * Voriges Arbeitstag ≤ date. Wenn date selbst Arbeitstag ist,
 * wird date (normalisiert) zurueckgegeben.
 */
export function previousWorkday(
  date: Date,
  holidays: ReadonlySet<string>,
): Date {
  const result = startOfDay(date);
  while (!isWorkday(result, holidays)) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Selbsttest-Block (nur unter NODE_ENV=test aktiv). Keine Test-Runner-Abhaengigkeit.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "test") {
  const assert = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`workdays self-test failed: ${msg}`);
  };

  // Mo 2026-04-13 bis Fr 2026-04-17: 5 Arbeitstage, keine Feiertage.
  const monday = new Date(2026, 3, 13); // Monat 3 = April
  const friday = new Date(2026, 3, 17);
  const noHolidays: ReadonlySet<string> = new Set<string>();
  assert(
    countWorkdays(monday, friday, noHolidays) === 5,
    "Mo-Fr einer Woche sollte 5 Arbeitstage ergeben",
  );

  // Fr + 1 Arbeitstag = Mo (Wochenende ueberspringen).
  const nextMonday = addWorkdays(friday, 1, noHolidays);
  assert(
    toDateKey(nextMonday) === "2026-04-20",
    `Fr + 1 sollte Mo 2026-04-20 sein, war ${toDateKey(nextMonday)}`,
  );

  // Mo - 1 Arbeitstag = Fr davor.
  const prevFriday = addWorkdays(monday, -1, noHolidays);
  assert(
    toDateKey(prevFriday) === "2026-04-10",
    `Mo - 1 sollte Fr 2026-04-10 sein, war ${toDateKey(prevFriday)}`,
  );

  // Feiertag am Mi (2026-04-15): Woche hat dann nur 4 Arbeitstage.
  const withMidweekHoliday: ReadonlySet<string> = new Set<string>(["2026-04-15"]);
  assert(
    countWorkdays(monday, friday, withMidweekHoliday) === 4,
    "Mit Feiertag am Mi sollten 4 Arbeitstage uebrig sein",
  );
  assert(
    isWorkday(new Date(2026, 3, 15), withMidweekHoliday) === false,
    "Mi 2026-04-15 mit Feiertag darf kein Arbeitstag sein",
  );

  // nextWorkday springt ueber Feiertag hinweg.
  const afterHoliday = nextWorkday(new Date(2026, 3, 15), withMidweekHoliday);
  assert(
    toDateKey(afterHoliday) === "2026-04-16",
    `nextWorkday nach Feiertag-Mi sollte Do sein, war ${toDateKey(afterHoliday)}`,
  );

  // buildHolidaySet akzeptiert Date und String.
  const set = buildHolidaySet([
    { date: new Date(2026, 11, 25) },
    { date: "2026-12-26T00:00:00.000Z" },
  ]);
  assert(set.has("2026-12-25"), "buildHolidaySet sollte Date-Objekt aufnehmen");
  assert(set.has("2026-12-26"), "buildHolidaySet sollte ISO-String auf YYYY-MM-DD kuerzen");

  // Roundtrip toDateKey <-> fromDateKey.
  const roundtrip = fromDateKey(toDateKey(monday));
  assert(
    roundtrip.getTime() === monday.getTime(),
    "toDateKey/fromDateKey Roundtrip sollte identisches Date liefern",
  );
}
