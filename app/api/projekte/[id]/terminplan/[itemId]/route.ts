import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  deleteScheduleItem,
  updateScheduleItem,
} from "@/lib/terminplan/service";
import type { UpdateScheduleItemInput } from "@/lib/terminplan/types";

// ─── PATCH /api/projekte/[id]/terminplan/[itemId] ───────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, itemId } = await params;

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

  try {
    const updated = await updateScheduleItem(id, itemId, (body ?? {}) as UpdateScheduleItemInput);
    if (!updated) {
      return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    const status = message === "Zirkuläre Hierarchie erkannt" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// ─── DELETE /api/projekte/[id]/terminplan/[itemId] ──────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, itemId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  const ok = await deleteScheduleItem(id, itemId);
  if (!ok) {
    return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
