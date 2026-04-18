import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  addMember,
  listMembers,
  type ProjectMemberRole,
} from "@/lib/projekte/members";

// ─── GET /api/projekte/[id]/mitglieder ──────────────────────────────────────
// Listet alle Mitglieder eines Projekts. Lesezugriff genügt.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const members = await listMembers(id);
  return NextResponse.json({ members });
}

// ─── POST /api/projekte/[id]/mitglieder ─────────────────────────────────────
// Fügt einen Nutzer als Mitglied hinzu. Schreibrecht auf dem Projekt
// erforderlich (Admin/Developer, Projekt-Manager, WRITE-Member).

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

  const { userId, role } = (body ?? {}) as {
    userId?: unknown;
    role?: unknown;
  };

  if (typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json(
      { error: "userId ist erforderlich" },
      { status: 400 },
    );
  }
  if (role !== "READ" && role !== "WRITE") {
    return NextResponse.json(
      { error: "role muss READ oder WRITE sein" },
      { status: 400 },
    );
  }

  try {
    const member = await addMember(id, userId, role as ProjectMemberRole);
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    // Duplikat oder Validierungsfehler → 409/400, restliche als 500
    const status =
      message === "Nutzer ist bereits Mitglied" ||
      message === "Nutzer ist bereits Projekt-Manager"
        ? 409
        : message.startsWith("Ungültige") ||
            message === "Nutzer gehört nicht zur Organisation des Projekts" ||
            message === "Nutzer nicht gefunden"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
