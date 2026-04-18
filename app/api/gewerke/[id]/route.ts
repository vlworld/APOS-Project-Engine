import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import {
  deleteTradeCategory,
  updateTradeCategory,
} from "@/lib/gewerke/service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  let body: { name?: string; color?: string; orderIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  try {
    const updated = await updateTradeCategory(
      session!.user.organizationId,
      id,
      body,
    );
    if (!updated) {
      return NextResponse.json({ error: "Gewerk nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const ok = await deleteTradeCategory(session!.user.organizationId, id);
  if (!ok) {
    return NextResponse.json({ error: "Gewerk nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
