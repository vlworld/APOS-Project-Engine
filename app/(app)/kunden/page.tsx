"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  LayoutGrid,
  List,
  Plus,
  Search,
  ArrowRight,
  MapPin,
  Users,
  FolderKanban,
  Euro,
  Calendar,
  Loader2,
  X,
  ChevronDown,
  Star,
  User,
  Phone,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// ----- Types -----

type CustomerClassification =
  | "STANDARD"
  | "IMPORTANT"
  | "STRATEGIC"
  | "WATCH"
  | "BLOCKED";

interface CustomerContactDTO {
  id: string;
  firstName: string | null;
  lastName: string;
  salutation: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface CustomerDTO {
  id: string;
  companyName: string;
  legalForm: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  vatId: string | null;
  classification: CustomerClassification;
  notes: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  contacts: CustomerContactDTO[];
  projectCount: number;
  totalVolumeEur: number | null;
  firstProjectAt: string | null;
  lastProjectAt: string | null;
}

type ViewMode = "grid" | "list";
type ClassificationFilter = CustomerClassification | "ALL";

interface ClassificationConfig {
  label: string;
  bg: string;
  text: string;
  highlight: boolean;
}

const CLASSIFICATION_CONFIG: Record<CustomerClassification, ClassificationConfig> = {
  STANDARD: { label: "Standard", bg: "bg-gray-100", text: "text-gray-700", highlight: false },
  IMPORTANT: { label: "Wichtig", bg: "bg-amber-100", text: "text-amber-700", highlight: true },
  STRATEGIC: {
    label: "Strategisch",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    highlight: true,
  },
  WATCH: { label: "Beobachtung", bg: "bg-orange-100", text: "text-orange-700", highlight: false },
  BLOCKED: { label: "Gesperrt", bg: "bg-red-100", text: "text-red-700", highlight: false },
};

const CLASSIFICATION_FILTER_OPTIONS: { value: ClassificationFilter; label: string }[] = [
  { value: "ALL", label: "Alle Klassifizierungen" },
  { value: "STANDARD", label: "Standard" },
  { value: "IMPORTANT", label: "Wichtig" },
  { value: "STRATEGIC", label: "Strategisch" },
  { value: "WATCH", label: "Beobachtung" },
  { value: "BLOCKED", label: "Gesperrt" },
];

const CLASSIFICATION_FORM_OPTIONS: { value: CustomerClassification; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "IMPORTANT", label: "Wichtig" },
  { value: "STRATEGIC", label: "Strategisch" },
  { value: "WATCH", label: "Beobachtung" },
  { value: "BLOCKED", label: "Gesperrt" },
];

const VIEW_STORAGE_KEY = "apos.kunden.view";
const TAB_STORAGE_KEY = "apos.kunden.tab";

type TabKey = "firmen" | "kontakte";

function isTabKey(v: unknown): v is TabKey {
  return v === "firmen" || v === "kontakte";
}

// Deterministische Avatar-Farbpalette (Tailwind, voll aufgelistet
// damit JIT die Klassen im Build nicht verwirft).
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

function colorFromId(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function initialsFromName(contact: CustomerContactDTO): string {
  const first = (contact.firstName ?? "").trim();
  const last = (contact.lastName ?? "").trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (contact.salutation && contact.salutation.trim()) {
    return contact.salutation.trim().slice(0, 2).toUpperCase();
  }
  return "??";
}

function contactFullName(contact: CustomerContactDTO): string {
  const parts = [contact.salutation, contact.firstName, contact.lastName].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return parts.join(" ").trim() || contact.lastName;
}

// ----- Helpers -----

const CURRENCY_FMT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "–";
  return CURRENCY_FMT.format(value);
}

function formatDate(d: string | null): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ----- Main Component -----

interface FormState {
  companyName: string;
  legalForm: string;
  classification: CustomerClassification;
  street: string;
  zipCode: string;
  city: string;
  website: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  legalForm: "",
  classification: "STANDARD",
  street: "",
  zipCode: "",
  city: "",
  website: "",
  phone: "",
  email: "",
  notes: "",
};

