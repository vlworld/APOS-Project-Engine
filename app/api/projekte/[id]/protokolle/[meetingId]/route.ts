import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  deleteMeeting,
  getMeetingDetail,
  updateMeeting,
} from "@/lib/meetings/service";
import type { UpdateMeetingInput } from "@/lib/meetings/types";

// ─── GET /api/projekte/[id]/protokolle/[meetingId] ──────────────────────────
// Liefert das Protokoll inklusive Items und Teilnehmer.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const detail = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!detail || detail.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

// ─── PATCH /api/projekte/[id]/protokolle/[meetingId] ────────────────────────
// Aktualisiert den Kopfdatensatz (Title, Datum, Leiter, Freigabe-Workflow etc.).

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId } = await params;

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

  // Sanity-Check: Meeting muss zu diesem Projekt gehören (über Detail).
  const existing = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }

  try {
    const updated = await updateMeeting(
      meetingId,
      (body ?? {}) as UpdateMeetingInput,
      session!.user.organizationId,
    );
    if (!updated) {
      return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// ─── DELETE /api/projekte/[id]/protokolle/[meetingId] ───────────────────────

export async function DELETE(
  _req: NextRequest,
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

  const ok = await deleteMeeting(meetingId, session!.user.organizationId);
  if (!ok) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
