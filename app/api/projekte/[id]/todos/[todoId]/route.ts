import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { deleteTodo, updateTodo } from "@/lib/todos/service";
import type { UpdateTodoInput } from "@/lib/todos/types";

/**
 * Hilfsfunktion: prüft, dass das Todo zum gegebenen Projekt gehört.
 * Der Service selbst scoped bereits über die Org; das hier stellt
 * zusätzlich sicher, dass die Projekt-ID im Pfad zur Todo-ID passt.
 */
async function todoBelongsToProject(
  todoId: string,
  projectId: string,
): Promise<boolean> {
  const todo = await prisma.todo.findFirst({
    where: { id: todoId, projectId },
    select: { id: true },
  });
  return todo !== null;
}

// ─── PATCH /api/projekte/[id]/todos/[todoId] ────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; todoId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, todoId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  if (!(await todoBelongsToProject(todoId, id))) {
    return NextResponse.json({ error: "Todo nicht gefunden" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateTodo(
      todoId,
      (body ?? {}) as UpdateTodoInput,
      session!.user.organizationId,
    );
    if (!updated) {
      return NextResponse.json({ error: "Todo nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ─── DELETE /api/projekte/[id]/todos/[todoId] ───────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; todoId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, todoId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  if (!(await todoBelongsToProject(todoId, id))) {
    return NextResponse.json({ error: "Todo nicht gefunden" }, { status: 404 });
  }

  const ok = await deleteTodo(todoId, session!.user.organizationId);
  if (!ok) {
    return NextResponse.json({ error: "Todo nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
