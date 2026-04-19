"use client";

// Detail-Seite eines Protokolls.
//
// Layout:
// - Kopf mit Zurueck-Link, Titel, Meta, Logo (Apricus Solar AG, Platzhalter)
// - Toolbar: Email-Text kopieren | Email aus System senden (disabled) | Loeschen
// - Teilnehmer-Box (editierbar via Klick)
// - Vorgaenger-Hinweis + "Offene Punkte aus Vorgaenger"-Panel (falls vorhanden)
// - Punkte-Tabelle mit Inline-Editing
// - Footer mit Legenden + Freigabe-Feldern
//
// UX-Regeln:
// - ConfirmDialog statt window.confirm
// - DatePicker statt native
// - Toast-Feedback
// - Escape / Cmd+S in Modals

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Mail,
  Trash2,
  Loader2,
  Plus,
  ClipboardList,
  GitBranch,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Circle,
  Tag,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import EmailPreviewModal from "@/components/meetings/EmailPreviewModal";
import TodoFromItemModal from "@/components/meetings/TodoFromItemModal";
import { normalizeDueDateText } from "@/lib/meetings/dateText";
import type {
  MeetingDetailDTO,
  MeetingItemCategory,
  MeetingItemDTO,
  MeetingItemStatus,
  MeetingParticipantDTO,
  MeetingSummaryDTO,
  ParticipantInput,
  UpdateMeetingInput,
  UpdateMeetingItemInput,
} from "@/lib/meetings/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

interface ProjectUser {
  id: string;
  name: string;
  email: string;
}

interface ApiMember {
  id: string;
  userId: string;
  user: ProjectUser;
}

interface ApiProject {
  id: string;
  name: string;
  managerId: string;
  manager: ProjectUser;
}

interface ApiHoliday {
  id: string;
  date: string;
  name: string;
}

const CATEGORY_OPTIONS: Array<{
  key: MeetingItemCategory;
  label: string;
}> = [
  { key: "B", label: "B – Beschluss" },
  { key: "E", label: "E – Empfehlung" },
  { key: "F", label: "F – Feststellung" },
  { key: "I", label: "I – Information" },
  { key: "A", label: "A – Arbeitsauftrag" },
];

const STATUS_OPTIONS: Array<{
  key: MeetingItemStatus;
  label: string;
  bg: string;
  text: string;
  Icon: typeof Circle;
}> = [
  {
    key: "OPEN",
    label: "Offen",
    bg: "bg-amber-100",
    text: "text-amber-700",
    Icon: Circle,
  },
  {
    key: "IN_PROGRESS",
    label: "In Bearbeitung",
    bg: "bg-blue-100",
    text: "text-blue-700",
    Icon: AlertCircle,
  },
  {
    key: "DONE",
    label: "Erledigt",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    Icon: CheckCircle2,
  },
];

function statusMeta(status: MeetingItemStatus) {
  return STATUS_OPTIONS.find((s) => s.key === status) ?? STATUS_OPTIONS[0];
}

