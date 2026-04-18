// Tailwind JIT-Safelist: erzwingt die Generierung aller Gewerk-Farben.
//
// Weil Tailwind dynamische Klassen wie `bg-${color}-500` nicht statisch
// erkennen kann, rendern wir hier unsichtbare Spans mit der vollständigen
// Klassen-Matrix. Diese Komponente wird einmal irgendwo im DOM platziert
// (z.B. in <GanttChart>), damit Tailwind die Klassen im Build behält.

export const TERMINPLAN_COLORS = [
  "slate",
  "gray",
  "zinc",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

export type TerminplanColor = (typeof TERMINPLAN_COLORS)[number];

export function isKnownColor(color: string): color is TerminplanColor {
  return (TERMINPLAN_COLORS as readonly string[]).includes(color);
}

export function safeColor(color: string | null | undefined): TerminplanColor {
  if (color && isKnownColor(color)) return color;
  return "blue";
}

/**
 * Renderless-Keep-Alive für Tailwind-Klassen. In einen sr-only Wrapper legen.
 */
export default function TailwindColorSafelist() {
  return (
    <div className="sr-only" aria-hidden>
      {TERMINPLAN_COLORS.map((c) => (
        <span
          key={c}
          className={[
            // Backgrounds
            `bg-${c}-50`,
            `bg-${c}-100`,
            `bg-${c}-200`,
            `bg-${c}-400`,
            `bg-${c}-500`,
            `bg-${c}-600`,
            `bg-${c}-700`,
            // Text
            `text-${c}-500`,
            `text-${c}-600`,
            `text-${c}-700`,
            // Borders / Ring
            `border-${c}-200`,
            `border-${c}-300`,
            `border-${c}-500`,
            `ring-${c}-200`,
            `ring-${c}-300`,
          ].join(" ")}
        />
      ))}
    </div>
  );
}
