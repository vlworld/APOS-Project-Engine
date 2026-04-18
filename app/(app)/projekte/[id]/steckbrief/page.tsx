"use client";

// ─── Projektsteckbrief — Client-Page ───────────────────────────────────────
// Strukturiertes Übergabeprotokoll pro Projekt. Akkordeon-Layout, alle
// Sektionen standardmäßig offen. Speichern via Button + Cmd/Ctrl+S, Escape
// verwirft die ungespeicherten Änderungen (Reload des Server-States).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Euro,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

// ─── Types (Spiegel der Service-DTOs) ──────────────────────────────────────

type ChecklistItem = {
  id: string;
  text: string;
  verantwortlich: string | null;
  done: boolean;
  doneAt?: string | null;
};

type Briefing = {
  id: string;
  projectId: string;
  akquisiteur: string | null;
  groesseKwp: number | null;
  verantwortlichkeit: string | null;
  prioritaet: string | null;
  richtlinie: string | null;
  anlagentyp: string | null;
  projektbeschreibung: string | null;
  vorhandeneUnterlagen: string | null;
  stakeholder: string | null;
  ansprechpartner: string | null;
  auftragsvolumenEur: number | null;
  bwMeilensteine: string | null;
  netzgebiet: string | null;
  technischeAnnahmen: string | null;
  monteurplanung: string | null;
  herausforderungen: string | null;
  absehbareProbleme: string | null;
  informationsIntervall: string | null;
  ersteTodos: string | null;
  offeneTodosVorStart: string | null;
  erwartungenKunde: string | null;
  ausserordentlicheAbspr: string | null;
  sonstigeAnmerkungen: string | null;
  naechsteSchritte: ChecklistItem[];
  version: string;
  uebergebenAm: string | null;
  uebergebenVonId: string | null;
  uebernommenVonId: string | null;
};

