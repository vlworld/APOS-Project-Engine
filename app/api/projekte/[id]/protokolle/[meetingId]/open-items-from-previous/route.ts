import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  getMeetingDetail,
  listOpenItemsFromPreviousMeeting,
} from "@/lib/meetings/service";

// ─── GET /api/projekte/[id]/protokolle/[meetingId]/open-items-from-previous ─
// Liefert die offenen Punkte vom Vorgänger-Protokoll (falls gesetzt).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id, meetingId } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const existing = await getMeetingDetail(meetingId, session!.user.organizationId);
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Protokoll nicht gefunden" }, { status: 404 });
  }

  try {
    const items = await listOpenItemsFromPreviousMeeting(
      meetingId,
      session!.user.organizationId,
    );
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
