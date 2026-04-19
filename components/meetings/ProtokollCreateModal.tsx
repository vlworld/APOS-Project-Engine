"use client";

// Create-Modal fuer ein neues Protokoll.
// - Escape schliesst, Ctrl/Cmd+S speichert.
// - Datumsfeld via <DatePicker> (nie native).
// - Body-Scroll-Lock, Klick auf Backdrop schliesst.
// - Nach Speichern: Redirect zu /protokolle/[meetingId].

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Plus, Trash2, Video, MapPin, Building2, Briefcase, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import type {
  CreateMeetingInput,
  MeetingDetailDTO,
  MeetingParticipantDTO,
  MeetingSummaryDTO,
  ParticipantInput,
} from "@/lib/meetings/types";

// Apricus-Default-Adresse — hart verdrahtet, solange Organization.address
// als UI-Feld noch nicht gepflegt werden kann.
const APRICUS_ADDRESS = "Apricus Solar AG, Dortmund";

// ─── Helper-Types ──────────────────────────────────────────────────────────

interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
}

interface ProjectManagerUser {
  id: string;
  name: string;
  email: string;
}

interface ApiMember {
  id: string;
  userId: string;
  user: ProjectMemberUser;
  role: "READ" | "WRITE";
}

interface ApiCustomer {
  id: string;
  companyName: string;
  street: string | null;
  zipCode: string | null;
  city: string | null;
}

interface ApiProject {
  id: string;
  name: string;
  manager: ProjectManagerUser;
  managerId: string;
  address: string | null;
  clientName: string | null;
  customer: ApiCustomer | null;
}

// Suggestion = User, der in einem vorherigen Meeting mit gleichem Titel
// teilgenommen hat (aggregiert ueber alle Treffer).
interface ParticipantSuggestion {
  userId: string;
  name: string;
}

interface ProtokollCreateModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
}

