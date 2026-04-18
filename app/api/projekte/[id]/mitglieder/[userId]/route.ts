import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  removeMember,
  updateMemberRole,
  type ProjectMemberRole,
} from "@/lib/projekte/members";

// ─── PATCH /api/projekte/[id]/mitglieder/[userId] ───────────────────────────
// Ändert die Rolle eines Mitglieds (READ ⇄ WRITE).

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, userId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  // Der Projekt-Manager ist kein reguläres Mitglied und hat keine READ/WRITE-
  // Rolle — ein PATCH auf seinen userId-Slug wäre konzeptionell falsch.
  if (access.project && access.project.managerId === userId) {
    return NextResponse.json(
      { error: "Der Projekt-Manager ist kein Mitglied und kann nicht geändert werden" },
      { status: 400 },
    );
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

  const { role } = (body ?? {}) as { role?: unknown };
  if (role !== "READ" && role !== "WRITE") {
    return NextResponse.json(
      { error: "role muss READ oder WRITE sein" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateMemberRole(
      id,
      userId,
      role as ProjectMemberRole,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Mitglied nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json({ member: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    const status = message.startsWith("Ungültige") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─── DELETE /api/projekte/[id]/mitglieder/[userId] ──────────────────────────
// Entfernt einen Nutzer aus dem Projekt.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, userId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  if (access.project && access.project.managerId === userId) {
    return NextResponse.json(
      { error: "Der Projekt-Manager kann nicht entfernt werden" },
      { status: 400 },
    );
  }

  const removed = await removeMember(id, userId);
  if (!removed) {
    return NextResponse.json(
      { error: "Mitglied nicht gefunden" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
