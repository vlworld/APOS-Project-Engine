import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  createMeeting,
  listProjectMeetings,
} from "@/lib/meetings/service";
import type { CreateMeetingInput } from "@/lib/meetings/types";

// ─── GET /api/projekte/[id]/protokolle ──────────────────────────────────────
// Listet alle Protokolle des Projekts (nur Summary, keine Items/Participants).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const meetings = await listProjectMeetings(id);
  return NextResponse.json({ meetings });
}

// ─── POST /api/projekte/[id]/protokolle ─────────────────────────────────────
// Legt ein neues Protokoll an.

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

  const raw = (body ?? {}) as Partial<CreateMeetingInput>;
  if (typeof raw.title !== "string" || !raw.title.trim()) {
    return NextResponse.json({ error: "Titel ist erforderlich" }, { status: 400 });
  }
  if (typeof raw.meetingDate !== "string" || !raw.meetingDate) {
    return NextResponse.json(
      { error: "meetingDate ist erforderlich (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const input: CreateMeetingInput = {
    ...raw,
    projectId: id,
    title: raw.title,
    meetingDate: raw.meetingDate,
  };

  try {
    const created = await createMeeting(input, session!.user.organizationId);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