function todayYMD(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function ProtokollCreateModal({
  open,
  projectId,
  onClose,
}: ProtokollCreateModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);

  // Formular-State
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<string>(todayYMD());
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [leaderId, setLeaderId] = useState<string>("");
  const [scribeId, setScribeId] = useState<string>("");
  const [previousMeetingId, setPreviousMeetingId] = useState<string>("");

  // Projekt-User + existierende Protokolle
  const [projectUsers, setProjectUsers] = useState<ProjectMemberUser[]>([]);
  const [previousMeetings, setPreviousMeetings] = useState<MeetingSummaryDTO[]>(
    [],
  );
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loadingData, setLoadingData] = useState(false);

  // Ort-Quick-Add-Daten aus dem Projekt (address + customer)
  const [projectAddress, setProjectAddress] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");

  // Teilnehmer-Vorschlaege: User, die in Meetings mit gleichem Titel dabei waren
  const [suggestedParticipants, setSuggestedParticipants] = useState<
    ParticipantSuggestion[]
  >([]);

  // Teilnehmer (Checkbox-Liste + externe Freitext-Eintraege)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [externalParticipants, setExternalParticipants] = useState<string[]>(
    [],
  );
  const [externalInput, setExternalInput] = useState("");

  const [saving, setSaving] = useState(false);

  // Teilnehmer-Vorschlaege: bei title-Change schauen, ob es Vorgaenger-Meetings
  // mit dem gleichen Titel (case-insensitive) gibt, deren Teilnehmer wir dann
  // als Quick-Add-Vorschlaege anzeigen. Debounced, damit nicht jeder Tastenanschlag
  // einen Fetch ausloest.
  useEffect(() => {
    const needle = title.trim().toLowerCase();
    if (!needle || previousMeetings.length === 0) {
      setSuggestedParticipants([]);
      return;
    }
    const matches = previousMeetings.filter(
      (m) => m.title.trim().toLowerCase() === needle,
    );
    if (matches.length === 0) {
      setSuggestedParticipants([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        // Participants pro Match-Meeting laden, dann aggregieren
        const details = await Promise.all(
          matches.map((m) =>
            fetch(`/api/projekte/${projectId}/protokolle/${m.id}`).then((r) =>
              r.ok ? r.json() : null,
            ),
          ),
        );
        if (cancelled) return;
        const byUserId = new Map<string, ParticipantSuggestion>();
        // Name-Lookup via projectUsers (enthaelt mindestens Name + Email)
        const userNameById = new Map<string, string>();
        for (const u of projectUsers) userNameById.set(u.id, u.name);
        for (const d of details) {
          if (!d || !Array.isArray(d.participants)) continue;
          for (const p of d.participants as MeetingParticipantDTO[]) {
            if (p.userId && !byUserId.has(p.userId)) {
              byUserId.set(p.userId, {
                userId: p.userId,
                name: userNameById.get(p.userId) ?? "Teilnehmer",
              });
            }
          }
        }
        setSuggestedParticipants(Array.from(byUserId.values()));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [title, previousMeetings, projectId, projectUsers]);

  // Vorschläge, die noch nicht ausgewählt sind (gefiltert für die UI)
  const unselectedSuggestions = useMemo(
    () => suggestedParticipants.filter((s) => !selectedUserIds.has(s.userId)),
    [suggestedParticipants, selectedUserIds],
  );

  // Reset beim Oeffnen
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setMeetingDate(todayYMD());
    setDurationMinutes("");
    setLocation("");
    setArea("");
    setIsInternal(true);
    setLeaderId("");
    setScribeId("");
    setPreviousMeetingId("");
    setSelectedUserIds(new Set());
    setExternalParticipants([]);
    setExternalInput("");
  }, [open]);

  // Projekt-Daten laden (Mitglieder + aktueller User + frühere Protokolle)
  const loadProjectContext = useCallback(async () => {
    if (!projectId) return;
    setLoadingData(true);
    try {
      const [membersRes, projectRes, sessionRes, meetingsRes] =
        await Promise.all([
          fetch(`/api/projekte/${projectId}/mitglieder`),
          fetch(`/api/projekte/${projectId}`),
          fetch("/api/auth/session"),
          fetch(`/api/projekte/${projectId}/protokolle`),
        ]);

      let users: ProjectMemberUser[] = [];
      let projectManagerId: string | null = null;
      let projectManager: ProjectManagerUser | null = null;
      if (projectRes.ok) {
        const proj = (await projectRes.json()) as Partial<ApiProject>;
        if (proj.manager) projectManager = proj.manager;
        if (typeof proj.managerId === "string") projectManagerId = proj.managerId;
        // Baustellen-Adresse (aus Project.address)
        setProjectAddress(proj.address?.trim() ?? "");
        // Kunden-Adresse: companyName + Straße + PLZ/Ort, wenn vorhanden
        if (proj.customer) {
          const c = proj.customer;
          const parts = [
            c.companyName,
            c.street,
            [c.zipCode, c.city].filter(Boolean).join(" ").trim() || null,
          ].filter((s): s is string => Boolean(s && s.trim()));
          setCustomerAddress(parts.join(", "));
        } else if (proj.clientName) {
          // Fallback auf legacy clientName
          setCustomerAddress(proj.clientName);
        } else {
          setCustomerAddress("");
        }
      }
      if (membersRes.ok) {
        const data = (await membersRes.json()) as { members: ApiMember[] };
        users = data.members.map((m) => m.user);
      }
      // Projekt-Manager einschieben, damit er auch waehlbar ist
      if (projectManager && !users.some((u) => u.id === projectManager!.id)) {
        users = [projectManager, ...users];
      }
      // Sortieren nach Name
      users.sort((a, b) => a.name.localeCompare(b.name));
      setProjectUsers(users);

      if (sessionRes.ok) {
        const sess = (await sessionRes.json()) as {
          user?: { id?: string };
        };
        if (sess?.user?.id) {
          setCurrentUserId(sess.user.id);
          setScribeId(sess.user.id);
        }
      }
      if (projectManagerId) {
        setLeaderId((cur) => cur || projectManagerId!);
      }

      if (meetingsRes.ok) {
        const data = (await meetingsRes.json()) as {
          meetings: MeetingSummaryDTO[];
        };
        setPreviousMeetings(data.meetings);
      }
    } finally {
      setLoadingData(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void loadProjectContext();
  }, [open, loadProjectContext]);

  // Escape + Ctrl/Cmd+S
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!saving) onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  // Body-Scroll-Lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function toggleUserParticipant(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function addExternalParticipant() {
    const name = externalInput.trim();
    if (!name) return;
    if (externalParticipants.includes(name)) {
      setExternalInput("");
      return;
    }
    setExternalParticipants((prev) => [...prev, name]);
    setExternalInput("");
  }

  function removeExternalParticipant(name: string) {
    setExternalParticipants((prev) => prev.filter((n) => n !== name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Thema fehlt", variant: "error" });
      return;
    }
    if (!meetingDate) {
      toast({ title: "Datum waehlen", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<CreateMeetingInput, "projectId"> = {
        title: title.trim(),
        meetingDate,
        durationMinutes: durationMinutes
          ? Number.parseInt(durationMinutes, 10)
          : null,
        location: location.trim() || null,
        area: area.trim() || null,
        isInternal,
        leaderId: leaderId || null,
        scribeId: scribeId || null,
        previousMeetingId: previousMeetingId || null,
      };

      const res = await fetch(`/api/projekte/${projectId}/protokolle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast({
          title: body.error ?? "Speichern fehlgeschlagen",
          variant: "error",
        });
        return;
      }
      const created = (await res.json()) as MeetingDetailDTO;

      // Teilnehmer anlegen (wenn welche ausgewaehlt)
      const participantsToSet: ParticipantInput[] = [];
      let idx = 0;
      for (const uid of selectedUserIds) {
        participantsToSet.push({ userId: uid, orderIndex: idx++ });
      }
      for (const ext of externalParticipants) {
        participantsToSet.push({ externalName: ext, orderIndex: idx++ });
      }
      if (participantsToSet.length > 0) {
        await fetch(
          `/api/projekte/${projectId}/protokolle/${created.id}/participants`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participants: participantsToSet }),
          },
        );
      }

      toast({ title: "Protokoll angelegt", variant: "success" });
      onClose();
      router.push(`/protokolle/${created.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // aktueller User zuerst referenzieren, damit Linter nicht motzt
  void currentUserId;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">
            Neues Protokoll
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Thema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Thema <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="z.B. PV-Anlage Nottuln"
              autoFocus
              required
            />
          </div>

          {/* Datum + Dauer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={meetingDate}
                onChange={(v) => setMeetingDate(v)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zeitspanne (min)
              </label>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="z.B. 60"
              />
            </div>
          </div>

          {/* Ort + Bereich */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ort
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Teams, Büro Ennepetal, …"
              />
              {/* Quick-Adds für häufige Orte */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => setLocation("Teams")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                  title="Virtuelles Meeting (Teams, Meet)"
                >
                  <Video className="w-3 h-3" />
                  Virtuell
                </button>
                <button
                  type="button"
                  onClick={() => projectAddress && setLocation(projectAddress)}
                  disabled={!projectAddress}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    projectAddress
                      ? `Baustellen-Adresse: ${projectAddress}`
                      : "Keine Baustellen-Adresse am Projekt hinterlegt"
                  }
                >
                  <MapPin className="w-3 h-3" />
                  Baustelle
                </button>
                <button
                  type="button"
                  onClick={() => customerAddress && setLocation(customerAddress)}
                  disabled={!customerAddress}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={
                    customerAddress
                      ? `Kunden-Adresse: ${customerAddress}`
                      : "Kein Kunde am Projekt hinterlegt"
                  }
                >
                  <Building2 className="w-3 h-3" />
                  Kunde
                </button>
                <button
                  type="button"
                  onClick={() => setLocation(APRICUS_ADDRESS)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                  title={APRICUS_ADDRESS}
                >
                  <Briefcase className="w-3 h-3" />
                  Apricus
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bereich
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="optional"
              />
            </div>
          </div>

          {/* Intern / Extern Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Art
            </label>
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setIsInternal(true)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  isInternal
                    ? "bg-white shadow text-gray-900 font-medium"
                    : "text-gray-500"
                }`}
              >
                Intern
              </button>
              <button
                type="button"
                onClick={() => setIsInternal(false)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  !isInternal
                    ? "bg-white shadow text-gray-900 font-medium"
                    : "text-gray-500"
                }`}
              >
                Extern
              </button>
            </div>
          </div>

          {/* Leitung + Protokollant */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Leitung
              </label>
              <select
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">— keine —</option>
                {projectUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protokollant
              </label>
              <select
                value={scribeId}
                onChange={(e) => setScribeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">— keiner —</option>
                {projectUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vorgaenger-Protokoll */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vorgaenger-Protokoll
            </label>
            <select
              value={previousMeetingId}
              onChange={(e) => setPreviousMeetingId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— keines —</option>
              {previousMeetings.map((m) => {
                const d = new Date(m.meetingDate).toLocaleDateString("de-DE");
                return (
                  <option key={m.id} value={m.id}>
                    {d} — {m.title}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Teilnehmer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Teilnehmer
            </label>
            {/* Vorschläge aus Meetings mit gleichem Titel */}
            {unselectedSuggestions.length > 0 && (
              <div className="mb-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
                <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-blue-700">
                  <UserPlus className="w-3 h-3" />
                  <span className="font-medium">
                    Vorschläge aus früheren „{title.trim()}"-Meetings:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {unselectedSuggestions.map((s) => (
                    <button
                      key={s.userId}
                      type="button"
                      onClick={() => toggleUserParticipant(s.userId)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-blue-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loadingData ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" /> Lade Projekt-Kontext …
              </div>
            ) : (
              <>
                {projectUsers.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Keine Projekt-Mitglieder — Teilnehmer koennen spaeter
                    ergaenzt werden.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
                    {projectUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-sm px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleUserParticipant(u.id)}
                        />
                        <span className="text-gray-700">{u.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {/* Externe Person hinzufuegen */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">
                    Externe Person hinzufuegen
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={externalInput}
                      onChange={(e) => setExternalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addExternalParticipant();
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="z.B. Hr. Sprenger (Firma X)"
                    />
                    <button
                      type="button"
                      onClick={addExternalParticipant}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
                    >
                      <Plus className="w-4 h-4" /> Hinzufuegen
                    </button>
                  </div>
                  {externalParticipants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {externalParticipants.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => removeExternalParticipant(name)}
                            className="text-gray-400 hover:text-red-500"
                            aria-label={`${name} entfernen`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !meetingDate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Protokoll anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
