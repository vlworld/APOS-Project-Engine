/**
 * Theme-Helfer (Light / Dark / System)
 *
 * Portiert 1:1 von OOS (apps/oos/lib/theme.ts).
 * Schlüssel wurden auf "apos-theme" umbenannt, damit OOS und APOS
 * nicht denselben Cookie/LocalStorage-Key überschreiben.
 */

export type ThemeMode = "light" | "dark" | "system";
export const THEME_COOKIE = "apos-theme";
export const THEME_STORAGE_KEY = "apos-theme";

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

export function resolveTheme(mode: ThemeMode, prefersDark = false): "light" | "dark" {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var stored = null;
    try { stored = window.localStorage.getItem("${THEME_STORAGE_KEY}"); } catch (e) {}
    if (!stored) {
      var m = document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);
      if (m) stored = decodeURIComponent(m[1]);
    }
    var mode = (stored === "light" || stored === "dark" || stored === "system") ? stored : "light";
    var isDark = mode === "dark" || (mode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var html = document.documentElement;
    html.classList.toggle("dark", !!isDark);
    html.dataset.themeMode = mode;
  } catch (e) { /* no-op */ }
})();
`;
