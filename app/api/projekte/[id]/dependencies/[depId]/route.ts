import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { deleteDependency } from "@/lib/terminplan/service";

// ─── DELETE /api/projekte/[id]/dependencies/[depId] ─────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, depId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  const ok = await deleteDependency(id, depId);
  if (!ok) {
    return NextResponse.json(
      { error: "Abhängigkeit nicht gefunden" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
