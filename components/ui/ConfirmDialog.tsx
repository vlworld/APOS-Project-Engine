"use client";

// Wiederverwendbarer Bestätigungsdialog gemäß UX-Design-Regeln §3, §4 und §7.
// Ersetzt window.confirm() und Browser-native Dialoge vollständig.
// Escape schließt, Klick außerhalb schließt, Enter bestätigt.

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  destructive = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Keyboard-Handling: Escape schließt, Enter bestätigt.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!loading) onCancel();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!loading) {
          void onConfirm();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel, onConfirm]);

  // Body-Scroll sperren, solange der Dialog offen ist.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Initial-Fokus auf den Confirm-Button, damit Enter direkt greift.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const confirmClasses = destructive
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "bg-emerald-600 hover:bg-emerald-700 text-white";

  function handleOverlayClick() {
    if (loading) return;
    onCancel();
  }

  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={handleCardClick}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 mb-6">{description}</p>
        )}
        {!description && <div className="mb-6" />}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => {
              if (!loading) void onConfirm();
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${confirmClasses}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
