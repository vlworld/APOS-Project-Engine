"use client";

// Diskreter Rückgängig-Button gemäß UX-Design-Regeln §1.
// Erscheint nach einer Aktion, läuft nach ttlMs ab (default 8000 ms),
// reagiert zusätzlich auf Cmd/Ctrl+Z, solange sichtbar.

import { useEffect, useRef } from "react";
import { Undo2 } from "lucide-react";

interface UndoButtonProps {
  visible: boolean;
  onUndo: () => void | Promise<void>;
  onExpire: () => void;
  label?: string;
  ttlMs?: number;
}

export default function UndoButton({
  visible,
  onUndo,
  onExpire,
  label = "Rückgängig machen",
  ttlMs = 8000,
}: UndoButtonProps) {
  const expireRef = useRef(onExpire);
  const undoRef = useRef(onUndo);

  // Refs aktuell halten, damit Timer/Listener immer die neueste Funktion rufen.
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    undoRef.current = onUndo;
  }, [onUndo]);

  // Auto-Expire nach ttlMs
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => {
      expireRef.current();
    }, ttlMs);
    return () => window.clearTimeout(id);
  }, [visible, ttlMs]);

  // Cmd/Ctrl+Z triggert Undo, solange sichtbar.
  useEffect(() => {
    if (!visible) return;

    function onKeyDown(e: KeyboardEvent) {
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z";
      if (!isUndo) return;
      e.preventDefault();
      void undoRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => void onUndo()}
      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
    >
      <Undo2 className="w-4 h-4" />
      {label}
    </button>
  );
}
