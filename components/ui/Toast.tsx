"use client";

// Toast-System gemäß UX-Design-Regeln §10.
// Provider stellt Context bereit; Komponenten nutzen useToast().
// Position unten rechts, dunkler Hintergrund, Auto-Dismiss mit Hover-Pause.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastOptions, "title">> {
  id: string;
  description?: string;
  variant: ToastVariant;
  durationMs: number;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast muss innerhalb von <ToastProvider> verwendet werden.");
  }
  return ctx;
}

const KEYFRAMES = `
@keyframes aposToastSlideIn {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes aposToastFadeOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(16px); }
}
`;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions): string => {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const durationMs = opts.durationMs ?? (opts.action ? 5000 : 3000);
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? "info",
      durationMs,
      action: opts.action,
    };
    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  // Escape schließt den obersten (= zuletzt hinzugefügten) Toast.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setToasts((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.slice(0, -1);
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss]
  );

  const portal =
    mounted && typeof document !== "undefined"
      ? createPortal(
          <>
            <style>{KEYFRAMES}</style>
            <div
              className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
              aria-live="polite"
              aria-atomic="false"
            >
              {toasts.map((t) => (
                <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
              ))}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {portal}
    </ToastContext.Provider>
  );
}

interface ToastProps {
  item: ToastItem;
  onDismiss: () => void;
}

export function Toast({ item, onDismiss }: ToastProps) {
  const { variant, title, description, durationMs, action } = item;
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef<number>(durationMs);
  const startRef = useRef<number>(Date.now());
  const [closing, setClosing] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (ms: number) => {
      clearTimer();
      startRef.current = Date.now();
      remainingRef.current = ms;
      timerRef.current = window.setTimeout(() => {
        setClosing(true);
        window.setTimeout(onDismiss, 180);
      }, ms);
    },
    [clearTimer, onDismiss]
  );

  useEffect(() => {
    startTimer(durationMs);
    return clearTimer;
  }, [durationMs, startTimer, clearTimer]);

  function handleMouseEnter() {
    if (timerRef.current !== null) {
      const elapsed = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      clearTimer();
    }
  }

  function handleMouseLeave() {
    if (remainingRef.current > 0 && !closing) {
      startTimer(remainingRef.current);
    }
  }

  const accentByVariant: Record<ToastVariant, string> = {
    success: "border-l-emerald-400",
    error: "border-l-red-400",
    info: "border-l-blue-400",
  };

  const IconByVariant: Record<ToastVariant, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  };

  const iconColor: Record<ToastVariant, string> = {
    success: "text-emerald-400",
    error: "text-red-400",
    info: "text-blue-400",
  };

  const Icon = IconByVariant[variant];

  const animation = closing
    ? "aposToastFadeOut 180ms ease-in forwards"
    : "aposToastSlideIn 200ms ease-out";

  return (
    <div
      role="status"
      className={`pointer-events-auto bg-gray-900 text-white rounded-xl shadow-lg px-4 py-3 text-sm min-w-[240px] max-w-[400px] flex items-start gap-3 border-l-[3px] ${accentByVariant[variant]}`}
      style={{ animation }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor[variant]}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium leading-snug break-words">{title}</div>
        {description && (
          <div className="text-gray-300 text-xs mt-0.5 leading-snug break-words">
            {description}
          </div>
        )}
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              setClosing(true);
              window.setTimeout(onDismiss, 180);
            }}
            className="mt-2 text-xs font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setClosing(true);
          window.setTimeout(onDismiss, 180);
        }}
        className="shrink-0 text-gray-400 hover:text-white transition-colors"
        aria-label="Schließen"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