export default function KundenPage() {
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>("grid");
  const [tab, setTab] = useState<TabKey>("firmen");
  const [classificationFilter, setClassificationFilter] =
    useState<ClassificationFilter>("ALL");
  const [search, setSearch] = useState<string>("");

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

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
    try {
      const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (isTabKey(savedTab)) {
        setTab(savedTab);
      }
    } catch {
      // localStorage nicht verfügbar — Default bleibt "firmen"
    }
  }, []);

  const changeTab = useCallback((next: TabKey) => {
    setTab(next);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      // ignore
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

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/kunden");
      if (res.ok) {
        setCustomers(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreate = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!formData.companyName.trim()) return;

      setSaving(true);
      try {
        const res = await fetch("/api/kunden", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: formData.companyName.trim(),
            legalForm: formData.legalForm.trim() || undefined,
            classification: formData.classification,
            street: formData.street.trim() || undefined,
            zipCode: formData.zipCode.trim() || undefined,
            city: formData.city.trim() || undefined,
            website: formData.website.trim() || undefined,
            phone: formData.phone.trim() || undefined,
            email: formData.email.trim() || undefined,
            notes: formData.notes.trim() || undefined,
          }),
        });
        if (res.ok) {
          setShowForm(false);
          setFormData(EMPTY_FORM);
          await fetchCustomers();
          toast({ title: "Kunde angelegt", variant: "success" });
        } else {
          const body = (await res.json().catch(() => ({ error: "Fehler" }))) as {
            error?: string;
          };
          toast({ title: body.error ?? "Fehler beim Anlegen", variant: "error" });
        }
      } finally {
        setSaving(false);
      }
    },
    [formData, fetchCustomers, toast],
  );

  // Keyboard: Escape schließt Modal, Ctrl/Cmd+S speichert
  useEffect(() => {
    if (!showForm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!saving) setShowForm(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) void handleCreate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm, saving, handleCreate]);

  // Gefilterte Kunden
  const filteredCustomers = useMemo<CustomerDTO[]>(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (classificationFilter !== "ALL" && c.classification !== classificationFilter) {
        return false;
      }
      if (q.length > 0) {
        const name = c.companyName.toLowerCase();
        const city = (c.city ?? "").toLowerCase();
        const contactMatch = c.contacts.some((k) =>
          k.lastName.toLowerCase().includes(q),
        );
        if (!name.includes(q) && !city.includes(q) && !contactMatch) return false;
      }
      return true;
    });
  }, [customers, classificationFilter, search]);

  const totalContacts = useMemo<number>(
    () => customers.reduce((sum, c) => sum + c.contacts.length, 0),
    [customers],
  );

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
          <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Kunden</h1>
            <p className="text-sm text-gray-500">
              {tab === "firmen" ? (
                <>
                  {filteredCustomers.length} von {customers.length}{" "}
                  {customers.length === 1 ? "Kunde" : "Kunden"}
                </>
              ) : (
                <>
                  {totalContacts} {totalContacts === 1 ? "Kontakt" : "Kontakte"}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View-Switch (nur im Firmen-Tab) */}
          {tab === "firmen" && (
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
          )}

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Kunde anlegen
          </button>
        </div>
      </div>

      {/* Tab-Switch: Firmen / Kontakte */}
      <div
        role="tablist"
        aria-label="Kunden-Ansicht"
        className="inline-flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "firmen"}
          onClick={() => changeTab("firmen")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === "firmen"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Firmen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "kontakte"}
          onClick={() => changeTab("kontakte")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === "kontakte"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Kontakte
        </button>
      </div>

      {/* Filter-Leiste (nur im Firmen-Tab) */}
      {tab === "firmen" && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative">
            <select
              value={classificationFilter}
              onChange={(e) =>
                setClassificationFilter(e.target.value as ClassificationFilter)
              }
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
            >
              {CLASSIFICATION_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative ml-auto">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Firma, Stadt oder Ansprechpartner..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-64"
            />
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!saving) setShowForm(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Neuen Kunden anlegen</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firmenname *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, companyName: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="z.B. Muster GmbH"
                  autoFocus
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rechtsform
                  </label>
                  <input
                    type="text"
                    value={formData.legalForm}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, legalForm: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="GmbH, AG, KG..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klassifizierung
                  </label>
                  <select
                    value={formData.classification}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        classification: e.target.value as CustomerClassification,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                  >
                    {CLASSIFICATION_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Straße
                </label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, street: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Musterstraße 1"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PLZ
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, zipCode: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="44139"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stadt
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, city: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Dortmund"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, website: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="https://"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="+49 ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="kontakt@..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  rows={3}
                  placeholder="Freitext..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.companyName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === "firmen" ? (
        customers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Kunden</h2>
            <p className="text-sm text-gray-500 mb-4">
              Lege den ersten Kunden an, um Projekte zuzuordnen.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Kunde anlegen
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3 opacity-60" />
            <h2 className="text-base font-semibold text-gray-700 mb-1">Keine Treffer</h2>
            <p className="text-sm text-gray-500">
              Passe die Filter oder die Suche an, um Kunden zu sehen.
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((c) => (
              <CustomerGridCard key={c.id} customer={c} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Klassifizierung</th>
                    <th className="px-4 py-3">Stadt</th>
                    <th className="px-4 py-3">Ansprechpartner</th>
                    <th className="px-4 py-3">Projekte</th>
                    <th className="px-4 py-3">Volumen</th>
                    <th className="px-4 py-3">Erstes Projekt</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <CustomerListRow key={c.id} customer={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <ContactsFlatList customers={customers} />
      )}
    </div>
  );
}

// ----- Sub-Components -----

function ClassificationBadge({ value }: { value: CustomerClassification }) {
  const cfg = CLASSIFICATION_CONFIG[value];
  return (
    <span
      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function CustomerGridCard({ customer }: { customer: CustomerDTO }) {
  const cfg = CLASSIFICATION_CONFIG[customer.classification];
  return (
    <Link
      href={`/kunden/${customer.id}`}
      className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
            {cfg.highlight && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
            )}
            <span className="truncate">{customer.companyName}</span>
          </h3>
          {customer.city && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              {customer.city}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
        >
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          {customer.contacts.length}{" "}
          {customer.contacts.length === 1 ? "Ansprechpartner" : "Ansprechpartner"}
        </span>
        <span className="flex items-center gap-1.5">
          <FolderKanban className="w-3 h-3" />
          {customer.projectCount}{" "}
          {customer.projectCount === 1 ? "Projekt" : "Projekte"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
        <Euro className="w-3 h-3 text-gray-400" />
        {formatCurrency(customer.totalVolumeEur)}
      </div>
    </Link>
  );
}

function CustomerListRow({ customer }: { customer: CustomerDTO }) {
  const cfg = CLASSIFICATION_CONFIG[customer.classification];
  return (
    <tr
      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group"
      onClick={(e) => {
        const link = e.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
        if (link) link.click();
      }}
    >
      <td className="px-4 py-3">
        <Link
          href={`/kunden/${customer.id}`}
          data-row-link
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-emerald-700 transition-colors"
        >
          {cfg.highlight && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
          )}
          {customer.companyName}
        </Link>
      </td>
      <td className="px-4 py-3">
        <ClassificationBadge value={customer.classification} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {customer.city || <span className="text-gray-400">–</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{customer.contacts.length}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{customer.projectCount}</td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        {formatCurrency(customer.totalVolumeEur)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-gray-400" />
          {formatDate(customer.firstProjectAt)}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-400 group-hover:text-gray-600 transition-colors">
        <ArrowRight className="w-4 h-4" />
      </td>
    </tr>
  );
}

// ----- ContactsFlatList: kontakt-zentrierte Tabelle -----

interface ContactRow {
  contact: CustomerContactDTO;
  customer: CustomerDTO;
}

function ContactsFlatList({ customers }: { customers: CustomerDTO[] }) {
  const router = useRouter();

  const [contactSearch, setContactSearch] = useState<string>("");
  const [contactClassFilter, setContactClassFilter] =
    useState<ClassificationFilter>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");

  const rows = useMemo<ContactRow[]>(() => {
    const all: ContactRow[] = [];
    for (const customer of customers) {
      for (const contact of customer.contacts) {
        all.push({ contact, customer });
      }
    }
    return all;
  }, [customers]);

  const customerOptions = useMemo<{ id: string; name: string }[]>(() => {
    return customers
      .map((c) => ({ id: c.id, name: c.companyName }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [customers]);

  const filtered = useMemo<ContactRow[]>(() => {
    const q = contactSearch.trim().toLowerCase();
    return rows.filter(({ contact, customer }) => {
      if (
        contactClassFilter !== "ALL" &&
        customer.classification !== contactClassFilter
      ) {
        return false;
      }
      if (customerFilter !== "ALL" && customer.id !== customerFilter) {
        return false;
      }
      if (q.length > 0) {
        const haystack = [
          contactFullName(contact),
          customer.companyName,
          contact.role ?? "",
          contact.email ?? "",
          contact.firstName ?? "",
          contact.lastName ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, contactSearch, contactClassFilter, customerFilter]);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3 opacity-60" />
        <h2 className="text-base font-semibold text-gray-700 mb-1">
          Noch keine Kontakte
        </h2>
        <p className="text-sm text-gray-500">
          Noch keine Kontakte angelegt. Wechsle zur Firmen-Ansicht, um einen
          Kunden + Kontakt anzulegen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Kontakt-Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={contactClassFilter}
            onChange={(e) =>
              setContactClassFilter(e.target.value as ClassificationFilter)
            }
            className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
          >
            {CLASSIFICATION_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer max-w-[14rem]"
          >
            <option value="ALL">Alle Firmen</option>
            {customerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Name, Firma, Funktion, E-Mail..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-64"
          />
        </div>
      </div>

      {/* Zähler */}
      <p className="text-xs text-gray-500">
        {filtered.length} von {rows.length}{" "}
        {rows.length === 1 ? "Kontakt" : "Kontakten"}
      </p>

      {/* Tabelle */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3 opacity-60" />
          <h2 className="text-base font-semibold text-gray-700 mb-1">
            Keine Treffer
          </h2>
          <p className="text-sm text-gray-500">
            Passe die Filter oder die Suche an, um Kontakte zu sehen.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Firma</th>
                  <th className="px-4 py-3">Funktion</th>
                  <th className="px-4 py-3">Relevanz</th>
                  <th className="px-4 py-3">Telefonnummer</th>
                  <th className="px-4 py-3">E-Mail</th>
                  <th className="px-4 py-3">Bemerkung</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <ContactsFlatRow
                    key={row.contact.id}
                    row={row}
                    onOpen={() => router.push(`/kunden/${row.customer.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactsFlatRow({
  row,
  onOpen,
}: {
  row: ContactRow;
  onOpen: () => void;
}) {
  const { contact, customer } = row;
  const cfg = CLASSIFICATION_CONFIG[customer.classification];
  const color = colorFromId(contact.id);
  const initials = initialsFromName(contact);
  const name = contactFullName(contact);
  const phone = contact.phone || contact.mobile || null;

  return (
    <tr
      className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer transition-colors"
      onClick={onOpen}
    >
      {/* Name mit Avatar */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${color.bg} ${color.text}`}
            title={name}
          >
            {initials || <User className="w-3.5 h-3.5" />}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-gray-900 truncate">
              {name}
            </span>
            {contact.isPrimary && (
              <Star
                className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0"
                aria-label="Primärer Ansprechpartner"
              />
            )}
          </div>
        </div>
      </td>

      {/* Firma (klickbar) */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/kunden/${customer.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-emerald-700 transition-colors"
        >
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="truncate max-w-[16rem]">{customer.companyName}</span>
        </Link>
      </td>

      {/* Funktion */}
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
        {contact.role ? (
          <span className="truncate inline-block max-w-[12rem]">
            {contact.role}
          </span>
        ) : (
          <span className="text-gray-400">–</span>
        )}
      </td>

      {/* Relevanz */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
        >
          {cfg.highlight && (
            <Star className="w-3 h-3 fill-current" aria-hidden="true" />
          )}
          {cfg.label}
        </span>
      </td>

      {/* Telefon */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-emerald-700 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            {phone}
          </a>
        ) : (
          <span className="text-gray-400">–</span>
        )}
      </td>

      {/* E-Mail */}
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-emerald-700 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate max-w-[14rem]">{contact.email}</span>
          </a>
        ) : (
          <span className="text-gray-400">–</span>
        )}
      </td>

      {/* Bemerkung */}
      <td className="px-4 py-3 text-sm text-gray-600 max-w-[18rem]">
        {contact.notes ? (
          <span
            className="block truncate"
            title={contact.notes}
          >
            {contact.notes}
          </span>
        ) : (
          <span className="text-gray-400">–</span>
        )}
      </td>
    </tr>
  );
}
