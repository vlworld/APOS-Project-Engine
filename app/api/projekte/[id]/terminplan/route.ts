import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  createScheduleItem,
  loadTerminplan,
} from "@/lib/terminplan/service";
import type { CreateScheduleItemInput } from "@/lib/terminplan/types";

// ─── GET /api/projekte/[id]/terminplan ──────────────────────────────────────
// Liefert Items + Dependencies + TradeCategories für das Projekt.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const data = await loadTerminplan(id, session!.user.organizationId);
  return NextResponse.json(data);
}

// ─── POST /api/projekte/[id]/terminplan ─────────────────────────────────────
// Legt ein neues ScheduleItem im Projekt an.

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

  const input = (body ?? {}) as CreateScheduleItemInput;
  if (typeof input.name !== "string" || !input.name.trim()) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }
  if (typeof input.startDate !== "string" || typeof input.endDate !== "string") {
    return NextResponse.json(
      { error: "startDate und endDate sind erforderlich (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  try {
    const created = await createScheduleItem(id, input);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
