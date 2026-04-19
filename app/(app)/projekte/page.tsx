"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
  ArrowRight,
  Building2,
  Calendar,
  User,
  Hash,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// Benutzer aus /api/einstellungen/benutzer — Felder, die wir fürs Dropdown brauchen.
interface AvailableUser {
  id: string;
  name: string | null;
  email: string;
  kuerzel: string | null;
}

// ----- Types -----

interface ProjectManager {
  id: string;
  name: string | null;
  email: string;
  kuerzel: string | null;
}

interface Project {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  manager: ProjectManager;
}

type ViewMode = "grid" | "list";
type StatusFilter = "active" | "inactive" | "all";
type ScopeFilter = "mine" | "all";
type ProjectType = "PV" | "FFA" | "BESS";

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "PV", label: "PV (Dach-PV)" },
  { value: "FFA", label: "FFA (Freiflächenanlage)" },
  { value: "BESS", label: "BESS (Batteriespeicher)" },
];

// Parst eine Projektnummer im Format BV_NNNN-TYPE_Name.
// Gibt die numerische NNNN als number zurück, oder null wenn das
// Format nicht passt.
function parseProjectNumber(pn: string): number | null {
  const m = pn.match(/^BV_(\d{4})-(PV|FFA|BESS)_.+$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  return n;
}

interface StatusConfig {
  label: string;
  bg: string;
  text: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  PLANNING: { label: "Planung", bg: "bg-blue-100", text: "text-blue-700" },
  ACTIVE: { label: "Aktiv", bg: "bg-emerald-100", text: "text-emerald-700" },
  ON_HOLD: { label: "Pausiert", bg: "bg-amber-100", text: "text-amber-700" },
  COMPLETED: { label: "Abgeschlossen", bg: "bg-gray-100", text: "text-gray-600" },
  ARCHIVED: { label: "Archiviert", bg: "bg-gray-100", text: "text-gray-500" },
};

const ACTIVE_STATUSES = new Set<string>(["PLANNING", "ACTIVE", "ON_HOLD"]);
const INACTIVE_STATUSES = new Set<string>(["COMPLETED", "ARCHIVED"]);

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Aktive" },
  { value: "inactive", label: "Inaktive" },
  { value: "all", label: "Alle" },
];

const VIEW_STORAGE_KEY = "apos.projekte.view";

// Deterministische Avatar-Farbpalette (Tailwind, voll aufgelistet
// damit Tailwind die Klassen im Build nicht verwirft).
const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-lime-100", text: "text-lime-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
];

// ----- Helpers -----

