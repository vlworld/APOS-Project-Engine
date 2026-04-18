import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { reorderScheduleItem } from "@/lib/terminplan/service";
import type { ReorderScheduleItemInput } from "@/lib/terminplan/types";

// ─── POST /api/projekte/[id]/terminplan/reorder ─────────────────────────────
// Ändert parentId und orderIndex eines Items und reindexiert Geschwister.

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

  const input = (body ?? {}) as ReorderScheduleItemInput;
  if (typeof input.itemId !== "string" || !input.itemId) {
    return NextResponse.json({ error: "itemId ist erforderlich" }, { status: 400 });
  }
  if (typeof input.newOrderIndex !== "number") {
    return NextResponse.json(
      { error: "newOrderIndex (Zahl) ist erforderlich" },
      { status: 400 },
    );
  }
  if (input.newParentId !== null && typeof input.newParentId !== "string") {
    return NextResponse.json(
      { error: "newParentId muss string oder null sein" },
      { status: 400 },
    );
  }

  try {
    const result = await reorderScheduleItem(id, input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    let status = 400;
    if (message === "Item nicht gefunden") status = 404;
    else if (message === "Zirkuläre Hierarchie erkannt") status = 409;
    return NextResponse.json({ error: message }, { status });
  }
}
