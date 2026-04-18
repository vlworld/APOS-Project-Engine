/**
 * POST /api/einstellungen/benutzer/[id]/password
 *
 * Passwort-Reset durch Admin/Developer. Der Benutzer muss zur selben
 * Organisation gehören.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession, isAdmin } from "@/lib/api-helpers";
import { resetPassword } from "@/lib/benutzer/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  if (!isAdmin(session!.user.role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { password?: unknown };
  if (typeof body.password !== "string" || !body.password.trim()) {
    return NextResponse.json(
      { error: "Passwort ist erforderlich" },
      { status: 400 },
    );
  }

  try {
    const ok = await resetPassword(
      session!.user.organizationId,
      id,
      body.password,
    );
    if (!ok) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Passwort-Reset fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
