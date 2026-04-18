"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ThemeMode } from "@/lib/theme";
import { THEME_COOKIE, THEME_STORAGE_KEY, isThemeMode, resolveTheme } from "@/lib/theme";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (next: ThemeMode) => Promise<void>;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeCookie(value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const fromHtml = document.documentElement.dataset.themeMode;
  if (fromHtml && isThemeMode(fromHtml)) return fromHtml;
  try {
    const ls = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (ls && isThemeMode(ls)) return ls;
  } catch { /* ignore */ }
  return "light";
}

function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyResolved(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readInitialMode());
  const [resolved, setResolved] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  const [loading, setLoading] = useState(false);

  // System-Mode: react to OS changes
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handler() {
      const r = resolveTheme("system", mq.matches);
      applyResolved(r);
      setResolved(r);
    }
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [mode]);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    const r = resolveTheme(next, prefersDark());
    applyResolved(r);
    setResolved(r);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* noop */ }
    writeCookie(next);
    // TODO(apos): Persist preference to DB via API once user preferences endpoint is built
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: "light",
      resolved: "light",
      loading: false,
      setMode: async () => { /* no-op */ },
    };
  }
  return ctx;
}
