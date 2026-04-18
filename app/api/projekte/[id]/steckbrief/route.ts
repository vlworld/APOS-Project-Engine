import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  getBriefing,
  upsertBriefing,
  type UpsertBriefingInput,
} from "@/lib/briefing/service";

// GET /api/projekte/[id]/steckbrief
// Liefert den Steckbrief; wenn noch keiner existiert: 200 mit { briefing: null }.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const access = await requireProjectAccess(
    {
      id: session!.user.id,
      organizationId: session!.user.organizationId,
      role: session!.user.role,
    },
    id,
    "read",
  );
  if (access.error) return access.error;

  const briefing = await getBriefing(id);
  return NextResponse.json({ briefing });
}

// PUT /api/projekte/[id]/steckbrief
// Upsert: ganzer Body wird angewandt. Keine Felder = no-op.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const access = await requireProjectAccess(
    {
      id: session!.user.id,
      organizationId: session!.user.organizationId,
      role: session!.user.role,
    },
    id,
    "write",
  );
  if (access.error) return access.error;

  let body: UpsertBriefingInput;
  try {
    body = (await req.json()) as UpsertBriefingInput;
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const briefing = await upsertBriefing(id, body);
  return NextResponse.json({ briefing });
}
