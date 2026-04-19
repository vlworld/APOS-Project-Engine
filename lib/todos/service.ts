/**
 * Service-Layer für ToDos.
 *
 * Reine Server-Logik. Alle Queries sind strikt auf `projectId` oder
 * `organizationId` (via Projekt-Join) gescopt. Aufrufer (API-Route) stellt
 * vorab via `requireProjectAccess` sicher, dass der User Zugriff auf das
 * Projekt hat.
 *
 * Konvention für Datums-Strings:
 *   - Input: "YYYY-MM-DD" oder voller ISO-String
 *   - Output (DTO): ISO-String via `.toISOString()`
 */

import type { Prisma, Todo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateTodoInput,
  CreateTodoFromMeetingItemInput,
  TodoDTO,
  TodoListFilter,
  TodoStatus,
  UpdateTodoInput,
} from "@/lib/todos/types";

// ---------------------------------------------------------------------------
// Date-Helper
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
// Validierung
// ---------------------------------------------------------------------------

function isTodoStatus(s: unknown): s is TodoStatus {
  return s === "OPEN" || s === "IN_PROGRESS" || s === "DONE";
}

// ---------------------------------------------------------------------------
// DTO-Mapping
// ---------------------------------------------------------------------------

function toTodoDTO(row: Todo): TodoDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    assignedToId: row.assignedToId,
    assignedToText: row.assignedToText,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    status: (row.status as TodoStatus) ?? "OPEN",
    sourceMeetingItemId: row.sourceMeetingItemId,
    sourceMeetingId: row.sourceMeetingId,
    workPackageId: row.workPackageId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Org-Helper
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

/** Lädt ein Todo und prüft per Join, dass es zur Organisation gehört. */
async function findTodoInOrg(
  todoId: string,
  organizationId: string,
): Promise<Todo | null> {
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      project: { organizationId },
    },
  });
  return todo;
}

// ---------------------------------------------------------------------------
// List / Read
// ---------------------------------------------------------------------------

export async function listProjectTodos(
  projectId: string,
  filter?: TodoListFilter,
): Promise<TodoDTO[]> {
  const where: Prisma.TodoWhereInput = { projectId };
  if (filter?.status) {
    if (!isTodoStatus(filter.status)) {
      throw new Error("Ungültiger Status-Filter");
    }
    where.status = filter.status;
  }
  if (filter?.assignedToId) {
    where.assignedToId = filter.assignedToId;
  }

  const todos = await prisma.todo.findMany({
    where,
    orderBy: [
      { status: "asc" }, // OPEN < IN_PROGRESS < DONE (alphanumerisch: DONE > IN_PROGRESS > OPEN, also absteigend wäre umgekehrt — wir lassen die Standard-Reihenfolge stehen)
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
  });
  return todos.map(toTodoDTO);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function validateCreateRefs(
  input: {
    assignedToId?: string | null;
    sourceMeetingItemId?: string | null;
    sourceMeetingId?: string | null;
  },
  projectId: string,
  organizationId: string,
): Promise<void> {
  if (input.assignedToId) {
    await assertUserInOrg(input.assignedToId, organizationId);
  }

  if (input.sourceMeetingItemId) {
    const item = await prisma.meetingItem.findFirst({
      where: {
        id: input.sourceMeetingItemId,
        meeting: { projectId },
      },
      select: { id: true },
    });
    if (!item) {
      throw new Error("Quell-MeetingItem nicht gefunden oder nicht im Projekt");
    }
  }

  if (input.sourceMeetingId) {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: input.sourceMeetingId,
        projectId,
      },
      select: { id: true },
    });
    if (!meeting) {
      throw new Error("Quell-Protokoll nicht gefunden oder nicht im Projekt");
    }
  }
}

export async function createTodo(
  input: CreateTodoInput & { projectId: string },
  organizationId: string,
): Promise<TodoDTO> {
  const title = input.title?.trim();
  if (!title) throw new Error("Titel darf nicht leer sein");

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, organizationId },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Projekt nicht gefunden");
  }

  await validateCreateRefs(input, input.projectId, organizationId);

  const status: TodoStatus = isTodoStatus(input.status) ? input.status : "OPEN";

  const dueDate = input.dueDate ? parseDateOrIso(input.dueDate) : null;

  const created = await prisma.todo.create({
    data: {
      projectId: input.projectId,
      title,
      description: input.description?.trim() || null,
      assignedToId: input.assignedToId ?? null,
      assignedToText: input.assignedToText?.trim() || null,
      dueDate,
      status,
      sourceMeetingItemId: input.sourceMeetingItemId ?? null,
      sourceMeetingId: input.sourceMeetingId ?? null,
      workPackageId: input.workPackageId?.trim() || null,
    },
  });

  return toTodoDTO(created);
}

/**
 * Erzeugt ein Todo aus einem MeetingItem. Kopiert:
 *   - title (aus item.title, fallback: erste Zeile von item.description)
 *   - description (aus item.description)
 *   - assignedToId (aus item.responsibleUserId)
 *   - assignedToText (aus item.responsibleText)
 *   - dueDate (aus item.dueDate)
 *
 * Setzt sourceMeetingItemId und sourceMeetingId (denormalisiert).
 * `additionalFields` erlaubt selektives Überschreiben.
 */
