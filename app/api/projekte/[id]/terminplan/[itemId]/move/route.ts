import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { moveScheduleItem } from "@/lib/terminplan/service";
import type { MoveScheduleItemInput } from "@/lib/terminplan/types";

// ─── POST /api/projekte/[id]/terminplan/[itemId]/move ───────────────────────
// Verschiebt ein Item um deltaWorkdays Arbeitstage. Wenn cascade=true,
// werden alle Nachfolger über Dependencies ebenfalls verschoben.

export async function POST(
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

  const input = (body ?? {}) as MoveScheduleItemInput;
  if (typeof input.deltaWorkdays !== "number") {
    return NextResponse.json(
      { error: "deltaWorkdays (Zahl) ist erforderlich" },
      { status: 400 },
    );
  }

  try {
    const result = await moveScheduleItem(
      id,
      session!.user.organizationId,
      itemId,
      input,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    const status = message === "Item nicht gefunden" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
