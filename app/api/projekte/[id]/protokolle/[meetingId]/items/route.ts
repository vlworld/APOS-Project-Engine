import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  addMeetingItem,
  getMeetingDetail,
  reorderMeetingItems,
} from "@/lib/meetings/service";
import type { CreateMeetingItemInput } from "@/lib/meetings/types";

// ─── POST /api/projekte/[id]/protokolle/[meetingId]/items ───────────────────
// Fügt einen neuen Punkt zum Protokoll hinzu.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  const existing = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
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

  const input = (body ?? {}) as CreateMeetingItemInput;
  if (typeof input.description !== "string" || !input.description.trim()) {
    return NextResponse.json(
      { error: "description ist erforderlich" },
      { status: 400 },
    );
  }

  try {
    const created = await addMeetingItem(meetingId, input, session!.user.organizationId);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ─── PATCH /api/projekte/[id]/protokolle/[meetingId]/items ──────────────────
// Reorder der Items per sortierter ID-Liste: body = { orderedIds: string[] }.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId } = await params;

  const access = await requireProjectAccess(session!.user, id, "write");
  if (access.error) return access.error;

  const existing = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
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

  const { orderedIds } = (body ?? {}) as { orderedIds?: unknown };
  if (
    !Array.isArray(orderedIds) ||
    !orderedIds.every((v) => typeof v === "string")
  ) {
    return NextResponse.json(
      { error: "orderedIds muss ein Array von Strings sein" },
      { status: 400 },
    );
  }

  try {
    const items = await reorderMeetingItems(
      meetingId,
      orderedIds,
      session!.user.organizationId,
    );
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
