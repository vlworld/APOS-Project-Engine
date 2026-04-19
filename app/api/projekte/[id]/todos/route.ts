import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { createTodo, listProjectTodos } from "@/lib/todos/service";
import type {
  CreateTodoInput,
  TodoListFilter,
  TodoStatus,
} from "@/lib/todos/types";

function isTodoStatus(s: string): s is TodoStatus {
  return s === "OPEN" || s === "IN_PROGRESS" || s === "DONE";
}

// ─── GET /api/projekte/[id]/todos ───────────────────────────────────────────
// Listet alle Todos des Projekts. Optional per ?status=...&assignedToId=...

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const url = new URL(req.url);
  const filter: TodoListFilter = {};
  const statusParam = url.searchParams.get("status");
  const assignedToParam = url.searchParams.get("assignedToId");

  if (statusParam) {
    if (!isTodoStatus(statusParam)) {
      return NextResponse.json(
        { error: "Ungültiger Status-Filter" },
        { status: 400 },
      );
    }
    filter.status = statusParam;
  }
  if (assignedToParam) {
    filter.assignedToId = assignedToParam;
  }

  try {
    const todos = await listProjectTodos(id, filter);
    return NextResponse.json({ todos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ─── POST /api/projekte/[id]/todos ──────────────────────────────────────────
// Legt ein neues Todo im Projekt an.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body" },
      { status: 400 },
    );
  }

  const input = (body ?? {}) as CreateTodoInput;
  if (typeof input.title !== "string" || !input.title.trim()) {
    return NextResponse.json({ error: "Titel ist erforderlich" }, { status: 400 });
  }

  try {
    const created = await createTodo(
      { ...input, projectId: id },
      session!.user.organizationId,
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
