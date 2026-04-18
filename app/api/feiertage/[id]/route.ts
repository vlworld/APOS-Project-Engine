import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { deleteHoliday, updateHoliday } from "@/lib/feiertage/service";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const body = (await req.json()) as { name?: unknown; date?: unknown };
  const patch: { name?: string; date?: string } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Name darf nicht leer sein" },
        { status: 400 },
      );
    }
    patch.name = body.name.trim();
  }

  if (body.date !== undefined) {
    if (typeof body.date !== "string" || !DATE_KEY_RE.test(body.date.trim())) {
      return NextResponse.json(
        { error: "Datum ungültig (Format YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    patch.date = body.date.trim();
  }

  try {
    const updated = await updateHoliday(
      session!.user.organizationId,
      id,
      patch,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Feiertag nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Feiertag konnte nicht aktualisiert werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const ok = await deleteHoliday(session!.user.organizationId, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Feiertag nicht gefunden" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