function formatDate(d: string | null): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function initialsFromName(name: string | null | undefined, kuerzel?: string | null): string {
  if (kuerzel && kuerzel.trim()) {
    return kuerzel.trim().slice(0, 2).toUpperCase();
  }
  const source = (name || "").trim();
  if (!source) return "??";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function colorFromId(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function managerDisplayName(m: ProjectManager): string {
  return (m.name && m.name.trim()) || m.email;
}

// ----- Main Component -----

export default function ProjektePage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);

  // View & Filters
  const [view, setView] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("mine");
  const [managerFilter, setManagerFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    managerId: "",
    clientName: "",
    startDate: "",
    endDate: "",
    description: "",
    visibility: "OPEN" as "OPEN" | "RESTRICTED",
    allowEditByOthers: false,
  });

  // Strukturierte Projektnummer
  const [projectNumberDigits, setProjectNumberDigits] = useState<string>("");
  const [projectType, setProjectType] = useState<ProjectType>("FFA");

  // View aus localStorage laden (clientseitig, damit SSR nicht bricht)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "list") {
        setView(saved);
      }
    } catch {
      // localStorage nicht verfügbar — Default bleibt "grid"
    }
  }, []);

  const changeView = useCallback((next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const url = scopeFilter === "mine" ? "/api/projekte?scope=mine" : "/api/projekte";
      const res = await fetch(url);
      if (res.ok) {
        setProjects(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Validierungs-Helpers für die strukturierte Projektnummer
  const digitsValid = /^\d{1,4}$/.test(projectNumberDigits);
  const nameValid = formData.name.trim().length > 0;
  const managerValid = formData.managerId.trim().length > 0;
  const composedProjectNumber = digitsValid && nameValid
    ? `BV_${projectNumberDigits.padStart(4, "0")}-${projectType}_${formData.name.trim()}`
    : "";

  // Nächste freie Nummer aus vorhandenen Projekten ableiten.
  const nextSuggestedNumber = useMemo<string>(() => {
    let max = 0;
    for (const p of projects) {
      const n = parseProjectNumber(p.projectNumber);
      if (n !== null && n > max) max = n;
    }
    return String(max + 1).padStart(4, "0");
  }, [projects]);

  // Beim Öffnen des Modals nextSuggestedNumber vorschlagen.
  useEffect(() => {
    if (showForm && projectNumberDigits === "") {
      setProjectNumberDigits(nextSuggestedNumber);
    }
  }, [showForm, nextSuggestedNumber, projectNumberDigits]);

  // Benutzerliste fürs Projektleiter-Dropdown beim ersten Öffnen des Modals laden.
  useEffect(() => {
    if (!showForm) return;
    if (availableUsers.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/einstellungen/benutzer");
        if (!res.ok) return;
        const users = (await res.json()) as AvailableUser[];
        if (!cancelled) setAvailableUsers(users);
      } catch {
        // Stiller Fehler — der User merkt es am leeren Dropdown.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showForm, availableUsers.length]);

  function resetForm() {
    setFormData({
      name: "",
      managerId: "",
      clientName: "",
      startDate: "",
      endDate: "",
      description: "",
      visibility: "OPEN",
      allowEditByOthers: false,
    });
    setProjectNumberDigits("");
    setProjectType("FFA");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid || !digitsValid || !managerValid) return;

    const projectNumber = `BV_${projectNumberDigits.padStart(4, "0")}-${projectType}_${formData.name.trim()}`;

    setSaving(true);
    try {
      const res = await fetch("/api/projekte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          projectNumber,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        resetForm();
        fetchProjects();
        toast({
          title: "Projekt angelegt",
          description: projectNumber,
          variant: "success",
        });
      } else {
        // Fehler-Response vom Server lesen und als Toast anzeigen.
        const body: unknown = await res.json().catch(() => ({}));
        const msg =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : `Fehler ${res.status}`;
        toast({
          title: "Anlegen fehlgeschlagen",
          description: msg,
          variant: "error",
        });
      }
    } catch (err) {
      toast({
        title: "Netzwerkfehler",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  // Unique Manager-Liste für Dropdown
  const managers = useMemo<ProjectManager[]>(() => {
    const byId = new Map<string, ProjectManager>();
    for (const p of projects) {
      if (p.manager && !byId.has(p.manager.id)) {
        byId.set(p.manager.id, p.manager);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      managerDisplayName(a).localeCompare(managerDisplayName(b), "de"),
    );
  }, [projects]);

  // Gefilterte Projekte
  const filteredProjects = useMemo<Project[]>(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      // Status
      if (statusFilter === "active" && !ACTIVE_STATUSES.has(p.status)) return false;
      if (statusFilter === "inactive" && !INACTIVE_STATUSES.has(p.status)) return false;

      // Manager
      if (managerFilter !== "ALL" && p.manager?.id !== managerFilter) return false;

      // Suche
      if (q.length > 0) {
        const name = p.name.toLowerCase();
        const num = p.projectNumber.toLowerCase();
        if (!name.includes(q) && !num.includes(q)) return false;
      }

      return true;
    });
  }, [projects, statusFilter, managerFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Projekte</h1>
            <p className="text-sm text-gray-500">
              {filteredProjects.length} von {projects.length}{" "}
              {projects.length === 1 ? "Projekt" : "Projekten"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View-Switch */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => changeView("grid")}
              title="Kachel-Ansicht"
              aria-label="Kachel-Ansicht"
              className={`p-1.5 rounded-md transition-colors ${
                view === "grid"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView("list")}
              title="Listen-Ansicht"
              aria-label="Listen-Ansicht"
              className={`p-1.5 rounded-md transition-colors ${
                view === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Neues Projekt */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neues Projekt
          </button>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Scope-Toggle: Meine / Alle Projekte */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setScopeFilter("mine")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              scopeFilter === "mine"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Meine Projekte
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              scopeFilter === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Alle Projekte
          </button>
        </div>

        {/* Status-Toggle */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {STATUS_FILTER_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setStatusFilter(o.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === o.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Manager-Filter */}
        <div className="relative">
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">Alle Verantwortlichen</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {managerDisplayName(m)}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Suchfeld */}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name oder Projektnummer..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-56"
          />
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Neues Projekt anlegen</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Nummerformat: BV_NNNN-TYPE_Name
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projektname *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                    !nameValid && formData.name.length > 0
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                  placeholder="z.B. Solarpark Wiesau"
                  required
                />
              </div>

              {/* Strukturierte Projektnummer: Nummer + Typ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projektnummer *
                </label>
                <div className="grid grid-cols-[1fr_2fr] gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={projectNumberDigits}
                    onChange={(e) => {
                      const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setProjectNumberDigits(onlyDigits);
                    }}
                    onBlur={() => {
                      if (projectNumberDigits.length > 0 && projectNumberDigits.length < 4) {
                        setProjectNumberDigits(projectNumberDigits.padStart(4, "0"));
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                      !digitsValid && projectNumberDigits.length > 0
                        ? "border-red-400"
                        : projectNumberDigits.length === 0
                          ? "border-red-400"
                          : "border-gray-300"
                    }`}
                    placeholder="0210"
                    required
                  />
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value as ProjectType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer"
                  >
                    {PROJECT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 font-mono">
                  Projektnummer:{" "}
                  <span className="text-gray-700">
                    {composedProjectNumber || "BV_XXXX-TYPE_Name"}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auftraggeber
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, clientName: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Firma / Person"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projektleiter *
                </label>
                <div className="relative">
                  <select
                    value={formData.managerId}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, managerId: e.target.value }))
                    }
                    className={`appearance-none w-full pl-3 pr-8 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer ${
                      !managerValid ? "border-red-400" : "border-gray-300"
                    }`}
                    required
                  >
                    <option value="">— Bitte wählen —</option>
                    {availableUsers.map((u) => {
                      const label = u.name
                        ? u.kuerzel
                          ? `${u.name} (${u.kuerzel})`
                          : u.name
                        : u.email;
                      return (
                        <option key={u.id} value={u.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {availableUsers.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Benutzerliste wird geladen…
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enddatum
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  rows={3}
                  placeholder="Kurzbeschreibung des Projekts..."
                />
              </div>

              {/* Sichtbarkeit für andere Projektleiter */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <div className="text-sm font-medium text-gray-700 mb-1">
                  Sichtbarkeit für andere Projektleiter
                </div>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.visibility === "OPEN"}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        visibility: e.target.checked ? "OPEN" : "RESTRICTED",
                        // Wenn nicht mehr sichtbar, kann auch nicht bearbeitet werden
                        allowEditByOthers: e.target.checked ? f.allowEditByOthers : false,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-sm text-gray-700">
                      Andere Projektleiter können das Projekt sehen
                    </div>
                    <div className="text-xs text-gray-500">
                      Admins und Mitglieder sehen das Projekt unabhängig hiervon.
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-2 select-none ${
                    formData.visibility === "OPEN"
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.allowEditByOthers}
                    disabled={formData.visibility !== "OPEN"}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        allowEditByOthers: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  <div>
                    <div className="text-sm text-gray-700">
                      Andere Projektleiter können das Projekt bearbeiten
                    </div>
                    <div className="text-xs text-gray-500">
                      Standardmäßig: sehen ja, bearbeiten nein.
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving || !nameValid || !digitsValid || !managerValid}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Projekt anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Projekte</h2>
          <p className="text-sm text-gray-500 mb-4">
            Erstellen Sie Ihr erstes Bauprojekt, um loszulegen.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Neues Projekt anlegen
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3 opacity-60" />
          <h2 className="text-base font-semibold text-gray-700 mb-1">Keine Treffer</h2>
          <p className="text-sm text-gray-500">
            Passe die Filter oder die Suche an, um Projekte zu sehen.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => (
            <ProjectGridCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-4 py-3">Nummer</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verantwortlicher</th>
                  <th className="px-4 py-3">Auftraggeber</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Ende</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => (
                  <ProjectListRow key={p.id} project={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Sub-Components -----

function ProjectGridCard({ project }: { project: Project }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
  return (
    <Link
      href={`/projekte/${project.id}`}
      className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
            {project.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
            <Hash className="w-3 h-3" />
            {project.projectNumber}
          </div>
        </div>
        <span
          className={`shrink-0 ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </div>

      {project.clientName && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <Building2 className="w-3 h-3" />
          {project.clientName}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <User className="w-3 h-3" />
        {managerDisplayName(project.manager)}
      </div>

      {(project.startDate || project.endDate) && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          {formatDate(project.startDate)} — {formatDate(project.endDate)}
        </div>
      )}
    </Link>
  );
}

function ProjectListRow({ project }: { project: Project }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;
  const avatarColor = colorFromId(project.manager.id);
  const initials = initialsFromName(project.manager.name, project.manager.kuerzel);

  return (
    <tr
      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group"
      onClick={(e) => {
        const link = e.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
        if (link) link.click();
      }}
    >
      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
        {project.projectNumber}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/projekte/${project.id}`}
          data-row-link
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-gray-900 hover:text-emerald-700 transition-colors"
        >
          {project.name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold ${avatarColor.bg} ${avatarColor.text}`}
            title={managerDisplayName(project.manager)}
          >
            {initials}
          </span>
          <span className="text-sm text-gray-700 truncate">
            {managerDisplayName(project.manager)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {project.clientName || <span className="text-gray-400">–</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {formatDate(project.startDate)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {formatDate(project.endDate)}
      </td>
      <td className="px-4 py-3 text-gray-400 group-hover:text-gray-600 transition-colors">
        <ArrowRight className="w-4 h-4" />
      </td>
    </tr>
  );
}
