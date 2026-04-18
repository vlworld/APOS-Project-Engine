import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { removeChecklistItem, toggleChecklistItem } from "@/lib/briefing/service";

// PATCH /api/projekte/[id]/steckbrief/checklist/[itemId]
// Body: { done: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id, itemId } = await params;
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

  let body: { done?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "done muss boolean sein" }, { status: 400 });
  }

  const briefing = await toggleChecklistItem(id, itemId, body.done);
  return NextResponse.json({ briefing });
}

// DELETE /api/projekte/[id]/steckbrief/checklist/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id, itemId } = await params;
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

  const briefing = await removeChecklistItem(id, itemId);
  return NextResponse.json({ briefing });
}
