/**
 * Service-Layer für Feiertage (Holiday).
 *
 * Enthält die vollständige Business-Logik für das Holiday-CRUD:
 *  - listHolidays, createHoliday, updateHoliday, deleteHoliday
 *  - bulkImportHolidays (Muster-Import mit skipDuplicates)
 *  - buildHolidaySetForOrg (für den Workday-Rechner im Terminplan)
 *
 * Konvention (siehe CONVENTIONS.md §API-Design):
 *  - Datums-Strings IMMER als "YYYY-MM-DD" (lokales Datum).
 *  - Intern speichern wir den DateTime auf LOKALE Mitternacht
 *    (`new Date(y, m-1, d)`). NIE `new Date("YYYY-MM-DD")` — das wäre UTC
 *    und würde beim Tageswechsel das falsche Datum liefern.
 *  - Alle Queries sind strikt auf `organizationId` gescopt.
 */

import { Prisma, type Holiday } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------- Public Types ----------------------------------------------------

export type CreateHolidayInput = {
  date: string; // "YYYY-MM-DD"
  name: string;
};

export type UpdateHolidayInput = {
  name?: string;
  date?: string; // "YYYY-MM-DD"
};

// ---------- Date-Helper -----------------------------------------------------

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parst "YYYY-MM-DD" als lokale Mitternacht (nicht UTC).
 * Wirft bei ungültigem Format.
 */
function parseDateKey(key: string): Date {
  if (!DATE_KEY_RE.test(key)) {
    throw new Error(`Ungültiges Datumsformat (erwartet YYYY-MM-DD): ${key}`);
  }
  const [y, m, d] = key.split("-").map((n) => Number(n));
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    throw new Error(`Ungültiges Datum: ${key}`);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Formatiert ein Date als "YYYY-MM-DD" in LOKALER Zeit. */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- CRUD ------------------------------------------------------------

/**
 * Alle Feiertage einer Organisation, sortiert nach Datum aufsteigend.
 */
export async function listHolidays(organizationId: string): Promise<Holiday[]> {
  return prisma.holiday.findMany({
    where: { organizationId },
    orderBy: { date: "asc" },
  });
}

/**
 * Einen neuen Feiertag anlegen. Wirft einen sprechenden Fehler, wenn das
 * Datum bereits existiert (Unique-Constraint [organizationId, date]).
 */
export async function createHoliday(
  organizationId: string,
  input: CreateHolidayInput,
): Promise<Holiday> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error("Name darf nicht leer sein");
  }
  const date = parseDateKey(input.date);

  try {
    return await prisma.holiday.create({
      data: {
        organizationId,
        date,
        name,
        isSample: false,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("Feiertag existiert bereits an diesem Datum");
    }
    throw err;
  }
}

/**
 * Feiertag aktualisieren (Name und/oder Datum). `organizationId`-gescopt —
 * gibt `null` zurück, wenn der Feiertag nicht (in dieser Organisation)
 * gefunden wurde.
 */
export async function updateHoliday(
  organizationId: string,
  holidayId: string,
  input: UpdateHolidayInput,
): Promise<Holiday | null> {
  const existing = await prisma.holiday.findFirst({
    where: { id: holidayId, organizationId },
  });
  if (!existing) return null;

  const data: Prisma.HolidayUpdateInput = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Name darf nicht leer sein");
    }
    data.name = trimmed;
  }
  if (input.date !== undefined) {
    data.date = parseDateKey(input.date);
  }

  try {
    return await prisma.holiday.update({
      where: { id: holidayId },
      data,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("Feiertag existiert bereits an diesem Datum");
    }
    throw err;
  }
}

/**
 * Feiertag löschen. Gibt `true` zurück, wenn gelöscht wurde, sonst `false`
 * (z. B. weil der Feiertag nicht zur Organisation gehört).
 */
export async function deleteHoliday(
  organizationId: string,
  holidayId: string,
): Promise<boolean> {
  const result = await prisma.holiday.deleteMany({
    where: { id: holidayId, organizationId },
  });
  return result.count > 0;
}

// ---------- Bulk / Helper ---------------------------------------------------

/**
 * Massen-Import (z. B. für Muster-Feiertage). Duplikate (gleiche
 * `[organizationId, date]`-Kombi) werden per `skipDuplicates` übersprungen.
 * Gibt die Anzahl NEU angelegter Feiertage zurück.
 */
export async function bulkImportHolidays(
  organizationId: string,
  holidays: Array<{ date: string; name: string }>,
  markAsSample: boolean = false,
): Promise<number> {
  if (holidays.length === 0) return 0;

  const data = holidays.map((h) => {
    const name = h.name?.trim();
    if (!name) {
      throw new Error("Name darf nicht leer sein");
    }
    return {
      organizationId,
      date: parseDateKey(h.date),
      name,
      isSample: markAsSample,
    };
  });

  const result = await prisma.holiday.createMany({
    data,
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Lädt alle Feiertage einer Organisation als Set<"YYYY-MM-DD">.
 * Format passt zum Workday-Rechner (`lib/terminplan/workdays.ts`).
 */
export async function buildHolidaySetForOrg(
  organizationId: string,
): Promise<Set<string>> {
  const rows = await prisma.holiday.findMany({
    where: { organizationId },
    select: { date: true },
  });
  return new Set(rows.map((r) => toDateKey(r.date)));
}
