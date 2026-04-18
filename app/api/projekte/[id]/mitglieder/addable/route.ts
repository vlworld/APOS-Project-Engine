import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { listAddableUsers } from "@/lib/projekte/members";

// ─── GET /api/projekte/[id]/mitglieder/addable ──────────────────────────────
// Liefert alle Nutzer der Organisation, die diesem Projekt hinzugefügt
// werden können (nicht Projekt-Manager, noch nicht Mitglied, nicht
// deaktiviert). Für den Dropdown im "Mitglied hinzufügen"-Modal.
//
// Zugriff: Schreibrecht auf dem Projekt — wer das Mitglieder-Listing nur
// lesen darf, hat kein Hinzufügen-Szenario und soll hier nichts erfahren.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  const users = await listAddableUsers(session!.user.organizationId, id);
  return NextResponse.json({ users });
}
