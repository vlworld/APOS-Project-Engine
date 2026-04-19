import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { createTodoFromMeetingItem } from "@/lib/todos/service";
import type { CreateTodoFromMeetingItemInput } from "@/lib/todos/types";

// ─── POST /api/projekte/[id]/todos/from-meeting-item ────────────────────────
// Legt ein Todo an, das aus einem MeetingItem „übernommen" wird.
// Body: { meetingItemId: string, additionalFields?: {...} }

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

  const input = (body ?? {}) as CreateTodoFromMeetingItemInput;
  if (typeof input.meetingItemId !== "string" || !input.meetingItemId) {
    return NextResponse.json(
      { error: "meetingItemId ist erforderlich" },
      { status: 400 },
    );
  }

  // Sicherstellen, dass das MeetingItem zum Projekt im Pfad gehört — und zwar
  // über den Meeting-Join, damit Cross-Project-Missbrauch ausgeschlossen ist.
  const item = await prisma.meetingItem.findFirst({
    where: {
      id: input.meetingItemId,
      meeting: { projectId: id },
    },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json(
      { error: "MeetingItem nicht gefunden oder nicht im Projekt" },
      { status: 404 },
    );
  }

  try {
    const created = await createTodoFromMeetingItem(
      input.meetingItemId,
      input.additionalFields,
      session!.user.organizationId,
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
