import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  deleteMeetingItem,
  getMeetingDetail,
  updateMeetingItem,
} from "@/lib/meetings/service";
import type { UpdateMeetingItemInput } from "@/lib/meetings/types";

// ─── PATCH /api/projekte/[id]/protokolle/[meetingId]/items/[itemId] ─────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string; itemId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId, itemId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  // Sicherstellen, dass Meeting zum Projekt gehört (und zur Org).
  const existing = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }
  if (!existing.items.some((it) => it.id === itemId)) {
    return NextResponse.json(
      { error: "Protokollpunkt nicht gefunden" },
      { status: 404 },
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

  try {
    const updated = await updateMeetingItem(
      itemId,
      (body ?? {}) as UpdateMeetingItemInput,
      session!.user.organizationId,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Protokollpunkt nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ─── DELETE /api/projekte/[id]/protokolle/[meetingId]/items/[itemId] ────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string; itemId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId, itemId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  const existing = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }
  if (!existing.items.some((it) => it.id === itemId)) {
    return NextResponse.json(
      { error: "Protokollpunkt nicht gefunden" },
      { status: 404 },
    );
  }

  const ok = await deleteMeetingItem(itemId, session!.user.organizationId);
  if (!ok) {
    return NextResponse.json(
      { error: "Protokollpunkt nicht gefunden" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