function fmtDateDE(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toYMD(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

// ─── Participant-Helper ─────────────────────────────────────────────────────

function participantDisplayName(
  p: MeetingParticipantDTO,
  userLookup: Map<string, ProjectUser>,
): string {
  if (p.userId) {
    const u = userLookup.get(p.userId);
    if (u) return u.name;
  }
  return p.externalName ?? "—";
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ProtokollDetailPage() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = params.meetingId;
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<MeetingDetailDTO | null>(null);
  const [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]);
  const [project, setProject] = useState<ApiProject | null>(null);
  const [holidays, setHolidays] = useState<ApiHoliday[]>([]);
  const [previousMeetings, setPreviousMeetings] = useState<MeetingSummaryDTO[]>(
    [],
  );
  const [openFromPrev, setOpenFromPrev] = useState<MeetingItemDTO[]>([]);
  const [dismissedFromPrev, setDismissedFromPrev] = useState<Set<string>>(
    new Set(),
  );

  const [editingParticipants, setEditingParticipants] = useState(false);
  const [participantSelection, setParticipantSelection] = useState<Set<string>>(
    new Set(),
  );
  const [participantExtras, setParticipantExtras] = useState<string[]>([]);
  const [newExternalInput, setNewExternalInput] = useState("");
  const [savingParticipants, setSavingParticipants] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const [todoModalItem, setTodoModalItem] = useState<MeetingItemDTO | null>(
    null,
  );

  const [itemDeleteCandidate, setItemDeleteCandidate] =
    useState<MeetingItemDTO | null>(null);

  const userLookup = useMemo(() => {
    const m = new Map<string, ProjectUser>();
    for (const u of projectUsers) m.set(u.id, u);
    return m;
  }, [projectUsers]);

  // ─── Load ─────────────────────────────────────────────────────────────────

  const loadMeeting = useCallback(async () => {
    // lies erst den Meeting-Core, dann – sobald projectId bekannt ist –
    // den Projekt-Kontext.
    setLoading(true);
    try {
      // 1. Meeting holen, um projectId zu kriegen — dafuer brauchen wir den
      //    Pfad /api/projekte/[id]/protokolle/[meetingId]. Wir kennen aber
      //    die Projekt-ID noch nicht. Loesung: wir probieren ueber alle
      //    Projekte des Users -- nein: einfacher, via dediziertem
      //    Lookup: wir versuchen /api/protokolle/[meetingId] ... existiert
      //    nicht. Daher: wir ziehen zuerst die Projekte des Users und
      //    iterieren, bis wir das Meeting finden.
      const projRes = await fetch("/api/projekte");
      if (!projRes.ok) throw new Error("Konnte Projekte nicht laden");
      const allProjects = (await projRes.json()) as ApiProject[];

      let foundMeeting: MeetingDetailDTO | null = null;
      let foundProject: ApiProject | null = null;
      for (const p of allProjects) {
        const res = await fetch(
          `/api/projekte/${p.id}/protokolle/${meetingId}`,
        );
        if (res.ok) {
          foundMeeting = (await res.json()) as MeetingDetailDTO;
          foundProject = p;
          break;
        }
      }
      if (!foundMeeting || !foundProject) {
        toast({ title: "Protokoll nicht gefunden", variant: "error" });
        router.push("/protokolle");
        return;
      }

      setMeeting(foundMeeting);
      setProject(foundProject);

      // Parallel: Mitglieder des Projekts + Vorgaenger-Liste + Feiertage
      const [membersRes, meetingsRes, holidaysRes] = await Promise.all([
        fetch(`/api/projekte/${foundProject.id}/mitglieder`),
        fetch(`/api/projekte/${foundProject.id}/protokolle`),
        fetch(`/api/feiertage`),
      ]);

      let users: ProjectUser[] = [];
      if (membersRes.ok) {
        const data = (await membersRes.json()) as { members: ApiMember[] };
        users = data.members.map((m) => m.user);
      }
      // Manager einschieben, damit er als Option erscheint
      if (!users.some((u) => u.id === foundProject.manager.id)) {
        users = [foundProject.manager, ...users];
      }
      users.sort((a, b) => a.name.localeCompare(b.name));
      setProjectUsers(users);

      if (meetingsRes.ok) {
        const data = (await meetingsRes.json()) as {
          meetings: MeetingSummaryDTO[];
        };
        setPreviousMeetings(data.meetings.filter((m) => m.id !== meetingId));
      }

      if (holidaysRes.ok) {
        const data = (await holidaysRes.json()) as ApiHoliday[];
        setHolidays(data);
      }

      // Offene Punkte aus Vorgaenger laden (falls gesetzt)
      if (foundMeeting.previousMeetingId) {
        const openRes = await fetch(
          `/api/projekte/${foundProject.id}/protokolle/${meetingId}/open-items-from-previous`,
        );
        if (openRes.ok) {
          const data = (await openRes.json()) as { items: MeetingItemDTO[] };
          setOpenFromPrev(data.items);
        }
      } else {
        setOpenFromPrev([]);
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId, router, toast]);

  useEffect(() => {
    void loadMeeting();
  }, [loadMeeting]);

  // Participant-Edit-Mode: aktuelle Werte in State uebertragen
  useEffect(() => {
    if (!editingParticipants || !meeting) return;
    const sel = new Set<string>();
    const extras: string[] = [];
    for (const p of meeting.participants) {
      if (p.userId) sel.add(p.userId);
      else if (p.externalName) extras.push(p.externalName);
    }
    setParticipantSelection(sel);
    setParticipantExtras(extras);
    setNewExternalInput("");
  }, [editingParticipants, meeting]);

  // ─── Mutations ────────────────────────────────────────────────────────────

  async function patchMeeting(data: UpdateMeetingInput) {
    if (!project || !meeting) return;
    const res = await fetch(
      `/api/projekte/${project.id}/protokolle/${meeting.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        title: body.error ?? "Speichern fehlgeschlagen",
        variant: "error",
      });
      return;
    }
    toast({ title: "Gespeichert", variant: "success" });
    await loadMeeting();
  }

  async function patchItem(itemId: string, data: UpdateMeetingItemInput) {
    if (!project || !meeting) return;
    const res = await fetch(
      `/api/projekte/${project.id}/protokolle/${meeting.id}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        title: body.error ?? "Speichern fehlgeschlagen",
        variant: "error",
      });
      return;
    }
    // Optimistisch nur das geaenderte Item ersetzen, um kein Reload-Flackern
    // zu erzeugen.
    const updated = (await res.json()) as MeetingItemDTO;
    setMeeting((m) =>
      m
        ? { ...m, items: m.items.map((it) => (it.id === itemId ? updated : it)) }
        : m,
    );
  }

  async function addItem(overrides?: {
    description?: string;
    copiedFromItemId?: string | null;
  }) {
    if (!project || !meeting) return;
    const res = await fetch(
      `/api/projekte/${project.id}/protokolle/${meeting.id}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: overrides?.description ?? "Neuer Punkt",
          copiedFromItemId: overrides?.copiedFromItemId ?? null,
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        title: body.error ?? "Anlegen fehlgeschlagen",
        variant: "error",
      });
      return null;
    }
    const created = (await res.json()) as MeetingItemDTO;
    setMeeting((m) => (m ? { ...m, items: [...m.items, created] } : m));
    return created;
  }

  async function deleteItem(item: MeetingItemDTO) {
    if (!project || !meeting) return;
    const res = await fetch(
      `/api/projekte/${project.id}/protokolle/${meeting.id}/items/${item.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast({ title: "Loeschen fehlgeschlagen", variant: "error" });
      return;
    }
    setMeeting((m) =>
      m ? { ...m, items: m.items.filter((it) => it.id !== item.id) } : m,
    );
    toast({ title: "Punkt geloescht", variant: "success" });
  }

  async function takeOverOpenItem(item: MeetingItemDTO) {
    if (!project || !meeting) return;
    const created = await addItem({
      description: item.description,
      copiedFromItemId: item.id,
    });
    if (!created) return;
    // Patch title, category, responsible, dueDate -- damit der uebernommene
    // Punkt wirklich an den Vorgaenger anknuepft.
    await patchItem(created.id, {
      title: item.title,
      category: item.category,
      responsibleText: item.responsibleText,
      responsibleUserId: item.responsibleUserId,
      dueDate: toYMD(item.dueDate) || null,
      dueDateText: item.dueDateText,
    });
    setDismissedFromPrev((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    toast({ title: "Punkt uebernommen", variant: "success" });
  }

  async function takeOverAllOpen() {
    const remaining = openFromPrev.filter(
      (it) => !dismissedFromPrev.has(it.id),
    );
    for (const it of remaining) {
      await takeOverOpenItem(it);
    }
  }

  async function saveParticipants() {
    if (!project || !meeting) return;
    setSavingParticipants(true);
    try {
      const list: ParticipantInput[] = [];
      let idx = 0;
      for (const uid of participantSelection) {
        list.push({ userId: uid, orderIndex: idx++ });
      }
      for (const name of participantExtras) {
        list.push({ externalName: name, orderIndex: idx++ });
      }
      const res = await fetch(
        `/api/projekte/${project.id}/protokolle/${meeting.id}/participants`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants: list }),
        },
      );
      if (!res.ok) {
        toast({ title: "Teilnehmer nicht gespeichert", variant: "error" });
        return;
      }
      toast({ title: "Teilnehmer aktualisiert", variant: "success" });
      setEditingParticipants(false);
      await loadMeeting();
    } finally {
      setSavingParticipants(false);
    }
  }

  async function deleteMeeting() {
    if (!project || !meeting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projekte/${project.id}/protokolle/${meeting.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast({ title: "Loeschen fehlgeschlagen", variant: "error" });
        return;
      }
      toast({ title: "Protokoll geloescht", variant: "success" });
      router.push("/protokolle");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!meeting || !project) return null;

  const leader = meeting.leaderId ? userLookup.get(meeting.leaderId) : null;
  const scribe = meeting.scribeId ? userLookup.get(meeting.scribeId) : null;
  const previousMeeting = meeting.previousMeetingId
    ? previousMeetings.find((m) => m.id === meeting.previousMeetingId)
    : null;

  const visibleOpenFromPrev = openFromPrev.filter(
    (it) => !dismissedFromPrev.has(it.id),
  );

  const emailParticipants = meeting.participants.map((p) => ({
    userId: p.userId,
    externalName: p.externalName,
    displayName: participantDisplayName(p, userLookup),
  }));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Top: Back-Link */}
      <div className="mb-4">
        <Link
          href="/protokolle"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" /> Zurueck zu Protokollen
        </Link>
      </div>

      {/* Kopf */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                <GitBranch className="w-3 h-3" /> Rev. {meeting.revisionNumber}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  meeting.isInternal
                    ? "bg-blue-100 text-blue-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {meeting.isInternal ? "intern" : "extern"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 break-words">
              {meeting.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-4 h-4" /> {fmtDateDE(meeting.meetingDate)}
                {meeting.durationMinutes
                  ? ` · ${meeting.durationMinutes} min`
                  : ""}
              </span>
              {meeting.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {meeting.location}
                </span>
              )}
              {meeting.area && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="w-4 h-4" /> {meeting.area}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-gray-500">
                Projekt:{" "}
                <Link
                  href={`/projekte/${project.id}`}
                  className="text-gray-700 hover:text-emerald-700"
                >
                  {project.name}
                </Link>
              </span>
            </div>

            {/* Leitung / Protokollant */}
            <div className="flex items-center gap-4 mt-4">
              {leader && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center"
                    title={`Leitung: ${leader.name}`}
                  >
                    {initials(leader.name)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Leitung
                    <div className="text-gray-700 text-sm">{leader.name}</div>
                  </div>
                </div>
              )}
              {scribe && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center"
                    title={`Protokollant: ${scribe.name}`}
                  >
                    {initials(scribe.name)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Protokollant
                    <div className="text-gray-700 text-sm">{scribe.name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Apricus-Solar-Logo-Platzhalter */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center">
              A
            </div>
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-gray-900">
                Apricus Solar AG
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                Logo-Platzhalter
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setEmailModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
          >
            <Copy className="w-4 h-4" /> Email-Text kopieren
          </button>
          <button
            disabled
            title="Feature folgt"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-400 cursor-not-allowed"
          >
            <Mail className="w-4 h-4" /> Email aus System senden
          </button>

          <div className="ml-auto">
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm"
            >
              <Trash2 className="w-4 h-4" /> Protokoll loeschen
            </button>
          </div>
        </div>
      </div>

      {/* Teilnehmer-Box */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Teilnehmer ({meeting.participants.length})
            </h2>
          </div>
          {!editingParticipants ? (
            <button
              onClick={() => setEditingParticipants(true)}
              className="text-xs text-emerald-700 hover:text-emerald-800"
            >
              Bearbeiten
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingParticipants(false)}
                disabled={savingParticipants}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Abbrechen
              </button>
              <button
                onClick={() => void saveParticipants()}
                disabled={savingParticipants}
                className="inline-flex items-center gap-1 text-xs bg-emerald-600 text-white rounded-md px-2 py-1 hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingParticipants && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                Speichern
              </button>
            </div>
          )}
        </div>

        {!editingParticipants ? (
          meeting.participants.length === 0 ? (
            <p className="text-sm text-gray-400">Noch keine Teilnehmer.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {meeting.participants.map((p) => {
                const name = participantDisplayName(p, userLookup);
                return (
                  <span
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                      p.userId
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/70 text-[9px] font-semibold flex items-center justify-center">
                      {initials(name)}
                    </span>
                    {name}
                  </span>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-52 overflow-y-auto border border-gray-100 rounded-lg p-2">
              {projectUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    checked={participantSelection.has(u.id)}
                    onChange={() => {
                      setParticipantSelection((prev) => {
                        const next = new Set(prev);
                        if (next.has(u.id)) next.delete(u.id);
                        else next.add(u.id);
                        return next;
                      });
                    }}
                  />
                  <span className="text-gray-700">{u.name}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Externe Person hinzufuegen
              </label>
              <div className="flex gap-2">
                <input
                  value={newExternalInput}
                  onChange={(e) => setNewExternalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const n = newExternalInput.trim();
                      if (n && !participantExtras.includes(n)) {
                        setParticipantExtras((prev) => [...prev, n]);
                      }
                      setNewExternalInput("");
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Name"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = newExternalInput.trim();
                    if (n && !participantExtras.includes(n)) {
                      setParticipantExtras((prev) => [...prev, n]);
                    }
                    setNewExternalInput("");
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
                >
                  <Plus className="w-4 h-4" /> Hinzufuegen
                </button>
              </div>
              {participantExtras.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {participantExtras.map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                    >
                      {n}
                      <button
                        type="button"
                        onClick={() =>
                          setParticipantExtras((prev) =>
                            prev.filter((x) => x !== n),
                          )
                        }
                        className="text-gray-400 hover:text-red-500"
                        aria-label={`${n} entfernen`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vorgaenger-Hinweis */}
      {previousMeeting && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm text-blue-900 flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          Folgt auf:{" "}
          <Link
            href={`/protokolle/${previousMeeting.id}`}
            className="underline hover:text-blue-700"
          >
            {fmtDateDE(previousMeeting.meetingDate)} — {previousMeeting.title}
          </Link>
        </div>
      )}

      {/* Offene Punkte aus Vorgaenger */}
      {visibleOpenFromPrev.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Offene Punkte aus dem Vorgaenger-Protokoll (
              {visibleOpenFromPrev.length})
            </h2>
            <button
              onClick={() => void takeOverAllOpen()}
              className="text-xs text-emerald-700 hover:text-emerald-800"
            >
              Alle uebernehmen
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {visibleOpenFromPrev.map((it) => (
              <li key={it.id} className="py-2 flex items-center gap-3">
                {it.category && (
                  <span className="text-xs font-semibold text-gray-500 w-6">
                    {it.category}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 truncate">
                    {it.title ?? it.description}
                  </div>
                  {it.dueDate && (
                    <div className="text-xs text-gray-400">
                      faellig: {fmtDateDE(it.dueDate)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void takeOverOpenItem(it)}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-2 py-1"
                >
                  Uebernehmen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Punkte-Tabelle */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">
            Punkte ({meeting.items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-3 py-2 font-medium text-gray-500 w-10">Nr.</th>
                <th className="px-3 py-2 font-medium text-gray-500 w-24">Kat.</th>
                <th className="px-3 py-2 font-medium text-gray-500">Titel / Beschreibung</th>
                <th className="px-3 py-2 font-medium text-gray-500 w-36">Verantwortlich</th>
                <th className="px-3 py-2 font-medium text-gray-500 w-40">Termin</th>
                <th className="px-3 py-2 font-medium text-gray-500 w-32">Status</th>
                <th className="px-3 py-2 font-medium text-gray-500 w-24 text-right">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {meeting.items.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  users={projectUsers}
                  onUpdate={(data) => void patchItem(it.id, data)}
                  onDelete={() => setItemDeleteCandidate(it)}
                  onTakeOverAsTodo={() => setTodoModalItem(it)}
                />
              ))}
              {meeting.items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-sm text-gray-400"
                  >
                    Noch keine Punkte erfasst.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => void addItem()}
            className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800"
          >
            <Plus className="w-4 h-4" /> Punkt hinzufuegen
          </button>
        </div>
      </div>

      {/* Footer: Legenden + Freigabe */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600">
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">
              Ergebnis-Kategorien
            </h3>
            <ul className="space-y-1">
              <li>
                <span className="font-semibold">B</span> — Beschluss
              </li>
              <li>
                <span className="font-semibold">E</span> — Empfehlung
              </li>
              <li>
                <span className="font-semibold">F</span> — Feststellung
              </li>
              <li>
                <span className="font-semibold">I</span> — Information
              </li>
              <li>
                <span className="font-semibold">A</span> — Arbeitsauftrag
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Status</h3>
            <ul className="space-y-1">
              {STATUS_OPTIONS.map((s) => (
                <li key={s.key}>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}
                  >
                    <s.Icon className="w-3 h-3" /> {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Erarbeitet von
            </label>
            <input
              type="text"
              defaultValue={meeting.preparedByText ?? ""}
              onBlur={(e) =>
                void patchMeeting({
                  preparedByText: e.target.value.trim() || null,
                })
              }
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="z.B. Vom Lehn"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Geprueft von
            </label>
            <input
              type="text"
              defaultValue={meeting.approvedByText ?? ""}
              onBlur={(e) =>
                void patchMeeting({
                  approvedByText: e.target.value.trim() || null,
                })
              }
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="z.B. Czaja"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Freigabe-Datum
            </label>
            <DatePicker
              value={toYMD(meeting.approvedAt)}
              onChange={(v) =>
                void patchMeeting({ approvedAt: v ? v : null })
              }
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600">
            Revisions-Nummer
          </label>
          <input
            type="number"
            min={0}
            defaultValue={meeting.revisionNumber}
            onBlur={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(n) || n < 0) return;
              void patchMeeting({ revisionNumber: n });
            }}
            className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Modals */}
      <EmailPreviewModal
        open={emailModalOpen}
        meeting={meeting}
        projectName={project.name}
        scribeName={scribe?.name ?? null}
        participants={emailParticipants}
        holidays={holidays}
        onClose={() => setEmailModalOpen(false)}
      />

      <TodoFromItemModal
        open={todoModalItem !== null}
        projectId={project.id}
        meeting={meeting}
        item={todoModalItem}
        users={projectUsers}
        onClose={() => setTodoModalItem(null)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Protokoll loeschen?"
        description="Das Protokoll und alle Punkte werden unwiderruflich geloescht."
        confirmLabel="Loeschen"
        destructive
        loading={deleting}
        onConfirm={() => void deleteMeeting()}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={itemDeleteCandidate !== null}
        title="Punkt loeschen?"
        description="Dieser Punkt wird aus dem Protokoll entfernt."
        confirmLabel="Loeschen"
        destructive
        onConfirm={async () => {
          if (itemDeleteCandidate) {
            await deleteItem(itemDeleteCandidate);
          }
          setItemDeleteCandidate(null);
        }}
        onCancel={() => setItemDeleteCandidate(null)}
      />
    </div>
  );
}

// ─── ItemRow ───────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: MeetingItemDTO;
  users: ProjectUser[];
  onUpdate: (data: UpdateMeetingItemInput) => void;
  onDelete: () => void;
  onTakeOverAsTodo: () => void;
}

function ItemRow({
  item,
  users,
  onUpdate,
  onDelete,
  onTakeOverAsTodo,
}: ItemRowProps) {
  const s = statusMeta(item.status);
  const StatusIcon = s.Icon;

  // Dropdown: "Verantwortlich" -> User oder "(Freitext)"
  const userRespValue = item.responsibleUserId ?? "";
  const hasFreeText =
    !item.responsibleUserId && !!(item.responsibleText ?? "").trim();

  return (
    <tr className="border-b border-gray-50 align-top hover:bg-gray-50/40">
      <td className="px-3 py-2 text-gray-500 text-xs">{item.orderIndex + 1}</td>

      {/* Kategorie */}
      <td className="px-3 py-2">
        <select
          value={item.category ?? ""}
          onChange={(e) =>
            onUpdate({
              category:
                e.target.value === ""
                  ? null
                  : (e.target.value as MeetingItemCategory),
            })
          }
          className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">—</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </td>

      {/* Titel + Beschreibung */}
      <td className="px-3 py-2">
        <input
          type="text"
          defaultValue={item.title ?? ""}
          onBlur={(e) =>
            onUpdate({ title: e.target.value.trim() || null })
          }
          placeholder="Kurz-Titel (optional)"
          className="w-full px-2 py-1 mb-1 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded text-sm font-medium focus:outline-none"
        />
        <textarea
          defaultValue={item.description}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) return; // description ist Pflicht
            onUpdate({ description: v });
          }}
          rows={2}
          placeholder="Beschreibung"
          className="w-full px-2 py-1 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded text-sm text-gray-700 focus:outline-none resize-none"
        />
      </td>

      {/* Verantwortlich */}
      <td className="px-3 py-2 space-y-1">
        <select
          value={userRespValue}
          onChange={(e) =>
            onUpdate({
              responsibleUserId: e.target.value || null,
              // wenn User gesetzt wird, Freitext leeren
              responsibleText: e.target.value ? null : item.responsibleText,
            })
          }
          className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">— User —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          defaultValue={item.responsibleText ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim();
            onUpdate({
              responsibleText: v || null,
              // Freitext setzen = User-Bindung lösen
              responsibleUserId: v ? null : item.responsibleUserId,
            });
          }}
          placeholder="Freitext (z.B. SJM)"
          className={`w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
            hasFreeText ? "bg-amber-50" : ""
          }`}
        />
      </td>

      {/* Termin: DatePicker + Freitext-Option */}
      <td className="px-3 py-2 space-y-1">
        <DatePicker
          value={toYMD(item.dueDate)}
          onChange={(v) => onUpdate({ dueDate: v || null })}
        />
        <input
          type="text"
          defaultValue={item.dueDateText ?? ""}
          onBlur={(e) => {
            // KW/Q-Normalisierung: "KW 08", "Kw8", "KW 8/26" → "KW8" bzw.
            // "KW8/26". Rohtext bleibt, wenn kein Pattern matcht.
            const raw = e.target.value;
            const normalized = normalizeDueDateText(raw);
            // Sichtbar im Feld ersetzen, damit der User sieht, was gespeichert wird
            if (normalized !== raw) e.target.value = normalized;
            onUpdate({ dueDateText: normalized || null });
          }}
          placeholder="o. Freitext: KW 8, Q1/26"
          className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </td>

      {/* Status */}
      <td className="px-3 py-2">
        <div className="relative">
          <select
            value={item.status}
            onChange={(e) =>
              onUpdate({ status: e.target.value as MeetingItemStatus })
            }
            className={`appearance-none w-full pl-6 pr-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${s.bg} ${s.text}`}
          >
            {STATUS_OPTIONS.map((o) => (
              <option
                key={o.key}
                value={o.key}
                className="bg-white text-gray-900"
              >
                {o.label}
              </option>
            ))}
          </select>
          <StatusIcon
            className={`w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 ${s.text}`}
          />
        </div>
      </td>

      {/* Aktionen */}
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onTakeOverAsTodo}
            title="Als ToDo uebernehmen"
            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title="Loeschen"
            className="p-1.5 rounded hover:bg-red-50 text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
