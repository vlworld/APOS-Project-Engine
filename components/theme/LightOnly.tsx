/**
 * LightOnly
 *
 * Erzwingt für einen Teilbaum den hellen Modus — auch wenn global Dark Mode
 * aktiv ist. Wird für Surfaces genutzt, die laut Produkt-Regel immer hell
 * bleiben (Login, Register, Onboarding-Rundgang, Extern-Portal).
 * Der Mechanismus: ein `light`-Klassen-Ancestor übersteuert die `.dark &`-
 * Variante aus globals.css via `:not(:where(.light, .light *))`.
 */
export default function LightOnly({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "main" | "section";
}) {
  return <As className={`light ${className}`}>{children}</As>;
}
