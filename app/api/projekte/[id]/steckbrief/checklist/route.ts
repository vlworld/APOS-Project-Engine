import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { addChecklistItem } from "@/lib/briefing/service";

// POST /api/projekte/[id]/steckbrief/checklist
// Body: { text, verantwortlich?, done? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
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

  let body: { text?: unknown; verantwortlich?: unknown; done?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Text ist erforderlich" }, { status: 400 });
  }

  const verantwortlich =
    typeof body.verantwortlich === "string" && body.verantwortlich.trim().length > 0
      ? body.verantwortlich.trim()
      : null;
  const done = body.done === true;

  try {
    const briefing = await addChecklistItem(id, { text, verantwortlich, done });
    return NextResponse.json({ briefing });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
