import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import {
  applyMusterData,
  getMusterStatus,
  removeMusterData,
} from "@/lib/muster/service";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const status = await getMusterStatus(session!.user.organizationId);
  return NextResponse.json(status);
}

export async function POST() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const status = await applyMusterData(
      session!.user.organizationId,
      session!.user.id,
    );
    return NextResponse.json(status, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Muster-Daten Apply-Fehler:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const status = await removeMusterData(session!.user.organizationId);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
