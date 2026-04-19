"use client";

// Kleines Info-Icon mit Hover/Click-Popover.
// - Hover öffnet den Popover kurz (wie ein Tooltip).
// - Klick öffnet ihn "sticky" — Popover bleibt sichtbar bis zum nächsten
//   Klick auf das Icon, Klick außerhalb oder Escape.
// - Popover hat abgerundete Kachel-Optik, passt zum APOS-UI-Design.

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

interface InfoPopoverProps {
  /** Der Info-Text. Kann auch mehrere Absätze enthalten. */
  children: React.ReactNode;
  /** Position relativ zum Icon. Default: "bottom". */
  placement?: "top" | "bottom" | "right";
  /** Optionaler aria-label (Fallback: "Info"). */
  label?: string;
}

export default function InfoPopover({
  children,
  placement = "bottom",
  label = "Info",
}: InfoPopoverProps) {
  // stickyOpen = nach Klick (bleibt offen), hoverOpen = nach Mouseover (temporär)
  const [stickyOpen, setStickyOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  const open = stickyOpen || hoverOpen;

  // Klick außerhalb + Escape schließen den sticky-Modus
  useEffect(() => {
    if (!stickyOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setStickyOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setStickyOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [stickyOpen]);

  // Positionierungs-Klassen für den Popover
  const popoverPositionClass =
    placement === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : placement === "right"
        ? "left-full top-1/2 -translate-y-1/2 ml-2"
        : "top-full left-1/2 -translate-x-1/2 mt-2";

  return (
    <span ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setStickyOpen((v) => !v)}
        onMouseEnter={() => setHoverOpen(true)}
        onMouseLeave={() => setHoverOpen(false)}
        aria-label={label}
        aria-expanded={open}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
          open
            ? "text-emerald-600 bg-emerald-50"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute z-40 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-gray-700 leading-relaxed ${popoverPositionClass}`}
          style={{ pointerEvents: stickyOpen ? "auto" : "none" }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
