"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Loader2,
  Users2,
  Briefcase,
  CalendarCheck,
  FlaskConical,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemeMode } from "@/lib/theme";

type ThemeOption = {
  key: ThemeMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const THEME_OPTIONS: ThemeOption[] = [
  { key: "light", label: "Hell", description: "Heller Modus", icon: Sun },
  { key: "dark", label: "Dunkel", description: "Dunkler Modus", icon: Moon },
  { key: "system", label: "System", description: "Folgt OS-Einstellung", icon: Monitor },
];

type TileColor = "blue" | "amber" | "violet" | "fuchsia";

type Tile = {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: TileColor;
};

const TILES: Tile[] = [
  {
    href: "/einstellungen/benutzer",
    title: "Benutzer",
    description: "Accounts, Rollen und Rechte verwalten",
    icon: Users2,
    color: "blue",
  },
  {
    href: "/einstellungen/gewerke",
    title: "Gewerke",
    description: "Kategorien und Farben für Tasks im Bauzeitenplan",
    icon: Briefcase,
    color: "amber",
  },
  {
    href: "/einstellungen/feiertage",
    title: "Feiertage",
    description: "Arbeitsfreie Tage und Sperrzeiten",
    icon: CalendarCheck,
    color: "violet",
  },
  {
    href: "/einstellungen/muster",
    title: "Musterdaten",
    description: "Beispielprojekte und Seed-Daten",
    icon: FlaskConical,
    color: "fuchsia",
  },
];

const TILE_COLOR_CLASSES: Record<TileColor, { bg: string; text: string; ring: string }> = {
  blue: { bg: "bg-blue-100", text: "text-blue-600", ring: "group-hover:ring-blue-200" },
  amber: { bg: "bg-amber-100", text: "text-amber-600", ring: "group-hover:ring-amber-200" },
  violet: { bg: "bg-violet-100", text: "text-violet-600", ring: "group-hover:ring-violet-200" },
  fuchsia: { bg: "bg-fuchsia-100", text: "text-fuchsia-600", ring: "group-hover:ring-fuchsia-200" },
};

export default function EinstellungenOverviewPage() {
  const { mode, setMode } = useTheme();
  const [saving, setSaving] = useState<ThemeMode | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSelect(next: ThemeMode) {
    if (next === mode) return;
    setSaving(next);
    try {
      await setMode(next);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Einstellungen</h1>
          <p className="text-sm text-gray-500">
            Theme, Gewerke, Feiertage, Benutzer, Musterdaten
          </p>
        </div>
      </div>

      {/* Darstellung-Karte */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Darstellung</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Wähle das Erscheinungsbild der App. „System" folgt deiner Betriebssystem-Einstellung automatisch.
            </p>
          </div>
          <div
            className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1 gap-0.5"
            role="radiogroup"
            aria-label="Theme-Modus"
          >
            {THEME_OPTIONS.map(({ key, label, icon: Icon }) => {
              const active = mounted && mode === key;
              const isSaving = saving === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(key)}
                  disabled={!!saving}
                  role="radio"
                  aria-checked={active}
                  title={label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  } disabled:opacity-60`}
                >
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Icon size={14} />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kacheln-Grid */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Bereiche</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            const c = TILE_COLOR_CLASSES[tile.color];
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div
                  className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3 ring-2 ring-transparent ${c.ring} transition`}
                >
                  <Icon className={`w-5 h-5 ${c.text}`} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{tile.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{tile.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