type FormState = Omit<Briefing, "id" | "projectId" | "naechsteSchritte"> & {
  groesseKwpStr: string;
  auftragsvolumenEurStr: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = ["A", "B", "C"] as const;
const ANLAGENTYP_OPTIONS = ["Freifläche", "Dach", "Batterie"] as const;

function emptyForm(): FormState {
  return {
    akquisiteur: null,
    groesseKwp: null,
    groesseKwpStr: "",
    verantwortlichkeit: null,
    prioritaet: null,
    richtlinie: null,
    anlagentyp: null,
    projektbeschreibung: null,
    vorhandeneUnterlagen: null,
    stakeholder: null,
    ansprechpartner: null,
    auftragsvolumenEur: null,
    auftragsvolumenEurStr: "",
    bwMeilensteine: null,
    netzgebiet: null,
    technischeAnnahmen: null,
    monteurplanung: null,
    herausforderungen: null,
    absehbareProbleme: null,
    informationsIntervall: null,
    ersteTodos: null,
    offeneTodosVorStart: null,
    erwartungenKunde: null,
    ausserordentlicheAbspr: null,
    sonstigeAnmerkungen: null,
    version: "1.0",
    uebergebenAm: null,
    uebergebenVonId: null,
    uebernommenVonId: null,
  };
}

function briefingToForm(b: Briefing): FormState {
  return {
    akquisiteur: b.akquisiteur,
    groesseKwp: b.groesseKwp,
    groesseKwpStr: b.groesseKwp !== null ? String(b.groesseKwp) : "",
    verantwortlichkeit: b.verantwortlichkeit,
    prioritaet: b.prioritaet,
    richtlinie: b.richtlinie,
    anlagentyp: b.anlagentyp,
    projektbeschreibung: b.projektbeschreibung,
    vorhandeneUnterlagen: b.vorhandeneUnterlagen,
    stakeholder: b.stakeholder,
    ansprechpartner: b.ansprechpartner,
    auftragsvolumenEur: b.auftragsvolumenEur,
    auftragsvolumenEurStr:
      b.auftragsvolumenEur !== null ? String(b.auftragsvolumenEur) : "",
    bwMeilensteine: b.bwMeilensteine,
    netzgebiet: b.netzgebiet,
    technischeAnnahmen: b.technischeAnnahmen,
    monteurplanung: b.monteurplanung,
    herausforderungen: b.herausforderungen,
    absehbareProbleme: b.absehbareProbleme,
    informationsIntervall: b.informationsIntervall,
    ersteTodos: b.ersteTodos,
    offeneTodosVorStart: b.offeneTodosVorStart,
    erwartungenKunde: b.erwartungenKunde,
    ausserordentlicheAbspr: b.ausserordentlicheAbspr,
    sonstigeAnmerkungen: b.sonstigeAnmerkungen,
    version: b.version,
    uebergebenAm: b.uebergebenAm ? b.uebergebenAm.slice(0, 10) : null,
    uebergebenVonId: b.uebergebenVonId,
    uebernommenVonId: b.uebernommenVonId,
  };
}

function formatDate(d: string | null): string {
  if (!d) return "–";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y) return "–";
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── UI: Akkordeon-Sektion ─────────────────────────────────────────────────

function Section({
  title,
  icon,
  iconColor,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  iconColor: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={open}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}
        >
          {icon}
        </div>
        <h2 className="flex-1 text-sm font-semibold text-gray-900">{title}</h2>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="px-5 py-4 border-t border-gray-100 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── UI: Field wrappers ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-colors";

const textareaClass = `${inputClass} min-h-[88px] resize-y leading-relaxed`;

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className={inputClass}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v.length === 0 ? null : v);
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className={textareaClass}
      placeholder={placeholder}
      rows={rows}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v.length === 0 ? null : v);
      }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className={`${inputClass} ${suffix ? "pr-12" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: ReadonlyArray<string>;
  placeholder?: string;
}) {
  return (
    <select
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v.length === 0 ? null : v);
      }}
    >
      <option value="">{placeholder ?? "–"}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ProjektSteckbriefPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasBriefing, setHasBriefing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [serverForm, setServerForm] = useState<FormState>(emptyForm());
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uebergebenAt, setUebergebenAt] = useState<string | null>(null);

  // Akkordeon-State: alle Sektionen standardmäßig offen
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    grund: true,
    bw: true,
    technik: true,
    abwicklung: true,
    schritte: true,
    meta: true,
  });

  // Neue Checklist-Item Eingabe
  const [newItemText, setNewItemText] = useState("");
  const [newItemVerantwortlich, setNewItemVerantwortlich] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ChecklistItem | null>(null);

  // ─── Initial Load ────────────────────────────────────────────────────────
  const loadBriefing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projekte/${projectId}/steckbrief`);
      if (!res.ok) {
        toast({ title: "Steckbrief konnte nicht geladen werden", variant: "error" });
        return;
      }
      const data = (await res.json()) as { briefing: Briefing | null };
      if (data.briefing) {
        setHasBriefing(true);
        const f = briefingToForm(data.briefing);
        setForm(f);
        setServerForm(f);
        setChecklist(data.briefing.naechsteSchritte);
        setUebergebenAt(data.briefing.uebergebenAm);
      } else {
        setHasBriefing(false);
        const f = emptyForm();
        setForm(f);
        setServerForm(f);
        setChecklist([]);
        setUebergebenAt(null);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void loadBriefing();
  }, [loadBriefing]);

  // ─── Speichern ───────────────────────────────────────────────────────────

  function buildPayload(): Record<string, unknown> {
    const groesseKwp =
      form.groesseKwpStr.trim().length === 0
        ? null
        : Number(form.groesseKwpStr.replace(",", "."));
    const auftragsvolumenEur =
      form.auftragsvolumenEurStr.trim().length === 0
        ? null
        : Number(form.auftragsvolumenEurStr.replace(",", "."));

    return {
      akquisiteur: form.akquisiteur,
      groesseKwp:
        groesseKwp !== null && Number.isFinite(groesseKwp) ? groesseKwp : null,
      verantwortlichkeit: form.verantwortlichkeit,
      prioritaet: form.prioritaet,
      richtlinie: form.richtlinie,
      anlagentyp: form.anlagentyp,
      projektbeschreibung: form.projektbeschreibung,
      vorhandeneUnterlagen: form.vorhandeneUnterlagen,
      stakeholder: form.stakeholder,
      ansprechpartner: form.ansprechpartner,
      auftragsvolumenEur:
        auftragsvolumenEur !== null && Number.isFinite(auftragsvolumenEur)
          ? auftragsvolumenEur
          : null,
      bwMeilensteine: form.bwMeilensteine,
      netzgebiet: form.netzgebiet,
      technischeAnnahmen: form.technischeAnnahmen,
      monteurplanung: form.monteurplanung,
      herausforderungen: form.herausforderungen,
      absehbareProbleme: form.absehbareProbleme,
      informationsIntervall: form.informationsIntervall,
      ersteTodos: form.ersteTodos,
      offeneTodosVorStart: form.offeneTodosVorStart,
      erwartungenKunde: form.erwartungenKunde,
      ausserordentlicheAbspr: form.ausserordentlicheAbspr,
      sonstigeAnmerkungen: form.sonstigeAnmerkungen,
      version: form.version,
      uebergebenAm: form.uebergebenAm,
      uebergebenVonId: form.uebergebenVonId,
      uebernommenVonId: form.uebernommenVonId,
    };
  }

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(serverForm),
    [form, serverForm],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projekte/${projectId}/steckbrief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Fehler" }));
        toast({ title: body.error ?? "Speichern fehlgeschlagen", variant: "error" });
        return;
      }
      const data = (await res.json()) as { briefing: Briefing };
      const f = briefingToForm(data.briefing);
      setForm(f);
      setServerForm(f);
      setChecklist(data.briefing.naechsteSchritte);
      setUebergebenAt(data.briefing.uebergebenAm);
      setHasBriefing(true);
      toast({ title: "Steckbrief gespeichert", variant: "success" });
    } finally {
      setSaving(false);
    }
    // buildPayload uses form, so we depend on form via a ref-like closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, form, toast]);

  const handleDiscard = useCallback(() => {
    setForm(serverForm);
  }, [serverForm]);

  // Cmd/Ctrl+S, Escape
  const handleSaveRef = useRef(handleSave);
  const handleDiscardRef = useRef(handleDiscard);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);
  useEffect(() => {
    handleDiscardRef.current = handleDiscard;
  }, [handleDiscard]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirtyRef.current) void handleSaveRef.current();
        return;
      }
      if (e.key === "Escape" && isDirtyRef.current) {
        // Nur verwerfen, wenn nicht in einem Textfeld eines Modals (ConfirmDialog hört selbst).
        const target = e.target as HTMLElement | null;
        const inEditable =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.tagName === "SELECT";
        if (inEditable) return;
        handleDiscardRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Checklist-Aktionen ──────────────────────────────────────────────────

  async function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    const verantwortlich = newItemVerantwortlich.trim();
    const res = await fetch(
      `/api/projekte/${projectId}/steckbrief/checklist`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          verantwortlich: verantwortlich.length > 0 ? verantwortlich : null,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Fehler" }));
      toast({ title: body.error ?? "Konnte nicht angelegt werden", variant: "error" });
      return;
    }
    const data = (await res.json()) as { briefing: Briefing };
    setChecklist(data.briefing.naechsteSchritte);
    setHasBriefing(true);
    setNewItemText("");
    setNewItemVerantwortlich("");
    toast({ title: "Schritt hinzugefügt", variant: "success" });
  }

  async function toggleItem(item: ChecklistItem) {
    const next = !item.done;
    // Optimistisch togglen
    setChecklist((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, done: next } : it)),
    );
    const res = await fetch(
      `/api/projekte/${projectId}/steckbrief/checklist/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: next }),
      },
    );
    if (!res.ok) {
      // Rollback
      setChecklist((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, done: !next } : it)),
      );
      toast({ title: "Aktualisierung fehlgeschlagen", variant: "error" });
      return;
    }
    const data = (await res.json()) as { briefing: Briefing };
    setChecklist(data.briefing.naechsteSchritte);
  }

  async function removeItem(item: ChecklistItem) {
    const res = await fetch(
      `/api/projekte/${projectId}/steckbrief/checklist/${item.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast({ title: "Löschen fehlgeschlagen", variant: "error" });
      setPendingDelete(null);
      return;
    }
    const data = (await res.json()) as { briefing: Briefing };
    setChecklist(data.briefing.naechsteSchritte);
    setPendingDelete(null);
    toast({ title: "Schritt entfernt", variant: "success" });
  }

  // ─── Status-Badge ────────────────────────────────────────────────────────

  const statusBadge = uebergebenAt ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
      <Check className="w-3 h-3" />
      Übergeben am {formatDate(uebergebenAt)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
      <AlertTriangle className="w-3 h-3" />
      Unvollständig
    </span>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Back link */}
      <Link
        href={`/projekte/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zum Projekt
      </Link>

      {/* Header-Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Projektsteckbrief</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                v{form.version}
              </span>
              {statusBadge}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Strukturiertes Übergabeprotokoll mit allen Metadaten und der
              Checkliste der nächsten Schritte.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              toast({
                title: "Export noch nicht verfügbar",
                description: "PDF-Export folgt in einer späteren Version.",
                variant: "info",
              });
            }}
            // #fixme: PDF-Export noch nicht verdrahtet
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Sektionen */}
      <div className="space-y-3 mb-24">
        {/* 1. Grundinformationen */}
        <Section
          title="Grundinformationen"
          icon={<FileText className="w-4 h-4 text-blue-600" />}
          iconColor="bg-blue-100"
          open={openSections.grund}
          onToggle={() =>
            setOpenSections((s) => ({ ...s, grund: !s.grund }))
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Akquisiteur">
              <TextInput
                value={form.akquisiteur}
                onChange={(v) => setForm((f) => ({ ...f, akquisiteur: v }))}
                placeholder="z. B. Oliver vom Lehn"
              />
            </Field>
            <Field label="Größe">
              <NumberInput
                value={form.groesseKwpStr}
                onChange={(v) => setForm((f) => ({ ...f, groesseKwpStr: v }))}
                placeholder="z. B. 3322"
                suffix="kWp"
              />
            </Field>
            <Field label="Verantwortlichkeit">
              <TextInput
                value={form.verantwortlichkeit}
                onChange={(v) =>
                  setForm((f) => ({ ...f, verantwortlichkeit: v }))
                }
                placeholder="z. B. Martin Trachniewicz"
              />
            </Field>
            <Field label="Priorität">
              <Select
                value={form.prioritaet}
                onChange={(v) => setForm((f) => ({ ...f, prioritaet: v }))}
                options={PRIORITY_OPTIONS}
                placeholder="– keine –"
              />
            </Field>
            <Field label="Richtlinie">
              <TextInput
                value={form.richtlinie}
                onChange={(v) => setForm((f) => ({ ...f, richtlinie: v }))}
                placeholder="z. B. 4110"
              />
            </Field>
            <Field label="Anlagentyp">
              <Select
                value={form.anlagentyp}
                onChange={(v) => setForm((f) => ({ ...f, anlagentyp: v }))}
                options={ANLAGENTYP_OPTIONS}
                placeholder="– bitte wählen –"
              />
            </Field>
          </div>
          <Field label="Projektbeschreibung">
            <TextArea
              value={form.projektbeschreibung}
              onChange={(v) =>
                setForm((f) => ({ ...f, projektbeschreibung: v }))
              }
              placeholder="Kurze Beschreibung des Projekts, Hintergrund, Besonderheiten…"
              rows={4}
            />
          </Field>
          <Field label="Vorhandene Unterlagen">
            <TextArea
              value={form.vorhandeneUnterlagen}
              onChange={(v) =>
                setForm((f) => ({ ...f, vorhandeneUnterlagen: v }))
              }
              placeholder="Baugenehmigung, Netzzusage, Fotos, …"
            />
          </Field>
        </Section>

        {/* 2. Betriebswirtschaftlich */}
        <Section
          title="Betriebswirtschaftlich"
          icon={<Euro className="w-4 h-4 text-emerald-600" />}
          iconColor="bg-emerald-100"
          open={openSections.bw}
          onToggle={() => setOpenSections((s) => ({ ...s, bw: !s.bw }))}
        >
          <Field label="Stakeholder">
            <TextArea
              value={form.stakeholder}
              onChange={(v) => setForm((f) => ({ ...f, stakeholder: v }))}
              placeholder="Beteiligte Parteien, Rollen, Kommunikationsumfang…"
              rows={4}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Ansprechpartner">
              <TextInput
                value={form.ansprechpartner}
                onChange={(v) => setForm((f) => ({ ...f, ansprechpartner: v }))}
                placeholder="z. B. OvL"
              />
            </Field>
            <Field label="Auftragsvolumen">
              <NumberInput
                value={form.auftragsvolumenEurStr}
                onChange={(v) =>
                  setForm((f) => ({ ...f, auftragsvolumenEurStr: v }))
                }
                placeholder="z. B. 1500000"
                suffix="€"
              />
            </Field>
          </div>
          <Field label="BW-Meilensteine">
            <TextArea
              value={form.bwMeilensteine}
              onChange={(v) => setForm((f) => ({ ...f, bwMeilensteine: v }))}
              placeholder="Zahlungsmeilensteine, Anteile, Trigger…"
              rows={4}
            />
          </Field>
        </Section>

        {/* 3. Technik */}
        <Section
          title="Technik"
          icon={<FileText className="w-4 h-4 text-cyan-600" />}
          iconColor="bg-cyan-100"
          open={openSections.technik}
          onToggle={() =>
            setOpenSections((s) => ({ ...s, technik: !s.technik }))
          }
        >
          <Field label="Netzgebiet">
            <TextInput
              value={form.netzgebiet}
              onChange={(v) => setForm((f) => ({ ...f, netzgebiet: v }))}
              placeholder="z. B. Westnetz"
            />
          </Field>
          <Field label="Technische Annahmen">
            <TextArea
              value={form.technischeAnnahmen}
              onChange={(v) =>
                setForm((f) => ({ ...f, technischeAnnahmen: v }))
              }
              placeholder="Module, Wechselrichter, Ausrichtung, Belegung…"
              rows={4}
            />
          </Field>
          <Field label="Monteurplanung">
            <TextInput
              value={form.monteurplanung}
              onChange={(v) => setForm((f) => ({ ...f, monteurplanung: v }))}
              placeholder="z. B. Ausschließlich Nachunternehmer"
            />
          </Field>
        </Section>

        {/* 4. Projektabwicklung */}
        <Section
          title="Projektabwicklung"
          icon={<AlertTriangle className="w-4 h-4 text-orange-600" />}
          iconColor="bg-orange-100"
          open={openSections.abwicklung}
          onToggle={() =>
            setOpenSections((s) => ({ ...s, abwicklung: !s.abwicklung }))
          }
        >
          <Field label="Herausforderungen">
            <TextArea
              value={form.herausforderungen}
              onChange={(v) =>
                setForm((f) => ({ ...f, herausforderungen: v }))
              }
              placeholder="Was sind die Stolpersteine?"
              rows={4}
            />
          </Field>
          <Field label="Absehbare Probleme">
            <TextArea
              value={form.absehbareProbleme}
              onChange={(v) =>
                setForm((f) => ({ ...f, absehbareProbleme: v }))
              }
              placeholder="z. B. Bestell- & Beschaffungsprozess"
            />
          </Field>
          <Field label="Informations-Intervall">
            <TextInput
              value={form.informationsIntervall}
              onChange={(v) =>
                setForm((f) => ({ ...f, informationsIntervall: v }))
              }
              placeholder="z. B. Bei den Projektleiter-Meetings"
            />
          </Field>
          <Field label="Erste To-Dos">
            <TextArea
              value={form.ersteTodos}
              onChange={(v) => setForm((f) => ({ ...f, ersteTodos: v }))}
              placeholder="Was sind die ersten Schritte nach Übergabe?"
              rows={4}
            />
          </Field>
          <Field label="Offene To-Dos vor Projektstart">
            <TextArea
              value={form.offeneTodosVorStart}
              onChange={(v) =>
                setForm((f) => ({ ...f, offeneTodosVorStart: v }))
              }
              placeholder="Muss vor Baustart erledigt sein"
            />
          </Field>
          <Field label="Erwartungen Kunde / sensible Aspekte">
            <TextArea
              value={form.erwartungenKunde}
              onChange={(v) =>
                setForm((f) => ({ ...f, erwartungenKunde: v }))
              }
              placeholder="Worauf legt der Kunde besonders Wert?"
            />
          </Field>
          <Field label="Außerordentliche Absprachen">
            <TextArea
              value={form.ausserordentlicheAbspr}
              onChange={(v) =>
                setForm((f) => ({ ...f, ausserordentlicheAbspr: v }))
              }
              placeholder="Sondervereinbarungen, strategische Bedeutung…"
            />
          </Field>
          <Field label="Sonstige Anmerkungen">
            <TextArea
              value={form.sonstigeAnmerkungen}
              onChange={(v) =>
                setForm((f) => ({ ...f, sonstigeAnmerkungen: v }))
              }
              placeholder="Sonstiges, was bei der Übergabe mitgegeben werden sollte"
              rows={4}
            />
          </Field>
        </Section>

        {/* 5. Nächste Schritte (Checkliste) */}
        <Section
          title="Nächste Schritte"
          icon={<ListChecks className="w-4 h-4 text-violet-600" />}
          iconColor="bg-violet-100"
          open={openSections.schritte}
          onToggle={() =>
            setOpenSections((s) => ({ ...s, schritte: !s.schritte }))
          }
        >
          {checklist.length === 0 ? (
            <div className="text-sm text-gray-400 italic">
              Noch keine Schritte angelegt.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => void toggleItem(item)}
                    aria-pressed={item.done}
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      item.done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-white border-gray-300 hover:border-emerald-400"
                    }`}
                    aria-label={item.done ? "Erledigt aufheben" : "Als erledigt markieren"}
                  >
                    {item.done && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm ${
                        item.done
                          ? "text-gray-400 line-through"
                          : "text-gray-900"
                      }`}
                    >
                      {item.text}
                    </div>
                    {item.verantwortlich && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <User className="w-3 h-3" />
                        Verantwortlich: {item.verantwortlich}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(item)}
                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label="Schritt löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Neues Item */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2">
              <input
                type="text"
                className={inputClass}
                placeholder="Was ist als Nächstes zu tun?"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addItem();
                  }
                }}
              />
              <input
                type="text"
                className={inputClass}
                placeholder="Verantwortlich (z. B. OVL)"
                value={newItemVerantwortlich}
                onChange={(e) => setNewItemVerantwortlich(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addItem();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void addItem()}
              disabled={newItemText.trim().length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Schritt
            </button>
          </div>
        </Section>

        {/* 6. Meta */}
        <Section
          title="Übergabe-Meta"
          icon={<Calendar className="w-4 h-4 text-gray-600" />}
          iconColor="bg-gray-100"
          open={openSections.meta}
          onToggle={() => setOpenSections((s) => ({ ...s, meta: !s.meta }))}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Übergeben am">
              <DatePicker
                value={form.uebergebenAm ?? ""}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    uebergebenAm: v.length === 0 ? null : v,
                  }))
                }
              />
            </Field>
            <Field label="Übergeben von">
              <TextInput
                value={form.uebergebenVonId}
                onChange={(v) =>
                  setForm((f) => ({ ...f, uebergebenVonId: v }))
                }
                placeholder="Name oder Kürzel"
              />
            </Field>
            <Field label="Übernommen von">
              <TextInput
                value={form.uebernommenVonId}
                onChange={(v) =>
                  setForm((f) => ({ ...f, uebernommenVonId: v }))
                }
                placeholder="Name oder Kürzel"
              />
            </Field>
          </div>
          <Field label="Version">
            <TextInput
              value={form.version}
              onChange={(v) =>
                setForm((f) => ({ ...f, version: v ?? "1.0" }))
              }
              placeholder="z. B. 1.0"
            />
          </Field>
        </Section>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {hasBriefing ? (
              isDirty ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Ungespeicherte Änderungen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <Check className="w-3.5 h-3.5" />
                  Alle Änderungen gespeichert
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 text-gray-500">
                <FileText className="w-3.5 h-3.5" />
                Noch kein Steckbrief vorhanden
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty || saving}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Verwerfen
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Speichern
            </button>
          </div>
        </div>
      </div>

      {/* ConfirmDialog für Item-Delete */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Schritt löschen?"
        description={pendingDelete ? `„${pendingDelete.text}" wird unwiderruflich entfernt.` : undefined}
        confirmLabel="Löschen"
        destructive
        onConfirm={() => {
          if (pendingDelete) void removeItem(pendingDelete);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
