import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import {
  createDependency,
  listDependencies,
} from "@/lib/terminplan/service";
import type { CreateDependencyInput } from "@/lib/terminplan/types";

// ─── GET /api/projekte/[id]/dependencies ────────────────────────────────────
// Liste aller ScheduleDependencies des Projekts.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const access = await requireProjectAccess(session!.user, id, "read");
  if (access.error) return access.error;

  const deps = await listDependencies(id);
  return NextResponse.json(deps);
}

// ─── POST /api/projekte/[id]/dependencies ───────────────────────────────────
// Neue Dependency (FS/SS/FF mit lagDays). Zyklus-Schutz im Service.

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

  const input = (body ?? {}) as CreateDependencyInput;
  if (typeof input.fromId !== "string" || typeof input.toId !== "string") {
    return NextResponse.json(
      { error: "fromId und toId sind erforderlich" },
      { status: 400 },
    );
  }

  try {
    const created = await createDependency(id, input);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    let status = 400;
    if (message === "Zirkuläre Abhängigkeit") status = 409;
    else if (message === "Abhängigkeit existiert bereits") status = 409;
    return NextResponse.json({ error: message }, { status });
  }
}
