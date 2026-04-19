"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { FolderKanban, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import LightOnly from "@/components/theme/LightOnly";

// Dev-only: Wenn NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL *und* _PASSWORD gesetzt
// sind, meldet sich die Seite automatisch an und springt direkt aufs
// Dashboard — ohne Form anzuzeigen. In Production wird dieser Pfad nie
// betreten, da process.env.NODE_ENV !== "development" ist.
// Skip mit `?skip-autologin=1` in der URL, falls man doch mal manuell
// einloggen möchte (z.B. als anderer User).
const DEV_AUTO_LOGIN_ENABLED =
  process.env.NODE_ENV === "development" &&
  Boolean(process.env.NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL) &&
  Boolean(process.env.NEXT_PUBLIC_DEFAULT_LOGIN_PASSWORD);

export default function LoginPage() {
  const [email, setEmail] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL ?? "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Initial true, wenn Auto-Login greift — dann zeigen wir statt des
  // Formulars einen Spinner, bis der signIn-Call durch ist.
  const [autoLogging, setAutoLogging] = useState<boolean>(() => {
    if (!DEV_AUTO_LOGIN_ENABLED) return false;
    if (typeof window === "undefined") return false;
    const skip = new URLSearchParams(window.location.search).get(
      "skip-autologin",
    );
    return skip !== "1";
  });

  useEffect(() => {
    const saved = localStorage.getItem("apos_remembered_email");
    if (saved) setEmail(saved);
  }, []);

  // Auto-Login nur im Dev-Modus und nur wenn Credentials in .env.local.
  useEffect(() => {
    if (!autoLogging) return;
    const autoEmail = process.env.NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL;
    const autoPassword = process.env.NEXT_PUBLIC_DEFAULT_LOGIN_PASSWORD;
    if (!autoEmail || !autoPassword) {
      setAutoLogging(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await signIn("credentials", {
          email: autoEmail.trim(),
          password: autoPassword,
          redirect: false,
        });
        if (cancelled) return;
        if (res?.error) {
          setError(
            "Automatische Anmeldung fehlgeschlagen. Bitte manuell einloggen.",
          );
          setAutoLogging(false);
          return;
        }
        window.location.href = "/dashboard";
      } catch {
        if (cancelled) return;
        setError(
          "Automatische Anmeldung fehlgeschlagen. Bitte manuell einloggen.",
        );
        setAutoLogging(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoLogging]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (rememberMe) localStorage.setItem("apos_remembered_email", email);
    else localStorage.removeItem("apos_remembered_email");

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("E-Mail oder Passwort ist falsch, oder Sie haben keinen Zugriff auf dieses System.");
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  // Während Auto-Login läuft: nur Logo + Spinner + Hinweis zeigen.
  // Keine Eingabemaske, damit der User nichts ausfüllt was sowieso gleich
  // weggeht.
  if (autoLogging) {
    return (
      <LightOnly className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Anmeldung läuft…</span>
          </div>
          <a
            href="?skip-autologin=1"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Manuell anmelden
          </a>
        </div>
      </LightOnly>
    );
  }

  return (
    <LightOnly className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Anmelden</h1>
          <p className="text-sm text-gray-500 mb-5">APOS · Apricus Project OS · ProjectEngine</p>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-600">Angemeldet bleiben</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Anmelden
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <a
            href={process.env.NEXT_PUBLIC_OOS_URL || "https://oos.up.railway.app/"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-600 inline-flex items-center gap-1"
          >
            Zum OOS wechseln <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </LightOnly>
  );
}
