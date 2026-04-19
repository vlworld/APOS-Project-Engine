import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { getMeetingDetail, setParticipants } from "@/lib/meetings/service";
import type { ParticipantInput } from "@/lib/meetings/types";

// ─── PUT /api/projekte/[id]/protokolle/[meetingId]/participants ─────────────
// Replace-all: ersetzt die komplette Teilnehmerliste des Protokolls.

export async function PUT(
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

  // Body erlaubt sowohl { participants: [...] } als auch ein blankes Array.
  let list: unknown;
  if (Array.isArray(body)) {
    list = body;
  } else if (body && typeof body === "object" && "participants" in body) {
    list = (body as { participants: unknown }).participants;
  } else {
    list = [];
  }

  if (!Array.isArray(list)) {
    return NextResponse.json(
      { error: "participants muss ein Array sein" },
      { status: 400 },
    );
  }

  try {
    const participants = await setParticipants(
      meetingId,
      list as ParticipantInput[],
      session!.user.organizationId,
    );
    return NextResponse.json({ participants });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
