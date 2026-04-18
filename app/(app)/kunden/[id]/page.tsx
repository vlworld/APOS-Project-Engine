"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
  MapPin,
  Globe,
  Mail,
  Phone,
  Hash,
  FolderKanban,
  Euro,
  Calendar,
  UserPlus,
  Star,
  ArrowRight,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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

interface ProjectSummary {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
}

interface CustomerDetailResponse {
  customer: CustomerDTO;
  projects: ProjectSummary[];
}

// ----- Config / Helpers -----

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

const CLASSIFICATION_FORM_OPTIONS: { value: CustomerClassification; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "IMPORTANT", label: "Wichtig" },
  { value: "STRATEGIC", label: "Strategisch" },
  { value: "WATCH", label: "Beobachtung" },
  { value: "BLOCKED", label: "Gesperrt" },
];

interface StatusConfig {
  label: string;
  bg: string;
  text: string;
}

const PROJECT_STATUS_CONFIG: Record<string, StatusConfig> = {
  PLANNING: { label: "Planung", bg: "bg-blue-100", text: "text-blue-700" },
  ACTIVE: { label: "Aktiv", bg: "bg-emerald-100", text: "text-emerald-700" },
  ON_HOLD: { label: "Pausiert", bg: "bg-amber-100", text: "text-amber-700" },
  COMPLETED: { label: "Abgeschlossen", bg: "bg-gray-100", text: "text-gray-600" },
  ARCHIVED: { label: "Archiviert", bg: "bg-gray-100", text: "text-gray-500" },
};

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

