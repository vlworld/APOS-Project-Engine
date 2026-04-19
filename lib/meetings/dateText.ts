// Normalisierung von Freitext-Terminen, die in Protokoll-Punkten
// (MeetingItem.dueDateText) stehen. Ziel: einheitliche Schreibweise, damit
// ToDos / Transfers / Vergleiche spaeter maschinenlesbar sind.
//
// Aktuelle Regeln (can be extended):
//   - "KW08" / "KW 8" / "KW8" / "kw.08" / "Kw 8/26" / "KW 8 2026"
//     → "KW8"    (ohne Jahr)
//     → "KW8/26" (mit 2-stelligem Jahr, falls angegeben)
//   - "Q1/23" / "Q1 2023" / "q1.23" / "Q 1 / 23"
//     → "Q1/23"
//
// Alles, was keinem Pattern entspricht, wird unveraendert zurueckgegeben
// (inkl. Trim). So bleiben Freitexte wie "Ende Juli", "Nach Urlaub" erhalten.

const KW_PATTERN =
  /\bK\s*W\s*\.?\s*0?(\d{1,2})(?:\s*[/.\s-]\s*(\d{2}|\d{4}))?\b/i;

const QUARTER_PATTERN =
  /\bQ\s*([1-4])(?:\s*[/.\s-]\s*(\d{2}|\d{4}))?\b/i;

function twoDigitYear(raw: string): string {
  // "2026" → "26", "26" bleibt "26"
  return raw.length === 4 ? raw.slice(-2) : raw;
}

export function normalizeDueDateText(
  input: string | null | undefined,
): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // KW-Pattern zuerst — spezifischer als Quartal wegen "Q"/"K"
  const kw = trimmed.match(KW_PATTERN);
  if (kw) {
    const week = Number.parseInt(kw[1] ?? "", 10);
    if (!Number.isNaN(week) && week >= 1 && week <= 53) {
      const year = kw[2] ? twoDigitYear(kw[2]) : null;
      return year ? `KW${week}/${year}` : `KW${week}`;
    }
  }

  // Quartal
  const q = trimmed.match(QUARTER_PATTERN);
  if (q) {
    const quarter = Number.parseInt(q[1] ?? "", 10);
    if (!Number.isNaN(quarter) && quarter >= 1 && quarter <= 4) {
      const year = q[2] ? twoDigitYear(q[2]) : null;
      return year ? `Q${quarter}/${year}` : `Q${quarter}`;
    }
  }

  // Nichts erkannt — Original trimmed zurueckgeben
  return trimmed;
}

// Convenience: entscheidet, ob ein String ein KW-Token ist (fuer spaeteren
// Transfer in Arbeitspaket-Wochen etc.).
export function parseKalenderwoche(
  text: string,
): { week: number; year: number | null } | null {
  const kw = text.match(KW_PATTERN);
  if (!kw) return null;
  const week = Number.parseInt(kw[1] ?? "", 10);
  if (Number.isNaN(week) || week < 1 || week > 53) return null;
  const rawYear = kw[2];
  if (!rawYear) return { week, year: null };
  const y = Number.parseInt(rawYear, 10);
  if (Number.isNaN(y)) return { week, year: null };
  const fullYear = rawYear.length === 2 ? 2000 + y : y;
  return { week, year: fullYear };
}