export async function createTodoFromMeetingItem(
  itemId: string,
  input: CreateTodoFromMeetingItemInput["additionalFields"] | undefined,
  organizationId: string,
): Promise<TodoDTO> {
  const item = await prisma.meetingItem.findFirst({
    where: {
      id: itemId,
      meeting: { project: { organizationId } },
    },
    include: {
      meeting: { select: { id: true, projectId: true } },
    },
  });
  if (!item) {
    throw new Error("MeetingItem nicht gefunden");
  }

  // Default-Title: item.title, sonst erste Zeile von item.description.
  const firstLine = item.description.split("\n")[0]?.trim() ?? "";
  const defaultTitle =
    (item.title && item.title.trim()) ||
    (firstLine.length > 0 ? firstLine : "Todo aus Protokoll");

  const override = input ?? {};
  const title = (override.title?.trim() || defaultTitle).slice(0, 500);
  if (!title) throw new Error("Titel darf nicht leer sein");

  // Optionale Override-Validierung
  if (override.assignedToId) {
    await assertUserInOrg(override.assignedToId, organizationId);
  }

  const status: TodoStatus = isTodoStatus(override.status)
    ? override.status
    : "OPEN";

  const dueDate =
    override.dueDate !== undefined
      ? override.dueDate
        ? parseDateOrIso(override.dueDate)
        : null
      : item.dueDate;

  const description =
    override.description !== undefined
      ? override.description?.trim() || null
      : item.description;

  const assignedToId =
    override.assignedToId !== undefined
      ? override.assignedToId
      : item.responsibleUserId;

  const assignedToText =
    override.assignedToText !== undefined
      ? override.assignedToText?.trim() || null
      : item.responsibleText;

  const workPackageId =
    override.workPackageId !== undefined
      ? override.workPackageId?.trim() || null
      : null;

  const created = await prisma.todo.create({
    data: {
      projectId: item.meeting.projectId,
      title,
      description,
      assignedToId,
      assignedToText,
      dueDate,
      status,
      sourceMeetingItemId: item.id,
      sourceMeetingId: item.meeting.id,
      workPackageId,
    },
  });

  return toTodoDTO(created);
}

// ---------------------------------------------------------------------------
// Update / Delete
// ---------------------------------------------------------------------------

export async function updateTodo(
  todoId: string,
  input: UpdateTodoInput,
  organizationId: string,
): Promise<TodoDTO | null> {
  const existing = await findTodoInOrg(todoId, organizationId);
  if (!existing) return null;

  const data: Prisma.TodoUpdateInput = {};

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (!trimmed) throw new Error("Titel darf nicht leer sein");
    data.title = trimmed;
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  if (input.assignedToId !== undefined) {
    if (input.assignedToId === null) {
      data.assignedTo = { disconnect: true };
    } else {
      await assertUserInOrg(input.assignedToId, organizationId);
      data.assignedTo = { connect: { id: input.assignedToId } };
    }
  }

  if (input.assignedToText !== undefined) {
    data.assignedToText = input.assignedToText?.trim() || null;
  }

  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? parseDateOrIso(input.dueDate) : null;
  }

  if (input.status !== undefined) {
    if (!isTodoStatus(input.status)) {
      throw new Error("Ungültiger Status");
    }
    data.status = input.status;
  }

  if (input.sourceMeetingItemId !== undefined) {
    if (input.sourceMeetingItemId === null) {
      data.sourceMeetingItem = { disconnect: true };
    } else {
      const sourceItem = await prisma.meetingItem.findFirst({
        where: {
          id: input.sourceMeetingItemId,
          meeting: { projectId: existing.projectId },
        },
        select: { id: true },
      });
      if (!sourceItem) {
        throw new Error("Quell-MeetingItem nicht gefunden oder nicht im Projekt");
      }
      data.sourceMeetingItem = { connect: { id: input.sourceMeetingItemId } };
    }
  }

  if (input.sourceMeetingId !== undefined) {
    if (input.sourceMeetingId === null) {
      data.sourceMeeting = { disconnect: true };
    } else {
      const sourceMeeting = await prisma.meeting.findFirst({
        where: {
          id: input.sourceMeetingId,
          projectId: existing.projectId,
        },
        select: { id: true },
      });
      if (!sourceMeeting) {
        throw new Error("Quell-Protokoll nicht gefunden oder nicht im Projekt");
      }
      data.sourceMeeting = { connect: { id: input.sourceMeetingId } };
    }
  }

  if (input.workPackageId !== undefined) {
    data.workPackageId = input.workPackageId?.trim() || null;
  }

  const updated = await prisma.todo.update({
    where: { id: todoId },
    data,
  });
  return toTodoDTO(updated);
}

export async function deleteTodo(
  todoId: string,
  organizationId: string,
): Promise<boolean> {
  const existing = await findTodoInOrg(todoId, organizationId);
  if (!existing) return false;
  await prisma.todo.delete({ where: { id: todoId } });
  return true;
}
