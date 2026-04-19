/**
 * Service-Layer für Protokolle (Meetings) + MeetingItems + Participants.
 *
 * Reine Server-Logik. Keine fetch/localStorage/Toast-Calls. Alle Queries sind
 * strikt auf `projectId` bzw. `organizationId` gescopt. Aufrufer (API-Route)
 * stellt via `requireProjectAccess` vorab sicher, dass der User Zugriff auf
 * das Projekt hat.
 *
 * Konvention für Datums-Strings:
 *   - Input: "YYYY-MM-DD" (lokales Datum) ODER voller ISO-String
 *   - Output (DTO): ISO-String über `.toISOString()`
 */

import type {
  Meeting,
  MeetingItem,
  MeetingParticipant,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateMeetingInput,
  CreateMeetingItemInput,
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
import { normalizeDueDateText } from "@/lib/meetings/dateText";

// ---------------------------------------------------------------------------
// Date-Helper (kopiert aus terminplan/service.ts, bewusst lokal)
// ---------------------------------------------------------------------------

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}/;

function parseDateInput(input: string): Date {
  if (!DATE_KEY_RE.test(input)) {
    throw new Error(`Ungültiges Datumsformat (erwartet YYYY-MM-DD): ${input}`);
  }
  const [y, m, d] = input.slice(0, 10).split("-").map((n) => Number(n));
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    throw new Error(`Ungültiges Datum: ${input}`);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Nimmt Input "YYYY-MM-DD" oder vollständigen ISO-String. */
function parseDateOrIso(input: string): Date {
  if (DATE_KEY_RE.test(input) && input.length === 10) {
    return parseDateInput(input);
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Ungültiges Datum: ${input}`);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Validierung (Status / Category)
// ---------------------------------------------------------------------------

function isMeetingItemStatus(s: unknown): s is MeetingItemStatus {
  return s === "OPEN" || s === "IN_PROGRESS" || s === "DONE";
}

function isMeetingItemCategory(s: unknown): s is MeetingItemCategory {
  return s === "B" || s === "E" || s === "F" || s === "I" || s === "A";
}

// ---------------------------------------------------------------------------
// DTO-Mapping
// ---------------------------------------------------------------------------

function toParticipantDTO(row: MeetingParticipant): MeetingParticipantDTO {
  return {
    id: row.id,
    meetingId: row.meetingId,
    userId: row.userId,
    externalName: row.externalName,
    roleText: row.roleText,
    orderIndex: row.orderIndex,
  };
}

function toMeetingItemDTO(row: MeetingItem): MeetingItemDTO {
  return {
    id: row.id,
    meetingId: row.meetingId,
    orderIndex: row.orderIndex,
    category: (row.category as MeetingItemCategory | null) ?? null,
    title: row.title,
    description: row.description,
    responsibleText: row.responsibleText,
    responsibleUserId: row.responsibleUserId,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    dueDateText: row.dueDateText,
    status: (row.status as MeetingItemStatus) ?? "OPEN",
    copiedFromItemId: row.copiedFromItemId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMeetingSummary(
  row: Meeting,
  itemCount: number,
  participantCount: number,
): MeetingSummaryDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    meetingDate: row.meetingDate.toISOString(),
    durationMinutes: row.durationMinutes,
    location: row.location,
    area: row.area,
    isInternal: row.isInternal,
    leaderId: row.leaderId,
    scribeId: row.scribeId,
    previousMeetingId: row.previousMeetingId,
    preparedByText: row.preparedByText,
    approvedByText: row.approvedByText,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    revisionNumber: row.revisionNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemCount,
    participantCount,
  };
}

// ---------------------------------------------------------------------------
// Org-Scope-Helper
// ---------------------------------------------------------------------------

/**
 * Lädt das Meeting inklusive Project-organizationId und stellt sicher, dass
 * es zur übergebenen Organisation gehört. Gibt `null` bei Miss (kein Meeting,
 * oder andere Org).
 */
async function findMeetingInOrg(
  meetingId: string,
  organizationId: string,
): Promise<Meeting | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, project: { organizationId } },
  });
  return meeting;
}

/**
 * Lädt ein MeetingItem und prüft per Join, dass es zur richtigen Organisation
 * gehört. Gibt `null` bei Miss.
 */
async function findMeetingItemInOrg(
  itemId: string,
  organizationId: string,
): Promise<MeetingItem | null> {
  const item = await prisma.meetingItem.findFirst({
    where: {
      id: itemId,
      meeting: { project: { organizationId } },
    },
  });
  return item;
}

// ---------------------------------------------------------------------------
// User-Validierung (im Org-Scope)
// ---------------------------------------------------------------------------

async function assertUserInOrg(
  userId: string,
  organizationId: string,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true },
  });
  if (!user) {
    throw new Error("Nutzer nicht gefunden oder gehört nicht zur Organisation");
  }
}

// ---------------------------------------------------------------------------
// Meetings: List / Detail
// ---------------------------------------------------------------------------

/**
 * Listet Protokolle eines Projekts (ohne Items/Participants; nur Counts).
 * Sortiert nach meetingDate absteigend (neueste oben).
 */
export async function listProjectMeetings(
  projectId: string,
): Promise<MeetingSummaryDTO[]> {
  const meetings = await prisma.meeting.findMany({
    where: { projectId },
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { items: true, participants: true } },
    },
  });
  return meetings.map((m) =>
    toMeetingSummary(m, m._count.items, m._count.participants),
  );
}

/**
 * Lädt ein Protokoll inkl. Teilnehmer und Punkte.
 * Gibt `null`, wenn Meeting nicht existiert oder nicht zur Organisation gehört.
 */
export async function getMeetingDetail(
  meetingId: string,
  organizationId: string,
): Promise<MeetingDetailDTO | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, project: { organizationId } },
    include: {
      participants: { orderBy: [{ orderIndex: "asc" }] },
      items: { orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }] },
      _count: { select: { items: true, participants: true } },
    },
  });
  if (!meeting) return null;

  const summary = toMeetingSummary(
    meeting,
    meeting._count.items,
    meeting._count.participants,
  );

  return {
    ...summary,
    participants: meeting.participants.map(toParticipantDTO),
    items: meeting.items.map(toMeetingItemDTO),
  };
}

// ---------------------------------------------------------------------------
// Meetings: Create / Update / Delete
// ---------------------------------------------------------------------------

export async function createMeeting(
  input: CreateMeetingInput,
  organizationId: string,
): Promise<MeetingSummaryDTO> {
  const title = input.title?.trim();
  if (!title) throw new Error("Titel darf nicht leer sein");

  if (typeof input.meetingDate !== "string" || !input.meetingDate) {
    throw new Error("meetingDate ist erforderlich (YYYY-MM-DD)");
  }
  const meetingDate = parseDateOrIso(input.meetingDate);

  // Projekt muss zur Organisation gehören.
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, organizationId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Projekt nicht gefunden");
  }

  // Referenzen validieren (alle optional).
  if (input.leaderId) await assertUserInOrg(input.leaderId, organizationId);
  if (input.scribeId) await assertUserInOrg(input.scribeId, organizationId);
  if (input.previousMeetingId) {
    const prev = await prisma.meeting.findFirst({
      where: {
        id: input.previousMeetingId,
        projectId: input.projectId,
      },
      select: { id: true },
    });
    if (!prev) {
      throw new Error("Vorgänger-Protokoll nicht gefunden oder nicht im selben Projekt");
    }
  }

  if (
    input.durationMinutes !== undefined &&
    input.durationMinutes !== null &&
    (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0)
  ) {
    throw new Error("durationMinutes muss >= 0 sein");
  }

  const approvedAt = input.approvedAt ? parseDateOrIso(input.approvedAt) : null;

  const created = await prisma.meeting.create({
    data: {
      projectId: input.projectId,
      title,
      meetingDate,
      durationMinutes: input.durationMinutes ?? null,
      location: input.location?.trim() || null,
      area: input.area?.trim() || null,
      isInternal: input.isInternal ?? true,
      leaderId: input.leaderId ?? null,
      scribeId: input.scribeId ?? null,
      previousMeetingId: input.previousMeetingId ?? null,
      preparedByText: input.preparedByText?.trim() || null,
      approvedByText: input.approvedByText?.trim() || null,
      approvedAt,
      revisionNumber: input.revisionNumber ?? 0,
    },
    include: { _count: { select: { items: true, participants: true } } },
  });

  return toMeetingSummary(created, created._count.items, created._count.participants);
}

export async function updateMeeting(
  meetingId: string,
  input: UpdateMeetingInput,
  organizationId: string,
): Promise<MeetingSummaryDTO | null> {
  const existing = await findMeetingInOrg(meetingId, organizationId);
  if (!existing) return null;

  const data: Prisma.MeetingUpdateInput = {};

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (!trimmed) throw new Error("Titel darf nicht leer sein");
    data.title = trimmed;
  }

  if (input.meetingDate !== undefined) {
    data.meetingDate = parseDateOrIso(input.meetingDate);
  }

  if (input.durationMinutes !== undefined) {
    if (input.durationMinutes === null) {
      data.durationMinutes = null;
    } else {
      if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0) {
        throw new Error("durationMinutes muss >= 0 sein");
      }
      data.durationMinutes = Math.trunc(input.durationMinutes);
    }
  }

  if (input.location !== undefined) {
    data.location = input.location?.trim() || null;
  }
  if (input.area !== undefined) {
    data.area = input.area?.trim() || null;
  }
  if (input.isInternal !== undefined) {
    data.isInternal = input.isInternal;
  }

  if (input.leaderId !== undefined) {
    if (input.leaderId === null) {
      data.leader = { disconnect: true };
    } else {
      await assertUserInOrg(input.leaderId, organizationId);
      data.leader = { connect: { id: input.leaderId } };
    }
  }

  if (input.scribeId !== undefined) {
    if (input.scribeId === null) {
      data.scribe = { disconnect: true };
    } else {
      await assertUserInOrg(input.scribeId, organizationId);
      data.scribe = { connect: { id: input.scribeId } };
    }
  }

  if (input.previousMeetingId !== undefined) {
    if (input.previousMeetingId === null) {
      data.previousMeeting = { disconnect: true };
    } else {
      if (input.previousMeetingId === meetingId) {
        throw new Error("Meeting kann nicht sein eigener Vorgänger sein");
      }
      const prev = await prisma.meeting.findFirst({
        where: {
          id: input.previousMeetingId,
          projectId: existing.projectId,
        },
        select: { id: true },
      });
      if (!prev) {
        throw new Error("Vorgänger-Protokoll nicht gefunden oder nicht im selben Projekt");
      }
      data.previousMeeting = { connect: { id: input.previousMeetingId } };
    }
  }

  if (input.preparedByText !== undefined) {
    data.preparedByText = input.preparedByText?.trim() || null;
  }
  if (input.approvedByText !== undefined) {
    data.approvedByText = input.approvedByText?.trim() || null;
  }
  if (input.approvedAt !== undefined) {
    data.approvedAt = input.approvedAt ? parseDateOrIso(input.approvedAt) : null;
  }
  if (input.revisionNumber !== undefined) {
    if (!Number.isFinite(input.revisionNumber) || input.revisionNumber < 0) {
      throw new Error("revisionNumber muss >= 0 sein");
    }
    data.revisionNumber = Math.trunc(input.revisionNumber);
  }

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data,
    include: { _count: { select: { items: true, participants: true } } },
  });

  return toMeetingSummary(updated, updated._count.items, updated._count.participants);
}

export async function deleteMeeting(
  meetingId: string,
  organizationId: string,
): Promise<boolean> {
  const existing = await findMeetingInOrg(meetingId, organizationId);
  if (!existing) return false;
  await prisma.meeting.delete({ where: { id: meetingId } });
  return true;
}

// ---------------------------------------------------------------------------
// Offene Punkte vom Vorgänger-Protokoll
// ---------------------------------------------------------------------------

/**
 * Gibt die MeetingItems des Vorgänger-Protokolls zurück, deren Status != DONE
 * ist. Use-Case: UI bietet „aus Vorgänger übernehmen" an.
 */
export async function listOpenItemsFromPreviousMeeting(
  meetingId: string,
  organizationId: string,
): Promise<MeetingItemDTO[]> {
  const meeting = await findMeetingInOrg(meetingId, organizationId);
  if (!meeting) {
    throw new Error("Protokoll nicht gefunden");
  }
  if (!meeting.previousMeetingId) return [];

  // Sicherstellen, dass der Vorgänger in derselben Organisation liegt.
  const prev = await findMeetingInOrg(meeting.previousMeetingId, organizationId);
  if (!prev) return [];

  const items = await prisma.meetingItem.findMany({
    where: {
      meetingId: meeting.previousMeetingId,
      NOT: { status: "DONE" },
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });

  return items.map(toMeetingItemDTO);
}

// ---------------------------------------------------------------------------
// MeetingItems: Add / Update / Delete / Reorder
// ---------------------------------------------------------------------------

export async function addMeetingItem(
  meetingId: string,
  input: CreateMeetingItemInput,
  organizationId: string,
): Promise<MeetingItemDTO> {
  const meeting = await findMeetingInOrg(meetingId, organizationId);
  if (!meeting) {
    throw new Error("Protokoll nicht gefunden");
  }

  const description = input.description?.trim();
  if (!description) {
    throw new Error("Beschreibung darf nicht leer sein");
  }

  if (input.category !== undefined && input.category !== null) {
    if (!isMeetingItemCategory(input.category)) {
      throw new Error("Ungültige Kategorie (erlaubt: B, E, F, I, A)");
    }
  }

  const status: MeetingItemStatus = isMeetingItemStatus(input.status)
    ? input.status
    : "OPEN";

  if (input.responsibleUserId) {
    await assertUserInOrg(input.responsibleUserId, organizationId);
  }

  let copiedFromItemId: string | null = null;
  if (input.copiedFromItemId) {
    const source = await findMeetingItemInOrg(input.copiedFromItemId, organizationId);
    if (!source) {
      throw new Error("Quell-Item für Kopie nicht gefunden");
    }
    copiedFromItemId = source.id;
  }

  // orderIndex: wenn nicht gesetzt, ans Ende.
  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const lastOrder = await prisma.meetingItem.aggregate({
      where: { meetingId },
      _max: { orderIndex: true },
    });
    orderIndex = (lastOrder._max.orderIndex ?? -1) + 1;
  }

  const dueDate = input.dueDate ? parseDateOrIso(input.dueDate) : null;

  const created = await prisma.meetingItem.create({
    data: {
      meetingId,
      orderIndex,
      category: input.category ?? null,
      title: input.title?.trim() || null,
      description,
      responsibleText: input.responsibleText?.trim() || null,
      responsibleUserId: input.responsibleUserId ?? null,
      dueDate,
      // Freitext-Termin wird normalisiert (z.B. "KW 08" → "KW8"), damit
      // spaeter beim Transfer zu Arbeitspaketen/ToDos einheitlich ist.
      dueDateText: normalizeDueDateText(input.dueDateText) || null,
      status,
      copiedFromItemId,
    },
  });

  return toMeetingItemDTO(created);
}

export async function updateMeetingItem(
  itemId: string,
  input: UpdateMeetingItemInput,
  organizationId: string,
): Promise<MeetingItemDTO | null> {
  const existing = await findMeetingItemInOrg(itemId, organizationId);
  if (!existing) return null;

  const data: Prisma.MeetingItemUpdateInput = {};

  if (input.description !== undefined) {
    const trimmed = input.description.trim();
    if (!trimmed) throw new Error("Beschreibung darf nicht leer sein");
    data.description = trimmed;
  }

  if (input.category !== undefined) {
    if (input.category === null) {
      data.category = null;
    } else {
      if (!isMeetingItemCategory(input.category)) {
        throw new Error("Ungültige Kategorie (erlaubt: B, E, F, I, A)");
      }
      data.category = input.category;
    }
  }

  if (input.title !== undefined) {
    data.title = input.title?.trim() || null;
  }

  if (input.responsibleText !== undefined) {
    data.responsibleText = input.responsibleText?.trim() || null;
  }

  if (input.responsibleUserId !== undefined) {
    if (input.responsibleUserId === null) {
      data.responsibleUser = { disconnect: true };
    } else {
      await assertUserInOrg(input.responsibleUserId, organizationId);
      data.responsibleUser = { connect: { id: input.responsibleUserId } };
    }
  }

  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? parseDateOrIso(input.dueDate) : null;
  }
  if (input.dueDateText !== undefined) {
    data.dueDateText = normalizeDueDateText(input.dueDateText) || null;
  }

  if (input.status !== undefined) {
    if (!isMeetingItemStatus(input.status)) {
      throw new Error("Ungültiger Status");
    }
    data.status = input.status;
  }

  if (input.orderIndex !== undefined) {
    if (!Number.isFinite(input.orderIndex) || input.orderIndex < 0) {
      throw new Error("orderIndex muss >= 0 sein");
    }
    data.orderIndex = Math.trunc(input.orderIndex);
  }

  if (input.copiedFromItemId !== undefined) {
    if (input.copiedFromItemId === null) {
      data.copiedFromItem = { disconnect: true };
    } else {
      const source = await findMeetingItemInOrg(
        input.copiedFromItemId,
        organizationId,
      );
      if (!source) {
        throw new Error("Quell-Item für Kopie nicht gefunden");
      }
      data.copiedFromItem = { connect: { id: input.copiedFromItemId } };
    }
  }

  const updated = await prisma.meetingItem.update({
    where: { id: itemId },
    data,
  });
  return toMeetingItemDTO(updated);
}

export async function deleteMeetingItem(
  itemId: string,
  organizationId: string,
): Promise<boolean> {
  const existing = await findMeetingItemInOrg(itemId, organizationId);
  if (!existing) return false;
  await prisma.meetingItem.delete({ where: { id: itemId } });
  return true;
}

/**
 * Reorder von MeetingItems per Liste sortierter IDs. Alle angegebenen IDs
 * müssen zu diesem Meeting (und damit zur richtigen Organisation) gehören;
 * fehlende IDs des Meetings werden mit ihrem Original-orderIndex unverändert
 * gelassen (lückenlos reindexiert nach der neuen Reihenfolge gefolgt von den
 * nicht genannten).
 */
export async function reorderMeetingItems(
  meetingId: string,
  orderedIds: string[],
  organizationId: string,
): Promise<MeetingItemDTO[]> {
  const meeting = await findMeetingInOrg(meetingId, organizationId);
  if (!meeting) {
    throw new Error("Protokoll nicht gefunden");
  }

  if (!Array.isArray(orderedIds)) {
    throw new Error("orderedIds muss ein Array sein");
  }

  // Alle Items des Meetings laden.
  const current = await prisma.meetingItem.findMany({
    where: { meetingId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const currentIds = new Set(current.map((i) => i.id));

  // Sicherstellen, dass alle übergebenen IDs zum Meeting gehören.
  for (const id of orderedIds) {
    if (!currentIds.has(id)) {
      throw new Error(`MeetingItem ${id} gehört nicht zu diesem Protokoll`);
    }
  }

  // Entgegenkommend: IDs, die der Aufrufer NICHT genannt hat, hängen wir in
  // ihrer bisherigen Reihenfolge hinten an.
  const mentioned = new Set(orderedIds);
  const tail = current.filter((i) => !mentioned.has(i.id)).map((i) => i.id);
  const finalOrder = [...orderedIds, ...tail];

  await prisma.$transaction(
    finalOrder.map((id, idx) =>
      prisma.meetingItem.update({
        where: { id },
        data: { orderIndex: idx },
      }),
    ),
  );

  const updated = await prisma.meetingItem.findMany({
    where: { meetingId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
  return updated.map(toMeetingItemDTO);
}

// ---------------------------------------------------------------------------
// Participants: Replace-All
// ---------------------------------------------------------------------------

/**
 * Setzt die Teilnehmerliste eines Protokolls neu (Replace-All).
 * Jeder Eintrag benötigt entweder `userId` ODER `externalName` (beides null
 * wird als Fehler gewertet).
 */
export async function setParticipants(
  meetingId: string,
  list: ParticipantInput[],
  organizationId: string,
): Promise<MeetingParticipantDTO[]> {
  const meeting = await findMeetingInOrg(meetingId, organizationId);
  if (!meeting) {
    throw new Error("Protokoll nicht gefunden");
  }

  if (!Array.isArray(list)) {
    throw new Error("Teilnehmerliste muss ein Array sein");
  }

  // Alle userIds vorab auf Org-Zugehörigkeit prüfen.
  for (const entry of list) {
    const hasUser = typeof entry.userId === "string" && entry.userId.length > 0;
    const hasExternal =
      typeof entry.externalName === "string" && entry.externalName.trim().length > 0;
    if (!hasUser && !hasExternal) {
      throw new Error("Teilnehmer braucht userId oder externalName");
    }
    if (hasUser && entry.userId) {
      await assertUserInOrg(entry.userId, organizationId);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.meetingParticipant.deleteMany({ where: { meetingId } });
    if (list.length > 0) {
      await tx.meetingParticipant.createMany({
        data: list.map((entry, idx) => ({
          meetingId,
          userId: entry.userId ?? null,
          externalName: entry.externalName?.trim() || null,
          roleText: entry.roleText?.trim() || null,
          orderIndex: entry.orderIndex ?? idx,
        })),
      });
    }
  });

  const participants = await prisma.meetingParticipant.findMany({
    where: { meetingId },
    orderBy: [{ orderIndex: "asc" }],
  });
  return participants.map(toParticipantDTO);
}