function colorFromId(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function contactInitials(c: CustomerContactDTO): string {
  const first = (c.firstName ?? "").trim();
  const last = (c.lastName ?? "").trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (c.salutation && c.salutation.trim()) {
    return c.salutation.trim().slice(0, 2).toUpperCase();
  }
  return "??";
}

function contactDisplayName(c: CustomerContactDTO): string {
  const parts = [c.salutation, c.firstName, c.lastName].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return parts.join(" ");
}

function normalizeUrl(raw: string): string {
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

// ----- Form States -----

interface CustomerFormState {
  companyName: string;
  legalForm: string;
  classification: CustomerClassification;
  street: string;
  zipCode: string;
  city: string;
  country: string;
  website: string;
  phone: string;
  email: string;
  taxId: string;
  vatId: string;
  notes: string;
}

function customerToForm(c: CustomerDTO): CustomerFormState {
  return {
    companyName: c.companyName,
    legalForm: c.legalForm ?? "",
    classification: c.classification,
    street: c.street ?? "",
    zipCode: c.zipCode ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    website: c.website ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    taxId: c.taxId ?? "",
    vatId: c.vatId ?? "",
    notes: c.notes ?? "",
  };
}

interface ContactFormState {
  salutation: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  mobile: string;
  isPrimary: boolean;
  notes: string;
}

const EMPTY_CONTACT_FORM: ContactFormState = {
  salutation: "",
  firstName: "",
  lastName: "",
  role: "",
  email: "",
  phone: "",
  mobile: "",
  isPrimary: false,
  notes: "",
};

function contactToForm(c: CustomerContactDTO): ContactFormState {
  return {
    salutation: c.salutation ?? "",
    firstName: c.firstName ?? "",
    lastName: c.lastName,
    role: c.role ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    isPrimary: c.isPrimary,
    notes: c.notes ?? "",
  };
}

// ----- Main Component -----

export default function KundeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;
  const { toast } = useToast();

  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Customer Edit Modal
  const [showEdit, setShowEdit] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerFormState | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Contact Modals
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactEditingId, setContactEditingId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [savingContact, setSavingContact] = useState(false);
  const [confirmDeleteContact, setConfirmDeleteContact] =
    useState<CustomerContactDTO | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch(`/api/kunden/${customerId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as CustomerDetailResponse;
        setCustomer(data.customer);
        setProjects(data.projects);
      }
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  // ----- Customer Edit -----

  const openEdit = useCallback(() => {
    if (!customer) return;
    setCustomerForm(customerToForm(customer));
    setShowEdit(true);
  }, [customer]);

  const handleSaveCustomer = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!customerForm || !customerForm.companyName.trim()) return;
      setSavingCustomer(true);
      try {
        const res = await fetch(`/api/kunden/${customerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: customerForm.companyName.trim(),
            legalForm: customerForm.legalForm.trim() || null,
            classification: customerForm.classification,
            street: customerForm.street.trim() || null,
            zipCode: customerForm.zipCode.trim() || null,
            city: customerForm.city.trim() || null,
            country: customerForm.country.trim() || null,
            website: customerForm.website.trim() || null,
            phone: customerForm.phone.trim() || null,
            email: customerForm.email.trim() || null,
            taxId: customerForm.taxId.trim() || null,
            vatId: customerForm.vatId.trim() || null,
            notes: customerForm.notes.trim() || null,
          }),
        });
        if (res.ok) {
          setShowEdit(false);
          await fetchCustomer();
          toast({ title: "Kunde aktualisiert", variant: "success" });
        } else {
          const body = (await res.json().catch(() => ({ error: "Fehler" }))) as {
            error?: string;
          };
          toast({ title: body.error ?? "Speichern fehlgeschlagen", variant: "error" });
        }
      } finally {
        setSavingCustomer(false);
      }
    },
    [customerForm, customerId, fetchCustomer, toast],
  );

  // Keyboard für Edit-Modal
  useEffect(() => {
    if (!showEdit) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!savingCustomer) setShowEdit(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!savingCustomer) void handleSaveCustomer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEdit, savingCustomer, handleSaveCustomer]);

  const handleDeleteCustomer = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/kunden/${customerId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Kunde gelöscht", variant: "success" });
        router.push("/kunden");
      } else {
        const body = (await res.json().catch(() => ({ error: "Fehler" }))) as {
          error?: string;
        };
        toast({ title: body.error ?? "Löschen fehlgeschlagen", variant: "error" });
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [customerId, router, toast]);

  // ----- Contacts -----

  const openCreateContact = useCallback(() => {
    setContactEditingId(null);
    setContactForm(EMPTY_CONTACT_FORM);
    setContactModalOpen(true);
  }, []);

  const openEditContact = useCallback((c: CustomerContactDTO) => {
    setContactEditingId(c.id);
    setContactForm(contactToForm(c));
    setContactModalOpen(true);
  }, []);

  const handleSaveContact = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!contactForm.lastName.trim()) return;
      setSavingContact(true);
      try {
        const isEdit = contactEditingId !== null;
        const url = isEdit
          ? `/api/kunden/${customerId}/kontakte/${contactEditingId}`
          : `/api/kunden/${customerId}/kontakte`;
        const method = isEdit ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salutation: contactForm.salutation.trim() || null,
            firstName: contactForm.firstName.trim() || null,
            lastName: contactForm.lastName.trim(),
            role: contactForm.role.trim() || null,
            email: contactForm.email.trim() || null,
            phone: contactForm.phone.trim() || null,
            mobile: contactForm.mobile.trim() || null,
            isPrimary: contactForm.isPrimary,
            notes: contactForm.notes.trim() || null,
          }),
        });
        if (res.ok) {
          setContactModalOpen(false);
          setContactEditingId(null);
          await fetchCustomer();
          toast({
            title: isEdit ? "Kontakt aktualisiert" : "Kontakt angelegt",
            variant: "success",
          });
        } else {
          const body = (await res.json().catch(() => ({ error: "Fehler" }))) as {
            error?: string;
          };
          toast({ title: body.error ?? "Speichern fehlgeschlagen", variant: "error" });
        }
      } finally {
        setSavingContact(false);
      }
    },
    [contactForm, contactEditingId, customerId, fetchCustomer, toast],
  );

  // Keyboard für Contact-Modal
  useEffect(() => {
    if (!contactModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!savingContact) setContactModalOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!savingContact) void handleSaveContact();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contactModalOpen, savingContact, handleSaveContact]);

  const handleDeleteContact = useCallback(async () => {
    if (!confirmDeleteContact) return;
    setDeletingContact(true);
    try {
      const res = await fetch(
        `/api/kunden/${customerId}/kontakte/${confirmDeleteContact.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        toast({ title: "Kontakt gelöscht", variant: "success" });
        await fetchCustomer();
      } else {
        toast({ title: "Löschen fehlgeschlagen", variant: "error" });
      }
    } finally {
      setDeletingContact(false);
      setConfirmDeleteContact(null);
    }
  }, [confirmDeleteContact, customerId, fetchCustomer, toast]);

  // ----- Derived -----

  const sortedContacts = useMemo(() => {
    if (!customer) return [];
    return [...customer.contacts].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
    );
  }, [customer]);

  // ----- Render -----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="max-w-4xl">
        <div className="mb-4">
          <Link
            href="/kunden"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Zurück zu Kunden
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Kunde nicht gefunden
          </h2>
          <p className="text-sm text-gray-500">
            Der Kunde existiert nicht oder du hast keinen Zugriff.
          </p>
        </div>
      </div>
    );
  }

  const cfg = CLASSIFICATION_CONFIG[customer.classification];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/kunden"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Kunden
        </Link>
        <span className="text-sm text-gray-400 mx-1">/</span>
        <span className="text-sm text-gray-700 font-medium">{customer.companyName}</span>
      </div>

      {/* Header-Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-cyan-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {customer.companyName}
                </h1>
                {cfg.highlight && (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                )}
                <span
                  className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                >
                  {cfg.label}
                </span>
                {customer.isSample && (
                  <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    Muster
                  </span>
                )}
              </div>
              {customer.legalForm && (
                <p className="text-sm text-gray-500 mt-0.5">{customer.legalForm}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openEdit}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Löschen
            </button>
          </div>
        </div>

        {/* Inline-Metadaten */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {(customer.street || customer.zipCode || customer.city || customer.country) && (
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                {customer.street && <div>{customer.street}</div>}
                <div>
                  {[customer.zipCode, customer.city].filter(Boolean).join(" ")}
                  {customer.country && (customer.zipCode || customer.city)
                    ? `, ${customer.country}`
                    : customer.country || ""}
                </div>
              </div>
            </div>
          )}
          {customer.website && (
            <div className="flex items-center gap-2 text-gray-600 min-w-0">
              <Globe className="w-4 h-4 text-gray-400 shrink-0" />
              <a
                href={normalizeUrl(customer.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline truncate"
              >
                {customer.website}
              </a>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2 text-gray-600 min-w-0">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <a
                href={`mailto:${customer.email}`}
                className="text-emerald-700 hover:underline truncate"
              >
                {customer.email}
              </a>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-gray-600 min-w-0">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <a
                href={`tel:${customer.phone}`}
                className="text-emerald-700 hover:underline truncate"
              >
                {customer.phone}
              </a>
            </div>
          )}
          {customer.vatId && (
            <div className="flex items-center gap-2 text-gray-600">
              <Hash className="w-4 h-4 text-gray-400 shrink-0" />
              USt-IdNr.: <span className="font-mono text-gray-700">{customer.vatId}</span>
            </div>
          )}
          {customer.taxId && (
            <div className="flex items-center gap-2 text-gray-600">
              <Hash className="w-4 h-4 text-gray-400 shrink-0" />
              Steuernummer:{" "}
              <span className="font-mono text-gray-700">{customer.taxId}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI-Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<FolderKanban className="w-4 h-4" />}
          label="Projekte"
          value={String(customer.projectCount)}
        />
        <KpiCard
          icon={<Euro className="w-4 h-4" />}
          label="Gesamtvolumen"
          value={formatCurrency(customer.totalVolumeEur)}
        />
        <KpiCard
          icon={<Calendar className="w-4 h-4" />}
          label="Erstes Projekt"
          value={formatDate(customer.firstProjectAt)}
        />
        <KpiCard
          icon={<Calendar className="w-4 h-4" />}
          label="Letztes Projekt"
          value={formatDate(customer.lastProjectAt)}
        />
      </div>

      {/* Kontakte-Sektion */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Ansprechpartner</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {sortedContacts.length}{" "}
              {sortedContacts.length === 1 ? "Kontakt" : "Kontakte"}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateContact}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Kontakt
          </button>
        </div>

        {sortedContacts.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">
              Noch keine Ansprechpartner hinterlegt.
            </p>
            <button
              type="button"
              onClick={openCreateContact}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
            >
              Ersten Kontakt anlegen
            </button>
          </div>
        ) : (
          <ul>
            {sortedContacts.map((c, idx) => {
              const color = colorFromId(c.id);
              const initials = contactInitials(c);
              const name = contactDisplayName(c) || c.lastName;
              return (
                <li
                  key={c.id}
                  className={`group flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${
                    idx > 0 ? "border-t border-gray-100" : ""
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${color.bg} ${color.text}`}
                    title={name}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                      {c.isPrimary && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Hauptansprechpartner
                        </span>
                      )}
                    </div>
                    {c.role && (
                      <div className="text-xs text-gray-500 mt-0.5">{c.role}</div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs">
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                        >
                          <Mail className="w-3 h-3" />
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                        >
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </a>
                      )}
                      {c.mobile && (
                        <a
                          href={`tel:${c.mobile}`}
                          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                        >
                          <Phone className="w-3 h-3" />
                          {c.mobile}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEditContact(c)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteContact(c)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Projekt-Historie */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Projekt-Historie</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <FolderKanban className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Für diesen Kunden sind noch keine Projekte angelegt.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  <th className="px-4 py-3">Nummer</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Volumen</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Ende</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const status =
                    PROJECT_STATUS_CONFIG[p.status] ?? PROJECT_STATUS_CONFIG.PLANNING;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={(e) => {
                        const link =
                          e.currentTarget.querySelector<HTMLAnchorElement>(
                            "a[data-row-link]",
                          );
                        if (link) link.click();
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {p.projectNumber}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/projekte/${p.id}`}
                          data-row-link
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm font-medium text-gray-900 hover:text-emerald-700 transition-colors"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatCurrency(p.budget)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(p.startDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(p.endDate)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 group-hover:text-gray-600 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notizen-Sektion */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Notizen</h2>
          <button
            type="button"
            onClick={openEdit}
            className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Bearbeiten
          </button>
        </div>
        {customer.notes && customer.notes.trim().length > 0 ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Keine Notizen hinterlegt. Klicke auf „Bearbeiten", um welche zu ergänzen.
          </p>
        )}
      </div>

      {/* Edit-Modal */}
      {showEdit && customerForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!savingCustomer) setShowEdit(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Kunde bearbeiten</h2>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firmenname *
                </label>
                <input
                  type="text"
                  value={customerForm.companyName}
                  onChange={(e) =>
                    setCustomerForm((f) =>
                      f ? { ...f, companyName: e.target.value } : f,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
                    value={customerForm.legalForm}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, legalForm: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klassifizierung
                  </label>
                  <select
                    value={customerForm.classification}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f
                          ? {
                              ...f,
                              classification: e.target.value as CustomerClassification,
                            }
                          : f,
                      )
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
                  value={customerForm.street}
                  onChange={(e) =>
                    setCustomerForm((f) => (f ? { ...f, street: e.target.value } : f))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PLZ
                  </label>
                  <input
                    type="text"
                    value={customerForm.zipCode}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, zipCode: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stadt
                  </label>
                  <input
                    type="text"
                    value={customerForm.city}
                    onChange={(e) =>
                      setCustomerForm((f) => (f ? { ...f, city: e.target.value } : f))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Land
                  </label>
                  <input
                    type="text"
                    value={customerForm.country}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, country: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={customerForm.website}
                  onChange={(e) =>
                    setCustomerForm((f) =>
                      f ? { ...f, website: e.target.value } : f,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, phone: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, email: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    USt-IdNr.
                  </label>
                  <input
                    type="text"
                    value={customerForm.vatId}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, vatId: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Steuernummer
                  </label>
                  <input
                    type="text"
                    value={customerForm.taxId}
                    onChange={(e) =>
                      setCustomerForm((f) =>
                        f ? { ...f, taxId: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={customerForm.notes}
                  onChange={(e) =>
                    setCustomerForm((f) => (f ? { ...f, notes: e.target.value } : f))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer || !customerForm.companyName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {savingCustomer && <Loader2 className="w-4 h-4 animate-spin" />}
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kontakt-Modal */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (!savingContact) setContactModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {contactEditingId ? "Kontakt bearbeiten" : "Neuer Kontakt"}
              </h2>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Anrede
                  </label>
                  <input
                    type="text"
                    value={contactForm.salutation}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, salutation: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Herr / Frau / Dr."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vorname
                  </label>
                  <input
                    type="text"
                    value={contactForm.firstName}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nachname *
                  </label>
                  <input
                    type="text"
                    value={contactForm.lastName}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rolle
                </label>
                <input
                  type="text"
                  value={contactForm.role}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, role: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="z.B. Projektleitung, Einkauf"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobil
                  </label>
                  <input
                    type="tel"
                    value={contactForm.mobile}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, mobile: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, isPrimary: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Hauptansprechpartner
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={contactForm.notes}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={savingContact || !contactForm.lastName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {savingContact && <Loader2 className="w-4 h-4 animate-spin" />}
                  {contactEditingId ? "Speichern" : "Anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Kunde löschen?"
        description={`Der Kunde „${customer.companyName}" wird inkl. aller Ansprechpartner gelöscht. Zugeordnete Projekte verlieren die Kundenzuordnung.`}
        confirmLabel="Löschen"
        destructive
        loading={deleting}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmDeleteContact !== null}
        title="Kontakt löschen?"
        description={
          confirmDeleteContact
            ? `Kontakt „${contactDisplayName(confirmDeleteContact) || confirmDeleteContact.lastName}" wird unwiderruflich gelöscht.`
            : undefined
        }
        confirmLabel="Löschen"
        destructive
        loading={deletingContact}
        onConfirm={handleDeleteContact}
        onCancel={() => setConfirmDeleteContact(null)}
      />
    </div>
  );
}

// ----- Sub-Components -----

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
